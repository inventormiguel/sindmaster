import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { servicosRegistrados, vencimentoModelos, vencimentos } from "@/db/schema";
import { dataBR, diaDaSemana, diferencaDias, hojeISO, somarMeses, textoPrazo } from "@/lib/negocio/datas";
import { auditar } from "@/lib/negocio/auditoria";
import { MODELOS_VENCIMENTO } from "./modelos";

/** Próximo vencimento: a validade impressa prevalece; senão data do serviço + periodicidade (fim de mês ajustado). */
export function calcularProximo(p: { dataServico: string | null; validadeImpressa: string | null; periodicidadeMeses: number | null }): string | null {
  if (p.validadeImpressa) return p.validadeImpressa;
  if (p.dataServico && p.periodicidadeMeses) return somarMeses(p.dataServico, p.periodicidadeMeses);
  return null;
}

export type SituacaoVencimento = { tom: "vermelho" | "amarelo" | "verde" | "cinza"; texto: string; dias: number | null; vencido: boolean; vencendo30: boolean };

/** Linguagem de responsabilidade: "prazo cadastrado", nunca afirmação de conformidade legal. */
export function situacaoVencimento(proximo: string | null, hoje = hojeISO()): SituacaoVencimento {
  if (!proximo) return { tom: "cinza", texto: "Sem data cadastrada", dias: null, vencido: false, vencendo30: false };
  const dias = diferencaDias(hoje, proximo);
  if (dias < 0) return { tom: "vermelho", texto: `Fora do prazo cadastrado há ${textoPrazo(dias)}`, dias, vencido: true, vencendo30: false };
  if (dias === 0) return { tom: "amarelo", texto: "Vence hoje", dias, vencido: false, vencendo30: true };
  if (dias <= 30) return { tom: "amarelo", texto: `Vence em ${textoPrazo(dias)}`, dias, vencido: false, vencendo30: true };
  return { tom: "verde", texto: "Dentro do prazo cadastrado", dias, vencido: false, vencendo30: false };
}

/** Marcos de aviso proporcionais à periodicidade: ≤ 1 mês D-7, D-1, D0; 2 a 6 meses D-30, D-7, D-1, D0; acima (ou validade impressa) D-60, D-30, D-15, D-7, D-1, D0. */
export function marcosDeAviso(periodicidadeMeses: number | null, usaValidadeImpressa = false): number[] {
  if (usaValidadeImpressa || periodicidadeMeses == null || periodicidadeMeses > 6) return [60, 30, 15, 7, 1, 0];
  if (periodicidadeMeses <= 1) return [7, 1, 0];
  return [30, 7, 1, 0];
}

/** Aparece no resumo hoje? Nos marcos; vencido: toda segunda-feira até registrar. */
export function deveAvisarVencimento(proximo: string, hoje = hojeISO(), periodicidadeMeses: number | null = 12, usaValidadeImpressa = false): boolean {
  const dias = diferencaDias(hoje, proximo);
  if (dias >= 0) return marcosDeAviso(periodicidadeMeses, usaValidadeImpressa).includes(dias);
  return diaDaSemana(hoje) === 1;
}

/** Garante a tabela paramétrica no banco (idempotente). */
export async function garantirModelosVencimento() {
  for (const m of MODELOS_VENCIMENTO) {
    await db.insert(vencimentoModelos).values(m).onConflictDoNothing();
  }
}

/** Cria os vencimentos do condomínio a partir dos modelos, todos "não conferidos". */
export async function criarVencimentosDoCondominio(organizacaoId: string, condominioId: string, chaves?: string[]) {
  await garantirModelosVencimento();
  const lista = MODELOS_VENCIMENTO.filter((m) => (chaves ? chaves.includes(m.chave) : true));
  const existentes = await db.select({ chave: vencimentos.modeloChave }).from(vencimentos).where(eq(vencimentos.condominioId, condominioId));
  const ja = new Set(existentes.map((e) => e.chave));
  const novos = lista.filter((m) => !ja.has(m.chave));
  if (novos.length === 0) return 0;
  await db.insert(vencimentos).values(
    novos.map((m) => ({
      organizacaoId,
      condominioId,
      modeloChave: m.chave,
      modeloVersao: m.versao,
      nome: m.nome,
      referenciaInformada: m.referenciaInformada,
      variaPorLocal: m.variaPorLocal,
      notaConfira: m.notaConfira,
      periodicidadeMeses: m.periodicidadeMeses,
      usaValidadeImpressa: m.usaValidadeImpressa,
      estadoConferencia: "nao_conferido" as const,
    })),
  );
  return novos.length;
}

export async function listarVencimentos(organizacaoId: string, condominioId: string) {
  return db
    .select()
    .from(vencimentos)
    .where(and(eq(vencimentos.organizacaoId, organizacaoId), eq(vencimentos.condominioId, condominioId)))
    .orderBy(asc(vencimentos.proximo));
}

export async function conferirEAtivar(p: { organizacaoId: string; vencimentoId: string; quem: string; proximo?: string | null; periodicidadeMeses?: number | null }) {
  const [v] = await db.select().from(vencimentos).where(and(eq(vencimentos.id, p.vencimentoId), eq(vencimentos.organizacaoId, p.organizacaoId))).limit(1);
  if (!v) throw new Error("Vencimento não encontrado.");
  const proximo = p.proximo !== undefined ? p.proximo : v.proximo;
  if (!proximo) throw new Error("Informe a data do próximo vencimento (ou registre o último serviço) antes de ativar.");
  await db
    .update(vencimentos)
    .set({
      estadoConferencia: "ativo",
      conferidoPorNome: p.quem,
      conferidoEm: new Date(),
      proximo,
      ...(p.periodicidadeMeses !== undefined ? { periodicidadeMeses: p.periodicidadeMeses } : {}),
    })
    .where(eq(vencimentos.id, v.id));
  await auditar({ organizacaoId: p.organizacaoId, condominioId: v.condominioId, ator: p.quem, acao: "vencimento.conferido_e_ativo", alvo: v.id, detalhe: { nome: v.nome, proximo } });
}

