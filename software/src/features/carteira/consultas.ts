import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import {
  alertas,
  chamados,
  despesas,
  duvidas,
  regrasCategoria,
  prestadorDocumentos,
  rotinaItens,
  rotinaModelos,
  servicosRegistrados,
  vencimentos,
} from "@/db/schema";
import { hojeISO, somarDias } from "@/lib/negocio/datas";
import { situacaoVencimento } from "@/features/vencimentos/servico";
import { prestadoresDoCondominio } from "@/features/prestadores/servico";
import { gerarItensDoDia } from "@/features/rotinas/servico";
import { ORDEM_URGENCIA } from "@/features/chamados/servico";

export const ESTADOS_ABERTOS = ["novo", "com_responsavel", "aguardando_prestador", "agendado"] as const;

/** Números da página "Hoje" (os mesmos das listas filtradas: T-HJ-01). */
export async function numerosHoje(organizacaoId: string, condominioId: string, hoje = hojeISO()) {
  await gerarItensDoDia(organizacaoId, condominioId, hoje);
  const [vencs, itensHoje, chs, dvs, desp, docsRasc, servRasc, alertasAbertos, prests] = await Promise.all([
    db.select().from(vencimentos).where(and(eq(vencimentos.organizacaoId, organizacaoId), eq(vencimentos.condominioId, condominioId), eq(vencimentos.estadoConferencia, "ativo"))),
    db
      .select({ item: rotinaItens, modelo: rotinaModelos })
      .from(rotinaItens)
      .innerJoin(rotinaModelos, eq(rotinaModelos.id, rotinaItens.modeloId))
      .where(and(eq(rotinaItens.organizacaoId, organizacaoId), eq(rotinaItens.condominioId, condominioId), eq(rotinaItens.data, hoje))),
    db.select().from(chamados).where(and(eq(chamados.organizacaoId, organizacaoId), eq(chamados.condominioId, condominioId), inArray(chamados.estado, [...ESTADOS_ABERTOS, "resolvido", "aguardando_confirmacao"]))),
    db.select().from(duvidas).where(and(eq(duvidas.organizacaoId, organizacaoId), eq(duvidas.condominioId, condominioId), inArray(duvidas.estado, ["encaminhada", "aguardando_envio"]))),
    db.select().from(despesas).where(and(eq(despesas.organizacaoId, organizacaoId), eq(despesas.condominioId, condominioId), inArray(despesas.estado, ["para_conferir", "bloqueada", "aguardando_aprovacao"]))),
    db.select({ id: prestadorDocumentos.id, prestadorId: prestadorDocumentos.prestadorId }).from(prestadorDocumentos).where(and(eq(prestadorDocumentos.organizacaoId, organizacaoId), eq(prestadorDocumentos.estado, "para_conferir"))),
    db.select({ id: servicosRegistrados.id }).from(servicosRegistrados).where(and(eq(servicosRegistrados.organizacaoId, organizacaoId), eq(servicosRegistrados.condominioId, condominioId), eq(servicosRegistrados.estado, "para_conferir"))),
    db.select().from(alertas).where(and(eq(alertas.organizacaoId, organizacaoId), eq(alertas.condominioId, condominioId), isNull(alertas.fechadoEm))),
    prestadoresDoCondominio(organizacaoId, condominioId),
  ]);
  const regras = await db.select().from(regrasCategoria).where(eq(regrasCategoria.condominioId, condominioId));
  const comSituacao = vencs.map((v) => ({ ...v, situacao: situacaoVencimento(v.proximo, hoje) }));
  const vencidos = comSituacao.filter((v) => v.situacao.vencido).sort((a, b) => (a.proximo ?? "").localeCompare(b.proximo ?? ""));
  const vencendo = comSituacao.filter((v) => v.situacao.vencendo30).sort((a, b) => (a.proximo ?? "").localeCompare(b.proximo ?? ""));
  const abertos = chs.filter((c) => (ESTADOS_ABERTOS as readonly string[]).includes(c.estado)).sort((a, b) => ORDEM_URGENCIA.indexOf(b.urgencia) - ORDEM_URGENCIA.indexOf(a.urgencia));
  const idsPrest = new Set(prests.map((p) => p.id));
  const docsDoCond = docsRasc.filter((d) => idsPrest.has(d.prestadorId));
  const rascunhos = {
    despesas: desp.length,
    respostas: dvs.filter((d) => d.estado === "aguardando_envio").length,
    documentos: docsDoCond.length + servRasc.length,
  };
  return {
    vencidos,
    vencendo,
    rotinasHoje: { previstos: itensHoje.length, feitos: itensHoje.filter((i) => i.item.estado === "feito").length, naoFeitos: itensHoje.filter((i) => i.item.estado === "nao_feito").length, itens: itensHoje },
    chamadosAbertos: abertos,
    /** Parados acima do prazo da categoria (em vermelho no Hoje e no resumo). */
    chamadosParados: abertos.filter((c) => {
      const prazo = regras.find((r) => r.categoria === c.categoria)?.prazoHoras ?? 72;
      return Date.now() - c.abertoEm.getTime() > prazo * 3600000;
    }),
    chamadosPorUrgencia: Object.fromEntries(ORDEM_URGENCIA.map((u) => [u, abertos.filter((c) => c.urgencia === u).length])) as Record<string, number>,
    aguardandoConfirmacao: chs.filter((c) => c.estado === "aguardando_confirmacao").length,
    resolvidosSemMorador: chs.filter((c) => c.estado === "resolvido").length,
    duvidasEsperando: dvs.filter((d) => d.estado === "encaminhada"),
    rascunhos,
    totalRascunhos: rascunhos.despesas + rascunhos.respostas + rascunhos.documentos,
    prestadoresComDocVencido: prests.filter((p) => !p.situacao.emDia),
    prestadoresComDocVencendo: prests.filter((p) => p.situacao.emDia && p.situacao.vencendo.length > 0),
    alertasAbertos,
    ontem: somarDias(hoje, -1),
  };
}

export type NumerosHoje = Awaited<ReturnType<typeof numerosHoje>>;
