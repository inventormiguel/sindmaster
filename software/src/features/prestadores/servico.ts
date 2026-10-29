import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { alertas, prestadorCondominios, prestadorDocumentos, prestadores, prestadorPagamentos, type TipoDocumentoPrestador } from "@/db/schema";
import { cifrar, mascarar } from "@/lib/negocio/cifra";
import { raizCnpj, soDigitos } from "@/lib/negocio/cnpj";
import { dataBR, diferencaDias, hojeISO } from "@/lib/negocio/datas";
import { auditar } from "@/lib/negocio/auditoria";

export const ROTULO_DOC: Record<TipoDocumentoPrestador, string> = {
  cnd_federal: "CND federal (RFB/PGFN)",
  crf_fgts: "CRF do FGTS",
  cndt: "CNDT (Justiça do Trabalho)",
  apolice_rc: "Apólice de responsabilidade civil",
  alvara: "Alvará",
  outro: "Outro documento",
};

/** Onde conferir a autenticidade (sem automação: os emissores têm captcha). */
export const LINK_AUTENTICIDADE: Partial<Record<TipoDocumentoPrestador, string>> = {
  cnd_federal: "https://solucoes.receita.fazenda.gov.br/servicos/certidaointernet/pj/emitir",
  crf_fgts: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf",
  cndt: "https://cndt-certidao.tst.jus.br/inicio.faces",
};

export const CATEGORIAS_SERVICO = ["caixa d'água", "hidráulica", "elevador", "incêndio", "controle de pragas", "elétrica", "portões", "jardinagem", "limpeza", "outros"];

/** Avisos proporcionais à validade: documento de até 30 dias (ex.: CRF do FGTS) avisa em D-7 e D-1; os demais em D-30, D-15 e D-7. */
export function diasDeAvisoDocumento(emitidoEm: string | null, validade: string): number[] {
  const duracao = emitidoEm ? diferencaDias(emitidoEm, validade) : 180;
  return duracao <= 30 ? [7, 1] : [30, 15, 7];
}

/** O titular confere com o prestador? CND federal: pela raiz (matriz e filiais); os demais: CNPJ completo. */
export function titularConfere(tipo: TipoDocumentoPrestador, titularCnpj: string | null, cnpjPrestador: string | null): boolean | null {
  if (!titularCnpj || !cnpjPrestador) return null;
  if (tipo === "cnd_federal") return raizCnpj(titularCnpj) === raizCnpj(cnpjPrestador);
  return soDigitos(titularCnpj) === soDigitos(cnpjPrestador);
}

export type SituacaoDocs = { emDia: boolean; vencidos: { tipo: TipoDocumentoPrestador; validade: string }[]; vencendo: { tipo: TipoDocumentoPrestador; validade: string; dias: number }[]; conferidoPor: string | null; conferidoEm: Date | null };

/** Situação pelo documento conferido mais recente de cada tipo. */
export function situacaoDocumentos(docs: (typeof prestadorDocumentos.$inferSelect)[], hoje = hojeISO()): SituacaoDocs {
  const porTipo = new Map<string, typeof prestadorDocumentos.$inferSelect>();
  for (const d of docs.filter((x) => x.estado === "conferido" && x.validade).sort((a, b) => (b.validade ?? "").localeCompare(a.validade ?? ""))) {
    if (!porTipo.has(d.tipo)) porTipo.set(d.tipo, d);
  }
  const vencidos: SituacaoDocs["vencidos"] = [];
  const vencendo: SituacaoDocs["vencendo"] = [];
  let ultimo: typeof prestadorDocumentos.$inferSelect | null = null;
  for (const d of porTipo.values()) {
    const dias = diferencaDias(hoje, d.validade!);
    if (dias < 0) vencidos.push({ tipo: d.tipo, validade: d.validade! });
    else if (dias <= 30) vencendo.push({ tipo: d.tipo, validade: d.validade!, dias });
    if (!ultimo || (d.conferidoEm && ultimo.conferidoEm && d.conferidoEm > ultimo.conferidoEm)) ultimo = d;
  }
  return { emDia: vencidos.length === 0, vencidos, vencendo, conferidoPor: ultimo?.conferidoPorNome ?? null, conferidoEm: ultimo?.conferidoEm ?? null };
}

export function textoSituacaoDocs(s: SituacaoDocs): string {
  if (s.vencidos.length === 0) return s.conferidoPor && s.conferidoEm ? `Documentos em dia (conferidos por ${s.conferidoPor} em ${s.conferidoEm.toLocaleDateString("pt-BR")})` : "Documentos em dia";
  return `${s.vencidos.length} documento${s.vencidos.length > 1 ? "s" : ""} vencido${s.vencidos.length > 1 ? "s" : ""} (${s.vencidos.map((v) => `${ROTULO_DOC[v.tipo]} desde ${dataBR(v.validade)}`).join("; ")})`;
}

export async function prestadoresDoCondominio(organizacaoId: string, condominioId: string) {
  const lista = await db
    .select({ p: prestadores })
    .from(prestadores)
    .innerJoin(prestadorCondominios, eq(prestadorCondominios.prestadorId, prestadores.id))
    .where(and(eq(prestadores.organizacaoId, organizacaoId), eq(prestadorCondominios.condominioId, condominioId)));
  const ids = lista.map((l) => l.p.id);
  const docs = ids.length ? await db.select().from(prestadorDocumentos).where(inArray(prestadorDocumentos.prestadorId, ids)) : [];
  return lista
    .map((l) => {
      const meus = docs.filter((d) => d.prestadorId === l.p.id);
      return { ...l.p, documentos: meus, situacao: situacaoDocumentos(meus) };
    })
    .sort((a, b) => a.razaoSocial.localeCompare(b.razaoSocial));
}

