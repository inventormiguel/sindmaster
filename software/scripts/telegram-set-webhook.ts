import "./_ambiente";
import { criarClienteTelegram } from "@/lib/telegram/api";
import { mascararToken } from "@/lib/telegram/mascara";
import { UPDATES_PERMITIDOS } from "@/lib/telegram/tipos";
import { montarRoteador } from "@/lib/telegram/comandos";
import { segredoWebhookTelegram } from "@/lib/segredos";

/**
 * Liga o webhook: npm run telegram:set-webhook -- https://seu-endereco.com.br
 * O Telegram passa a enviar os updates para <url-base>/api/telegram/webhook com o
 * header X-Telegram-Bot-Api-Secret-Token. O servidor que recebe precisa ter o
 * mesmo TELEGRAM_WEBHOOK_SECRET que este script usa.
 */
const token = process.env.TELEGRAM_BOT_TOKEN?.trim();
const base = process.argv[2]?.trim().replace(/\/+$/, "");

async function main() {
  if (!token) throw new Error("TELEGRAM_BOT_TOKEN não está no .env.local.");
  if (!base || !/^https:\/\//.test(base)) {
    throw new Error("Informe a URL pública com https. Ex.: npm run telegram:set-webhook -- https://condominio.exemplo.com.br");
  }
  if (!process.env.TELEGRAM_WEBHOOK_SECRET?.trim()) {
    console.warn("[set-webhook] TELEGRAM_WEBHOOK_SECRET não definido: usando o segredo derivado desta instalação.");
    console.warn("[set-webhook] Isso só funciona se o servidor de destino for esta mesma pasta (ex.: túnel para a sua máquina).");
    console.warn("[set-webhook] Para um servidor publicado, defina o mesmo TELEGRAM_WEBHOOK_SECRET aqui e lá, ou use o botão no painel.");
  }
  const cliente = criarClienteTelegram({ token });
  const url = `${base}/api/telegram/webhook`;
  await cliente.setWebhook({
    url,
    secret_token: segredoWebhookTelegram(),
    allowed_updates: UPDATES_PERMITIDOS,
    max_connections: 10,
    drop_pending_updates: false,
  });
  await cliente.setMyCommands({ commands: montarRoteador().comandosParaMenu() });
  const info = await cliente.getWebhookInfo();
  console.log(`[set-webhook] token ${mascararToken(token)}`);
  console.log(`[set-webhook] webhook ativo em ${info.url}`);
  console.log(`[set-webhook] updates pendentes: ${info.pending_update_count}; tipos: ${(info.allowed_updates ?? []).join(", ")}`);
  console.log("[set-webhook] Para voltar ao modo local: npm run telegram:polling (ele remove o webhook antes).");
}

main().catch((e) => {
  console.error(`[set-webhook] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
