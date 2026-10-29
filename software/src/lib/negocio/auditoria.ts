import { db } from "@/db";
import { auditoria } from "@/db/schema";

/** Auditoria só de inserção: aprovações, conferências, envios, revogações, pagamentos e IA (sem o texto). */
export async function auditar(p: { organizacaoId: string; condominioId?: string | null; ator: string; acao: string; alvo?: string | null; detalhe?: Record<string, unknown> }) {
  await db.insert(auditoria).values({
    organizacaoId: p.organizacaoId,
    condominioId: p.condominioId ?? null,
    ator: p.ator,
    acao: p.acao,
    alvo: p.alvo ?? null,
    detalhe: p.detalhe ?? null,
  });
}
