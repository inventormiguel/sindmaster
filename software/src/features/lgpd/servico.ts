import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { arquivos, chamadoEventos, chamados, duvidas, pessoas, rotinaItens, telegramContas, telegramMensagens } from "@/db/schema";
import { auditar } from "@/lib/negocio/auditoria";

/** Exportar os dados de uma pessoa (LGPD): o que o sistema guarda sobre ela. */
export async function exportarPessoa(organizacaoId: string, pessoaId: string) {
  const [p] = await db.select().from(pessoas).where(and(eq(pessoas.id, pessoaId), eq(pessoas.organizacaoId, organizacaoId))).limit(1);
  if (!p) throw new Error("Pessoa não encontrada.");
  const [chs, dvs, msgs, its, arqs] = await Promise.all([
    db.select().from(chamados).where(eq(chamados.abertoPorPessoaId, p.id)),
    db.select().from(duvidas).where(eq(duvidas.pessoaId, p.id)),
    db.select({ direcao: telegramMensagens.direcao, tipo: telegramMensagens.tipo, texto: telegramMensagens.texto, criadoEm: telegramMensagens.criadoEm }).from(telegramMensagens).where(eq(telegramMensagens.pessoaId, p.id)),
    db.select({ data: rotinaItens.data, estado: rotinaItens.estado, motivo: rotinaItens.motivo }).from(rotinaItens).where(eq(rotinaItens.marcadoPorPessoaId, p.id)),
    db.select({ id: arquivos.id, nome: arquivos.nomeOriginal, tipo: arquivos.mimeType, tamanho: arquivos.tamanhoBytes, criadoEm: arquivos.criadoEm }).from(arquivos).where(eq(arquivos.pessoaId, p.id)),
  ]);
  return {
    pessoa: { nome: p.nome, papel: p.papel, unidade: p.unidade, relacao: p.relacaoUnidade, telefone: p.telefone, telegram: p.telegramChatId ? "vinculado" : "sem vínculo", vinculadoEm: p.vinculadoEm, saiuEm: p.saiuEm },
    chamados: chs.map((c) => ({ numero: c.numero, descricao: c.descricao, estado: c.estado, abertoEm: c.abertoEm })),
    duvidas: dvs.map((d) => ({ pergunta: d.pergunta, resposta: d.resposta, estado: d.estado, criadoEm: d.criadoEm })),
    mensagens: msgs,
    tarefas: its,
    arquivos: arqs,
  };
}

/**
 * Apagar os dados de uma pessoa (LGPD): nome, telefone e identificadores do Telegram saem de
 * todas as tabelas; o histórico (chamados, eventos, tarefas) fica sem identificar a pessoa.
 * Registros só de inserção aceitam esta correção dentro da transação com app.lgpd = 'on'.
 */
export async function apagarPessoa(p: { organizacaoId: string; pessoaId: string; quem: string }) {
  const [x] = await db.select().from(pessoas).where(and(eq(pessoas.id, p.pessoaId), eq(pessoas.organizacaoId, p.organizacaoId))).limit(1);
  if (!x) throw new Error("Pessoa não encontrada.");
  await db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.lgpd', 'on', true)`);
    await tx
      .update(pessoas)
      .set({ nome: "Pessoa removida (LGPD)", telefone: null, telegramChatId: null, telegramUserId: null, telegramUsername: null, telegramNome: null, telegramContaId: null, vinculadoEm: null, removidaEm: new Date() })
      .where(eq(pessoas.id, x.id));
    await tx.update(telegramMensagens).set({ texto: null }).where(eq(telegramMensagens.pessoaId, x.id));
    await tx.update(chamadoEventos).set({ autorRotulo: "Pessoa removida (LGPD)" }).where(eq(chamadoEventos.autorPessoaId, x.id));
    if (x.telegramContaId) {
      const outros = await tx.select({ id: pessoas.id }).from(pessoas).where(and(eq(pessoas.telegramContaId, x.telegramContaId), isNull(pessoas.removidaEm)));
      if (outros.length === 0) await tx.update(telegramContas).set({ nome: null, username: null, contextoPessoaId: null }).where(eq(telegramContas.id, x.telegramContaId));
    }
  });
  await auditar({ organizacaoId: p.organizacaoId, condominioId: x.condominioId, ator: p.quem, acao: "lgpd.dados_apagados", alvo: x.id });
}
