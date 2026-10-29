import { eq } from "drizzle-orm";
import { db } from "@/db";
import { conversaEstados, type Aguardando } from "@/db/schema";
import type { EstadoConversa } from "./roteador";

/**
 * Estado da conversa: o que o bot espera de cada chat (ex.: /recibo → a foto).
 * Fica no banco (na Vercel nada pode ficar em memória) e expira em 30 minutos.
 */
export const VALIDADE_ESTADO_MIN = 30;

export async function lerEstado(chatId: number, agora = new Date()): Promise<EstadoConversa | null> {
  const [e] = await db.select().from(conversaEstados).where(eq(conversaEstados.chatId, chatId)).limit(1);
  if (!e) return null;
  if (e.expiraEm.getTime() <= agora.getTime()) {
    await db.delete(conversaEstados).where(eq(conversaEstados.chatId, chatId));
    return null;
  }
  return { aguardando: e.aguardando, refId: e.refId, dados: (e.dados as Record<string, unknown>) ?? null, pessoaId: e.pessoaId };
}

export async function definirEstado(
  chatId: number,
  pessoaId: string | null,
  aguardando: Aguardando,
  opcoes: { refId?: string | null; dados?: Record<string, unknown> | null; minutos?: number } = {},
) {
  const expiraEm = new Date(Date.now() + (opcoes.minutos ?? VALIDADE_ESTADO_MIN) * 60000);
  const valores = { pessoaId, aguardando, refId: opcoes.refId ?? null, dados: opcoes.dados ?? null, expiraEm };
  await db
    .insert(conversaEstados)
    .values({ chatId, ...valores })
    .onConflictDoUpdate({ target: conversaEstados.chatId, set: valores });
}

export async function limparEstado(chatId: number) {
  await db.delete(conversaEstados).where(eq(conversaEstados.chatId, chatId));
}