/** Troca dos dados de pagamento: grava o histórico cifrado e abre o alerta de confirmação por telefone. */
export async function alterarDadosPagamento(p: { organizacaoId: string; condominioId: string; prestadorId: string; tipo: "pix" | "conta"; dados: string; quem: string }) {
  const [prest] = await db.select().from(prestadores).where(and(eq(prestadores.id, p.prestadorId), eq(prestadores.organizacaoId, p.organizacaoId))).limit(1);
  if (!prest) throw new Error("Prestador não encontrado.");
  const dados = p.dados.trim();
  if (dados.length < 4) throw new Error("Informe a chave Pix ou banco/agência/conta.");
  const anteriores = await db.select({ id: prestadorPagamentos.id }).from(prestadorPagamentos).where(eq(prestadorPagamentos.prestadorId, prest.id)).limit(1);
  const resumo = `${p.tipo === "pix" ? "Chave Pix" : "Conta"} ${mascarar(dados)}`;
  await db.insert(prestadorPagamentos).values({ organizacaoId: p.organizacaoId, prestadorId: prest.id, tipo: p.tipo, dadosCifrados: cifrar(dados), resumo, alteradoPorRotulo: p.quem });
  await auditar({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, ator: p.quem, acao: "prestador.dados_pagamento_alterados", alvo: prest.id, detalhe: { resumo } });
  if (anteriores.length === 0) return { alerta: false };
  // Fecha alerta anterior em aberto (o fato mudou de novo) e abre o novo.
  const agora = new Date();
  await db
    .insert(alertas)
    .values({
      organizacaoId: p.organizacaoId,
      condominioId: p.condominioId,
      tipo: "dados_pagamento",
      refId: prest.id,
      chave: `pagamento:${prest.id}:${agora.getTime()}`,
      fatos: { prestador: prest.razaoSocial, resumo, alteradoPor: p.quem, alteradoEm: agora.toISOString() },
    });
  return { alerta: true };
}

export function textoAlertaPagamento(fatos: Record<string, unknown>): string {
  const em = new Date(String(fatos.alteradoEm));
  return `Dados de pagamento de ${fatos.prestador} mudaram em ${em.toLocaleDateString("pt-BR")} por ${fatos.alteradoPor}: confirme por telefone com o prestador antes do próximo pagamento.`;
}

/** O alerta só fecha com "Confirmei por telefone com {nome} em dd/mm". */
export async function confirmarPagamentoPorTelefone(p: { organizacaoId: string; alertaId: string; comQuem: string; quem: string }) {
  if (p.comQuem.trim().length < 2) throw new Error("Informe com quem você confirmou por telefone.");
  const agora = new Date();
  const acao = `Confirmei por telefone com ${p.comQuem.trim()} em ${agora.toLocaleDateString("pt-BR")}`;
  const r = await db
    .update(alertas)
    .set({ acao, acaoPorNome: p.quem, acaoEm: agora, fechadoEm: agora })
    .where(and(eq(alertas.id, p.alertaId), eq(alertas.organizacaoId, p.organizacaoId), eq(alertas.tipo, "dados_pagamento"), isNull(alertas.fechadoEm)))
    .returning({ id: alertas.id, condominioId: alertas.condominioId });
  if (r.length === 0) throw new Error("Alerta não encontrado ou já fechado.");
  await auditar({ organizacaoId: p.organizacaoId, condominioId: r[0].condominioId, ator: p.quem, acao: "prestador.pagamento_confirmado_por_telefone", alvo: p.alertaId, detalhe: { acao } });
}

export async function ultimoPagamento(prestadorId: string) {
  const [u] = await db.select().from(prestadorPagamentos).where(eq(prestadorPagamentos.prestadorId, prestadorId)).orderBy(desc(prestadorPagamentos.criadoEm)).limit(1);
  return u ?? null;
}

export async function conferirDocumento(p: { organizacaoId: string; documentoId: string; quem: string; validade?: string | null; emitidoEm?: string | null; titularCnpj?: string | null; tipo?: TipoDocumentoPrestador }) {
  const [d] = await db.select().from(prestadorDocumentos).where(and(eq(prestadorDocumentos.id, p.documentoId), eq(prestadorDocumentos.organizacaoId, p.organizacaoId))).limit(1);
  if (!d) throw new Error("Documento não encontrado.");
  const validade = p.validade !== undefined ? p.validade : d.validade;
  const emitidoEm = p.emitidoEm !== undefined ? p.emitidoEm : d.emitidoEm;
  if (!validade) throw new Error("Informe a validade impressa no documento.");
  if (emitidoEm && diferencaDias(emitidoEm, validade) < 0) throw new Error("A validade não pode ser anterior à emissão.");
  await db
    .update(prestadorDocumentos)
    .set({ estado: "conferido", conferidoPorNome: p.quem, conferidoEm: new Date(), validade, emitidoEm, ...(p.titularCnpj !== undefined ? { titularCnpj: p.titularCnpj } : {}), ...(p.tipo ? { tipo: p.tipo } : {}) })
    .where(eq(prestadorDocumentos.id, d.id));
  await auditar({ organizacaoId: p.organizacaoId, ator: p.quem, acao: "prestador.documento_conferido", alvo: d.id, detalhe: { tipo: p.tipo ?? d.tipo, validade } });
}

export async function recusarDocumento(p: { organizacaoId: string; documentoId: string; quem: string }) {
  await db
    .update(prestadorDocumentos)
    .set({ estado: "recusado", conferidoPorNome: p.quem, conferidoEm: new Date() })
    .where(and(eq(prestadorDocumentos.id, p.documentoId), eq(prestadorDocumentos.organizacaoId, p.organizacaoId), eq(prestadorDocumentos.estado, "para_conferir")));
}
