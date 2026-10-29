import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { mudancas, pessoas, telegramConvites, unidades } from "@/db/schema";
import { criarConvite, desvincularPessoa } from "@/lib/telegram/vinculo";
import { auditar } from "@/lib/negocio/auditoria";
import { hojeISO } from "@/lib/negocio/datas";

/** Validade do convite: de 1 a 30 dias (padrão 30 para unidade, 7 para funcionário e prestador). */
export function validadeConviteDias(v: unknown, padrao = 30): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n === 0) return padrao;
  if (n < 1 || n > 30) throw new Error("A validade do convite vai de 1 a 30 dias.");
  return Math.round(n);
}

async function revogarConvitesPendentes(pessoaIds: string[], motivo: string) {
  if (pessoaIds.length === 0) return 0;
  const r = await db
    .update(telegramConvites)
    .set({ revogadoEm: new Date(), motivoRevogacao: motivo })
    .where(and(inArray(telegramConvites.pessoaId, pessoaIds), isNull(telegramConvites.usadoEm), isNull(telegramConvites.revogadoEm)))
    .returning({ id: telegramConvites.id });
  return r.length;
}

/**
 * "Convites das unidades": para cada unidade sem morador vinculado, a pessoa provisória
 * "Morador do 302" e um convite novo. Reimprimir = gerar de novo e revogar os anteriores.
 */
export async function gerarConvitesDasUnidades(p: { organizacaoId: string; condominioId: string; usuarioId: string; quem: string; dias: number; unidadeIds?: string[] }) {
  const todas = await db.select().from(unidades).where(and(eq(unidades.condominioId, p.condominioId), eq(unidades.organizacaoId, p.organizacaoId)));
  const alvo = p.unidadeIds?.length ? todas.filter((u) => p.unidadeIds!.includes(u.id)) : todas;
  const moradores = await db.select().from(pessoas).where(and(eq(pessoas.condominioId, p.condominioId), eq(pessoas.papel, "morador"), isNull(pessoas.saiuEm), isNull(pessoas.removidaEm)));
  const saida: { unidade: string; pessoa: string; codigo: string; expiraEm: Date }[] = [];
  const loteId = crypto.randomUUID();
  for (const u of alvo.sort((a, b) => (a.andar ?? 0) - (b.andar ?? 0) || a.numero.localeCompare(b.numero))) {
    const daUnidade = moradores.filter((m) => m.unidadeId === u.id);
    if (!p.unidadeIds?.length && daUnidade.some((m) => m.telegramChatId)) continue;
    let prov = daUnidade.find((m) => m.provisoria && !m.telegramChatId);
    if (!prov) {
      [prov] = await db
        .insert(pessoas)
        .values({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, nome: `Morador do ${u.bloco ? `${u.bloco}-` : ""}${u.numero}`, papel: "morador", unidade: u.numero, unidadeId: u.id, provisoria: true, relacaoUnidade: "outro" })
        .returning();
    }
    const { codigo, convite } = await criarConvite({ organizacaoId: p.organizacaoId, pessoaId: prov.id, validadeHoras: p.dias * 24, criadoPorUsuarioId: p.usuarioId });
    await db.update(telegramConvites).set({ loteId }).where(eq(telegramConvites.id, convite.id));
    saida.push({ unidade: `${u.bloco ? `${u.bloco}-` : ""}${u.numero}`, pessoa: prov.nome, codigo, expiraEm: convite.expiraEm });
  }
  await auditar({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, ator: p.quem, acao: "convites.unidades_gerados", detalhe: { quantidade: saida.length, dias: p.dias } });
  return saida;
}

