import { compararSegredo, segredoWebhookTelegram } from "@/lib/segredos";
import { clienteDoAmbiente, tokenDoBot } from "./api";
import { idDoBot } from "./mascara";
import { processarUpdate, registrarUpdate, type Origem } from "./processador";
import type { Roteador, Saida } from "./roteador";
import { criarSaidaTelegram } from "./saida";
import type { TgUpdate } from "./tipos";

export const HEADER_SEGREDO = "x-telegram-bot-api-secret-token";
/** O script de polling local repassa os updates para este mesmo endpoint e se identifica por aqui. */
export const HEADER_ORIGEM = "x-origem-update";

export function segredoValido(headers: Headers): boolean {
  return compararSegredo(headers.get(HEADER_SEGREDO), segredoWebhookTelegram());
}

function json(corpo: unknown, status = 200) {
  return new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
}

/**
 * Trata o POST do webhook:
 * - confere o segredo (401 se faltar ou não bater);
 * - grava o update_id (idempotência) e responde 200 na hora;
 * - o processamento roda depois da resposta (`agendar`, que no Next é o `after()`).
 */
export async function tratarRequisicaoWebhook(
  req: Request,
  opcoes: { agendar: (tarefa: () => Promise<unknown>) => void; saida?: Saida; roteador?: Roteador },
): Promise<Response> {
  const token = tokenDoBot();
  if (!token) return json({ ok: false, erro: "Telegram não configurado." }, 503);
  if (!segredoValido(req.headers)) return json({ ok: false, erro: "Não autorizado." }, 401);

  let update: TgUpdate;
  try {
    update = (await req.json()) as TgUpdate;
  } catch {
    return json({ ok: false, erro: "Corpo inválido." }, 400);
  }
  if (!update || typeof update !== "object" || !Number.isSafeInteger(update.update_id)) {
    return json({ ok: false, erro: "Update sem update_id." }, 400);
  }

  const origem: Origem = req.headers.get(HEADER_ORIGEM) === "polling" ? "polling" : "webhook";
  const botId = idDoBot(token);
  const novo = await registrarUpdate(botId, update, origem);
  if (novo) {
    const saida = opcoes.saida ?? criarSaidaTelegram(clienteDoAmbiente()!);
    opcoes.agendar(() => processarUpdate(botId, update, saida, opcoes.roteador));
  }
  return json({ ok: true, duplicado: !novo });
}
