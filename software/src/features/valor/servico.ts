import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { chamados, comunicadoEntregas, comunicados, despesas, duvidas, parametrosValor, rotinaItens, servicosRegistrados } from "@/db/schema";
import { hojeISO, instanteLocal, somarDias } from "@/lib/negocio/datas";
import { numerosHoje } from "@/features/carteira/consultas";
import { prestadoresDoCondominio } from "@/features/prestadores/servico";

/**
 * Painel de valor: MEDIDO (contagens do banco) e ESTIMADO (parâmetros declarados) em blocos
 * que nunca se somam. Tudo calculado do banco, sem número fixo no código.
 */
export function mediana(l: number[]): number | null {
  if (l.length === 0) return null;
  const s = [...l].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

export async function parametrosDaOrganizacao(organizacaoId: string) {
  const [p] = await db.select().from(parametrosValor).where(eq(parametrosValor.organizacaoId, organizacaoId)).limit(1);
  return p ?? { organizacaoId, minutosPorDuvida: 4, minutosPorDocumentoLido: 5, valorHoraCentavos: 8000, versao: 1 };
}

export async function painelDeValor(organizacaoId: string, condominioId: string, hoje = hojeISO()) {
  const inicio30 = instanteLocal(somarDias(hoje, -30));
  const de30 = somarDias(hoje, -30);
  const ontem = somarDias(hoje, -1);
  const inicio12m = instanteLocal(somarDias(hoje, -365));
  const [servicos, itens, chs, dvs, desp, coms, n, prests, params] = await Promise.all([
    db.select().from(servicosRegistrados).where(and(eq(servicosRegistrados.condominioId, condominioId), eq(servicosRegistrados.estado, "conferido"), gte(servicosRegistrados.conferidoEm, inicio12m))),
    db.select().from(rotinaItens).where(and(eq(rotinaItens.condominioId, condominioId))),
    db.select().from(chamados).where(and(eq(chamados.condominioId, condominioId), eq(chamados.natureza, "manutencao"), gte(chamados.abertoEm, inicio30))),
    db.select().from(duvidas).where(and(eq(duvidas.condominioId, condominioId), gte(duvidas.criadoEm, inicio30))),
    db.select().from(despesas).where(and(eq(despesas.condominioId, condominioId), gte(despesas.criadoEm, inicio30))),
    db.select({ id: comunicados.id, exemplo: comunicados.exemplo }).from(comunicados).where(and(eq(comunicados.condominioId, condominioId), eq(comunicados.estado, "enviado"))),
    numerosHoje(organizacaoId, condominioId, hoje),
    prestadoresDoCondominio(organizacaoId, condominioId),
    parametrosDaOrganizacao(organizacaoId),
  ]);
  const comPrazo = servicos.filter((s) => s.dentroDoPrazo !== null);
  const itens30 = itens.filter((i) => i.data >= de30 && i.data <= ontem);
  const resolvidos = chs.filter((c) => c.resolvidoEm);
  const horas = resolvidos.map((c) => (c.resolvidoEm!.getTime() - c.abertoEm.getTime()) / 3600000);
  const respondidasDocs = dvs.filter((d) => d.estado === "respondida_documentos").length;
  const recibosIa = desp.filter((d) => d.origem === "ia").length;
  const entregas = coms.length ? await db.select().from(comunicadoEntregas).where(inArray(comunicadoEntregas.comunicadoId, coms.map((c) => c.id))) : [];
  const entregues = entregas.length;
  const lidos = entregas.filter((e) => e.lidoEm).length;
  const minutos = respondidasDocs * params.minutosPorDuvida + recibosIa * params.minutosPorDocumentoLido;
  return {
    medido: {
      servicosDentro: { dentro: comPrazo.filter((s) => s.dentroDoPrazo).length, total: comPrazo.length },
      vencidos: n.vencidos.length,
      vencendo: n.vencendo.length,
      rotinas: { feitos: itens30.filter((i) => i.estado === "feito").length, previstos: itens30.length },
      chamados: { resolvidos: resolvidos.length, abertos: chs.length, medianaHoras: mediana(horas) },
      autoajuda: { resolvidos: chs.filter((c) => c.resolvidoNaEntrada).length, abertos: chs.length },
      duvidas: { respondidasDocs, total: dvs.length },
      prestadores: { emDia: prests.filter((p) => p.situacao.emDia).length, total: prests.length },
      boletosBeneficiarioDivergente: desp.filter((d) => (d.divergencias ?? []).some((x) => x.startsWith("Beneficiário impresso"))).length,
      comunicados: { lidos, entregues, exemplo: entregas.some((e) => e.exemplo) },
    },
    estimado: {
      respondidasDocs,
      recibosIa,
      minutosPorDuvida: params.minutosPorDuvida,
      minutosPorDocumentoLido: params.minutosPorDocumentoLido,
      valorHoraCentavos: params.valorHoraCentavos,
      minutos,
      valorCentavos: Math.round((minutos / 60) * params.valorHoraCentavos),
    },
  };
}

export type PainelValor = Awaited<ReturnType<typeof painelDeValor>>;

export function pct(a: number, b: number): string {
  if (!b) return "—";
  return `${((a / b) * 100).toFixed(1).replace(".", ",")}%`;
}