/** "+1 morador": mais uma pessoa provisória na unidade (proprietário, inquilino, dependente…). */
export async function maisUmMorador(p: { organizacaoId: string; condominioId: string; unidadeId: string; nome?: string | null; relacao: "proprietario" | "inquilino" | "dependente" | "outro" }) {
  const [u] = await db.select().from(unidades).where(and(eq(unidades.id, p.unidadeId), eq(unidades.condominioId, p.condominioId))).limit(1);
  if (!u) throw new Error("Unidade não encontrada.");
  const [x] = await db
    .insert(pessoas)
    .values({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, nome: p.nome?.trim() || `Morador do ${u.numero}`, papel: "morador", unidade: u.numero, unidadeId: u.id, provisoria: !p.nome?.trim(), relacaoUnidade: p.relacao })
    .returning();
  return x;
}

/**
 * Mudança (saída): as pessoas que saem são desvinculadas e marcadas com saiu_em, têm os
 * convites revogados e param de receber avisos. O histórico fica com a unidade e a pessoa
 * antiga, visível só ao síndico; quem entra não vê nada do anterior.
 */
export async function registrarSaida(p: { organizacaoId: string; condominioId: string; unidadeId: string; pessoaIds: string[]; data: string; quem: string }) {
  const daUnidade = await db.select().from(pessoas).where(and(eq(pessoas.unidadeId, p.unidadeId), eq(pessoas.condominioId, p.condominioId), isNull(pessoas.saiuEm)));
  const saem = p.pessoaIds.length ? daUnidade.filter((x) => p.pessoaIds.includes(x.id)) : daUnidade;
  if (saem.length === 0) throw new Error("Escolha quem sai da unidade.");
  for (const s of saem) {
    await desvincularPessoa(p.organizacaoId, s.id);
    await db.update(pessoas).set({ saiuEm: p.data }).where(eq(pessoas.id, s.id));
  }
  const revogados = await revogarConvitesPendentes(daUnidade.map((x) => x.id), "mudança");
  await db.insert(mudancas).values({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, unidadeId: p.unidadeId, tipo: "saida", data: p.data, pessoaIds: saem.map((x) => x.id), origem: "painel", estado: "confirmada", registradaPorRotulo: p.quem });
  await auditar({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, ator: p.quem, acao: "mudanca.saida", alvo: p.unidadeId, detalhe: { pessoas: saem.length, convitesRevogados: revogados } });
  return { saem: saem.length, revogados };
}

export async function registrarEntrada(p: { organizacaoId: string; condominioId: string; unidadeId: string; nomes: { nome: string; relacao: "proprietario" | "inquilino" | "dependente" | "outro" }[]; quem: string }) {
  const [u] = await db.select().from(unidades).where(and(eq(unidades.id, p.unidadeId), eq(unidades.condominioId, p.condominioId))).limit(1);
  if (!u) throw new Error("Unidade não encontrada.");
  const criadas = [];
  for (const n of p.nomes.filter((x) => x.nome.trim().length >= 2)) {
    const [x] = await db.insert(pessoas).values({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, nome: n.nome.trim(), papel: "morador", unidade: u.numero, unidadeId: u.id, relacaoUnidade: n.relacao }).returning();
    criadas.push(x);
  }
  if (criadas.length === 0) throw new Error("Escreva o nome de quem entra.");
  await db.insert(mudancas).values({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, unidadeId: u.id, tipo: "entrada", data: hojeISO(), pessoaIds: criadas.map((x) => x.id), origem: "painel", estado: "confirmada", registradaPorRotulo: p.quem });
  return criadas;
}

/** Reemitir convite (trocou de celular ou de número): encerra o vínculo antigo e gera um novo. */
export async function reemitirConvite(p: { organizacaoId: string; pessoaId: string; usuarioId: string; dias: number }) {
  await desvincularPessoa(p.organizacaoId, p.pessoaId);
  await revogarConvitesPendentes([p.pessoaId], "reemitido");
  return criarConvite({ organizacaoId: p.organizacaoId, pessoaId: p.pessoaId, validadeHoras: p.dias * 24, criadoPorUsuarioId: p.usuarioId });
}
