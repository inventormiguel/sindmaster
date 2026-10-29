import { after } from "next/server";
import { tratarRequisicaoWebhook } from "@/lib/telegram/webhook";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Webhook do Telegram. Confere X-Telegram-Bot-Api-Secret-Token, grava o
 * update_id (idempotência), responde 200 na hora e processa depois da resposta.
 */
export async function POST(req: Request) {
  return tratarRequisicaoWebhook(req, { agendar: (tarefa) => after(tarefa) });
}
