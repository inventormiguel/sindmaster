import "./_ambiente";
import { criarClienteTelegram, TelegramApiError } from "@/lib/telegram/api";
import { mascararToken } from "@/lib/telegram/mascara";
import { UPDATES_PERMITIDOS, tipoDoUpdate } from "@/lib/telegram/tipos";
import { HEADER_ORIGEM, HEADER_SEGREDO } from "@/lib/telegram/webhook";
import { montarRoteador } from "@/lib/telegram/comandos";
import { segredoCron, segredoWebhookTelegram } from "@/lib/segredos";

/**
 * Modo local sem URL pública (long polling).
 *
 * Busca os updates com getUpdates e repassa cada um ao endpoint do webhook do
 * servidor local (o mesmo processador, com o mesmo segredo). Assim o banco local
 * (PGlite, conexão única) continua aberto só pelo servidor.
 *
 * Uso: em um terminal `npm run dev`; em outro `npm run telegram:polling`.
 */
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
if (!token) {
  console.error("[polling] TELEGRAM_BOT_TOKEN não está no .env.local.");
  process.exit(1);
}
const base = (process.env.POLLING_SERVIDOR ?? "http://localhost:3241").replace(/\/+$/, "");
const destino = `${base}/api/telegram/webhook`;
const cliente = criarClienteTelegram({ token });
const esperar = (ms: number) => new Promise((r) => setTimeout(r, ms));

process.on("SIGINT", () => {
  console.log("\n[polling] encerrado. Updates já repassados não se repetem (idempotência por update_id).");
  process.exit(0);
});

async function repassar(update: unknown): Promise<void> {
  for (;;) {
    try {
      const r = await fetch(destino, {
        method: "POST",
        headers: { "content-type": "application/json", [HEADER_SEGREDO]: segredoWebhookTelegram(), [HEADER_ORIGEM]: "polling" },
        body: JSON.stringify(update),
      });
      if (r.ok) return;
      if (r.status === 401) {
        console.error("[polling] o servidor recusou o segredo (401). O servidor e este script precisam do mesmo TELEGRAM_WEBHOOK_SECRET (ou nenhum dos dois).");
        process.exit(1);
      }
      console.warn(`[polling] servidor respondeu ${r.status}; nova tentativa em 3 s…`);
      await esperar(3000);
    } catch {
      console.warn(`[polling] servidor local não respondeu em ${base}. Inicie com \`npm run dev\`. Nova tentativa em 5 s…`);
      await esperar(5000);
    }
  }
}

async function chamarRotina(job: string) {
  try {
    await fetch(`${base}/api/cron/${job}`, { headers: { authorization: `Bearer ${segredoCron()}` } });
  } catch {
    /* servidor fora do ar: tenta no próximo ciclo */
  }
}
const enviarFilaDeAvisos = () => chamarRotina("enviar-fila");

/** Agendador do modo local: frequente a cada 15 min; diário uma vez por dia às 08:00 (ou na primeira volta depois). */
export function deveRodarDiario(agora: Date, ultimoDia: string | null): { rodar: boolean; dia: string } {
  const dia = agora.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
  const hora = Number(agora.toLocaleString("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", hourCycle: "h23" }));
  return { rodar: hora >= 8 && ultimoDia !== dia, dia };
}

async function main() {
  const me = await cliente.getMe();
  console.log(`[polling] bot @${me.username} (token ${mascararToken(token)})`);

  const info = await cliente.getWebhookInfo();
  if (info.url) {
    console.warn(`[polling] ATENÇÃO: havia um webhook ativo em ${info.url}.`);
    console.warn("[polling] Removendo o webhook (deleteWebhook) para o modo polling funcionar. Os updates pendentes são mantidos.");
    console.warn("[polling] Para voltar ao webhook: npm run telegram:set-webhook -- <url-base>");
    await cliente.deleteWebhook(false);
  }
  await cliente.setMyCommands({ commands: montarRoteador().comandosParaMenu() });
  console.log(`[polling] repassando updates para ${destino}. Ctrl+C para parar.`);

  let offset: number | undefined;
  let ultimaFila = 0;
  let ultimoFrequente = 0;
  let ultimoDiario: string | null = null;
  for (;;) {
    try {
      const updates = await cliente.getUpdates({ offset, timeout: 25, allowed_updates: UPDATES_PERMITIDOS });
      for (const u of updates) {
        await repassar(u);
        offset = u.update_id + 1;
        console.log(`[polling] update ${u.update_id} (${tipoDoUpdate(u)}) repassado`);
      }
    } catch (e) {
      if (e instanceof TelegramApiError && e.codigo === 409) {
        console.warn("[polling] conflito (409): outro processo está lendo este bot ou há webhook ativo. Nova tentativa em 5 s…");
      } else {
        console.warn(`[polling] ${e instanceof Error ? e.message : String(e)}; nova tentativa em 5 s…`);
      }
      await esperar(5000);
    }
    if (Date.now() - ultimaFila > 60_000) {
      ultimaFila = Date.now();
      await enviarFilaDeAvisos();
    }
    if (Date.now() - ultimoFrequente > 15 * 60_000) {
      ultimoFrequente = Date.now();
      await chamarRotina("frequente");
    }
    const d = deveRodarDiario(new Date(), ultimoDiario);
    if (d.rodar) {
      ultimoDiario = d.dia;
      console.log("[polling] rodando o diário do dia");
      await chamarRotina("diario");
    }
  }
}

main().catch((e) => {
  console.error(`[polling] falhou: ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
