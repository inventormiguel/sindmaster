import "./_ambiente";
import { criarClienteTelegram } from "@/lib/telegram/api";
import { mascararToken } from "@/lib/telegram/mascara";

/** Mostra o bot (getMe) e o estado do webhook (getWebhookInfo). O token aparece mascarado. */
async function main() {
  const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não está no .env.local.");
  const cliente = criarClienteTelegram({ token });
  const [me, info] = await Promise.all([cliente.getMe(), cliente.getWebhookInfo()]);
  const data = (s?: number) => (s ? new Date(s * 1000).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "—");
  console.log(`Bot:              @${me.username} (${me.first_name}, id ${me.id})`);
  console.log(`Token:            ${mascararToken(token)}`);
  console.log(`Modo:             ${info.url ? "webhook" : "polling (sem webhook)"}`);
  console.log(`Webhook:          ${info.url || "—"}`);
  console.log(`Pendentes:        ${info.pending_update_count}`);
  console.log(`Tipos de update:  ${(info.allowed_updates ?? []).join(", ") || "padrão do Telegram"}`);
  console.log(`Último erro:      ${info.last_error_message ? `${info.last_error_message} (${data(info.last_error_date)})` : "—"}`);
}

main().catch((e) => {
  console.error(`[telegram:info] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