export async function desativarVencimento(p: { organizacaoId: string; vencimentoId: string; quem: string }) {
  await db
    .update(vencimentos)
    .set({ estadoConferencia: "desativado" })
    .where(and(eq(vencimentos.id, p.vencimentoId), eq(vencimentos.organizacaoId, p.organizacaoId)));
  await auditar({ organizacaoId: p.organizacaoId, ator: p.quem, acao: "vencimento.desativado", alvo: p.vencimentoId });
}

/** Registro de serviço (rascunho quando lido pela IA; conferido direto quando digitado pelo síndico). */
export async function registrarServico(p: {
  organizacaoId: string;
  vencimentoId: string;
  dataServico: string | null;
  validadeImpressa: string | null;
  prestadorId?: string | null;
  arquivoId?: string | null;
  origemLeitura: "ia" | "manual";
  leituraIa?: unknown;
  conferidoPor?: string | null;
  chamadoId?: string | null;
}) {
  const [v] = await db.select().from(vencimentos).where(and(eq(vencimentos.id, p.vencimentoId), eq(vencimentos.organizacaoId, p.organizacaoId))).limit(1);
  if (!v) throw new Error("Vencimento não encontrado.");
  const [r] = await db
    .insert(servicosRegistrados)
    .values({
      organizacaoId: p.organizacaoId,
      condominioId: v.condominioId,
      vencimentoId: v.id,
      dataServico: p.dataServico,
      validadeImpressa: p.validadeImpressa,
      prestadorId: p.prestadorId ?? null,
      arquivoId: p.arquivoId ?? null,
      origemLeitura: p.origemLeitura,
      leituraIa: (p.leituraIa as object) ?? null,
      estado: "para_conferir",
      chamadoId: p.chamadoId ?? null,
    })
    .returning();
  if (p.conferidoPor) await conferirServico({ organizacaoId: p.organizacaoId, registroId: r.id, quem: p.conferidoPor });
  return r;
}

/** "Conferi": só depois disso o vencimento é recalculado. */
export async function conferirServico(p: { organizacaoId: string; registroId: string; quem: string; dataServico?: string | null; validadeImpressa?: string | null }) {
  const [r] = await db.select().from(servicosRegistrados).where(and(eq(servicosRegistrados.id, p.registroId), eq(servicosRegistrados.organizacaoId, p.organizacaoId))).limit(1);
  if (!r) throw new Error("Registro não encontrado.");
  if (r.estado !== "para_conferir") throw new Error("Este registro já foi conferido.");
  const [v] = await db.select().from(vencimentos).where(eq(vencimentos.id, r.vencimentoId)).limit(1);
  const dataServico = p.dataServico !== undefined ? p.dataServico : r.dataServico;
  const validadeImpressa = p.validadeImpressa !== undefined ? p.validadeImpressa : r.validadeImpressa;
  if (!dataServico && !validadeImpressa) throw new Error("Informe a data do serviço ou a validade impressa.");
  if (dataServico && diferencaDias(hojeISO(), dataServico) > 0) throw new Error("A data do serviço não pode ser futura.");
  const proximo = calcularProximo({ dataServico, validadeImpressa: v.usaValidadeImpressa || validadeImpressa ? validadeImpressa : null, periodicidadeMeses: v.periodicidadeMeses });
  if (!proximo) throw new Error("Não foi possível calcular o próximo vencimento: informe a validade impressa.");
  const dentro = v.proximo && dataServico ? diferencaDias(dataServico, v.proximo) >= 0 : null;
  await db
    .update(servicosRegistrados)
    .set({ estado: "conferido", conferidoPorNome: p.quem, conferidoEm: new Date(), dataServico, validadeImpressa, proximoAnterior: v.proximo, proximoCalculado: proximo, dentroDoPrazo: dentro })
    .where(eq(servicosRegistrados.id, r.id));
  await db.update(vencimentos).set({ proximo }).where(eq(vencimentos.id, v.id));
  await auditar({ organizacaoId: p.organizacaoId, condominioId: v.condominioId, ator: p.quem, acao: "vencimento.servico_conferido", alvo: v.id, detalhe: { dataServico, validadeImpressa, proximo } });
  return { proximo, dentro };
}

export async function recusarServico(p: { organizacaoId: string; registroId: string; quem: string }) {
  await db
    .update(servicosRegistrados)
    .set({ estado: "recusado", conferidoPorNome: p.quem, conferidoEm: new Date() })
    .where(and(eq(servicosRegistrados.id, p.registroId), eq(servicosRegistrados.organizacaoId, p.organizacaoId), eq(servicosRegistrados.estado, "para_conferir")));
}

export async function historicoServicos(organizacaoId: string, vencimentoIds: string[]) {
  if (vencimentoIds.length === 0) return [];
  return db
    .select()
    .from(servicosRegistrados)
    .where(and(eq(servicosRegistrados.organizacaoId, organizacaoId), inArray(servicosRegistrados.vencimentoId, vencimentoIds)))
    .orderBy(desc(servicosRegistrados.criadoEm));
}

export function textoVencimento(nome: string, proximo: string | null, hoje = hojeISO()): string {
  const s = situacaoVencimento(proximo, hoje);
  return `${nome}: ${s.texto.toLowerCase()}${proximo ? ` (${dataBR(proximo)})` : ""}`;
}
