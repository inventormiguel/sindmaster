import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramUpdates } from "@/db/schema";
import { clienteDoAmbiente, tokenDoBot } from "./api";
import { idDoBot, mascararToken, removerToken } from "./mascara";
import type { TgBotInfo, TgWebhookInfo } from "./tipos";

export type StatusBot = {
  configurado: boolean;
  tokenMascarado: string;
  bot: { id: number; username: string; nome: string } | null;
  webhook: TgWebhookInfo | null;
  modo: "webhook" | "polling" | "nao_configurado" | "erro";
  ultimoUpdate: { em: Date; origem: "webhook" | "polling" } | null;
  erro: string | null;
};

/** Consulta real ao Telegram (getMe + getWebhookInfo) para a tela do painel. */
export async function statusDoBot(): Promise<StatusBot> {
  const token = tokenDoBot();
  const base: StatusBot = {
    configurado: !!token,
    tokenMascarado: mascararToken(token),
    bot: null,
    webhook: null,
    modo: "nao_configurado",
    ultimoUpdate: null,
    erro: null,
  };
  if (!token) return base;
  try {
    const cliente = clienteDoAmbiente()!;
    const [me, webhook] = await Promise.all([cliente.getMe(), cliente.getWebhookInfo()]);
    base.bot = { id: me.id, username: me.username ?? "", nome: me.first_name };
    base.webhook = webhook;
    base.modo = webhook.url ? "webhook" : "polling";
    nomeDoBotEmCache = me.username ?? null;
  } catch (e) {
    base.modo = "erro";
    base.erro = removerToken(e instanceof Error ? e.message : String(e), token);
  }
  try {
    const [u] = await db
      .select({ em: telegramUpdates.recebidoEm, origem: telegramUpdates.origem })
      .from(telegramUpdates)
      .where(eq(telegramUpdates.botId, idDoBot(token)))
      .orderBy(desc(telegramUpdates.recebidoEm))
      .limit(1);
    base.ultimoUpdate = u ?? null;
  } catch {
    /* banco indisponível: a tela mostra só o status do Telegram */
  }
  return base;
}

let nomeDoBotEmCache: string | null = null;

/** @username do bot para montar o deep link: TELEGRAM_BOT_USERNAME ou getMe. */
export async function usernameDoBot(): Promise<string | null> {
  const doAmbiente = process.env.TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "");
  if (doAmbiente) return doAmbiente;
  if (nomeDoBotEmCache) return nomeDoBotEmCache;
  const cliente = clienteDoAmbiente();
  if (!cliente) return null;
  const me: TgBotInfo = await cliente.getMe();
  nomeDoBotEmCache = me.username ?? null;
  return nomeDoBotEmCache;
}
