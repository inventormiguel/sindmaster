import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "@/db";
import { condominios, duvidas, pessoas, resumos, rotinaItens, rotinaModelos } from "@/db/schema";
import { dataBR, diferencaDias, hojeISO, instanteLocal, somarDias } from "@/lib/negocio/datas";
import { enfileirarAvisoPessoa } from "@/lib/telegram/avisos";
import { agendarEnvioDaFila } from "@/lib/negocio/fila";
import { numerosHoje } from "@/features/carteira/consultas";
import { diasDeAvisoDocumento, ROTULO_DOC } from "@/features/prestadores/servico";
import { ROTULO_URGENCIA } from "@/features/chamados/servico";
import { deveAvisarVencimento } from "@/features/vencimentos/servico";

/**
 * Resumo diário do síndico (modelo fixo do código, sem IA): vencidos e vencendo,
 * rotinas de ontem não feitas (por ITEM, nunca por pessoa), chamados abertos (emergências primeiro),
 * dúvidas (o que a IA respondeu e o que encaminhou), rascunhos e documentos de prestador.
 */
export async function montarResumoDiario(organizacaoId: string, condominioId: string, hoje = hojeISO()) {
  const [c] = await db.select().from(condominios).where(eq(condominios.id, condominioId)).limit(1);
  const n = await numerosHoje(organizacaoId, condominioId, hoje);
  const ontem = somarDias(hoje, -1);
  const itensOntem = await db
    .select({ item: rotinaItens, modelo: rotinaModelos })
    .from(rotinaItens)
    .innerJoin(rotinaModelos, eq(rotinaModelos.id, rotinaItens.modeloId))
    .where(and(eq(rotinaItens.condominioId, condominioId), eq(rotinaItens.data, ontem)));
  const naoFeitosOntem = itensOntem.filter((i) => i.item.estado !== "feito");
  const inicioOntem = instanteLocal(ontem);
  const dvOntem = await db.select().from(duvidas).where(and(eq(duvidas.condominioId, condominioId), gte(duvidas.criadoEm, inicioOntem)));
  const iaRespondeu = dvOntem.filter((d) => d.estado === "respondida_documentos" || d.estado === "aguardando_envio").length;
  const encaminhadas = dvOntem.filter((d) => d.estado === "encaminhada" || d.estado === "respondida_sindico").length;

  const linhas: string[] = [];
  const v = n.vencidos;
  if (v.length) linhas.push(`${v.length} vencido${v.length > 1 ? "s" : ""}: ${v.map((x) => `${x.nome.toLowerCase()}, ${x.situacao.texto.toLowerCase()}`).join("; ")}`);
  else linhas.push("Nenhum vencimento fora do prazo cadastrado");
  // Vencendo: só nos marcos proporcionais à periodicidade (menos notificação; o /hoje mostra todos).
  const noMarco = n.vencendo.filter((x) => deveAvisarVencimento(x.proximo!, hoje, x.periodicidadeMeses, x.usaValidadeImpressa));
  if (noMarco.length) linhas.push(`Vencendo: ${noMarco.map((x) => `${x.nome} em ${dataBR(x.proximo)} (${x.situacao.texto.toLowerCase()})`).join("; ")}`);
  linhas.push(
    itensOntem.length
      ? `Rotinas de ontem: ${itensOntem.length - naoFeitosOntem.length} de ${itensOntem.length} itens feitos${naoFeitosOntem.length ? `; sem registro: ${naoFeitosOntem.slice(0, 5).map((i) => i.modelo.item + (i.item.motivo ? ` (${i.item.motivo})` : "")).join("; ")}${naoFeitosOntem.length > 5 ? "…" : ""}` : ""}`
      : "Rotinas de ontem: nenhum item previsto",
  );
  const ab = n.chamadosAbertos;
  const parados = new Set(n.chamadosParados.map((c) => c.id));
  linhas.push(
    ab.length
      ? `${ab.length} chamado${ab.length > 1 ? "s" : ""} aberto${ab.length > 1 ? "s" : ""}: ${ab.slice(0, 4).map((x) => `nº ${x.numero} ${ROTULO_URGENCIA[x.urgencia].toLowerCase()} (${diferencaDias(hojeISO(x.abertoEm), hoje)} d)${parados.has(x.id) ? " PARADO acima do prazo" : ""}`).join("; ")}`
      : "Nenhum chamado aberto",
  );
  const assumidas = dvOntem.filter((d) => d.assumidaEm).map((d) => (d.assumidaEm!.getTime() - d.criadoEm.getTime()) / 3600000);
  const tempo = assumidas.length ? `; uma pessoa assumiu em média em ${(assumidas.reduce((a, b) => a + b, 0) / assumidas.length).toFixed(1).replace(".", ",")} h` : "";
  linhas.push(`Dúvidas: ${n.duvidasEsperando.length} esperando você; nas últimas 24 h a IA respondeu ${iaRespondeu} e encaminhou ${encaminhadas}${tempo}`);
  if (n.totalRascunhos) linhas.push(`${n.totalRascunhos} rascunho(s) para aprovar (envie /aprovar)`);
  for (const p of n.prestadoresComDocVencido) linhas.push(`${p.razaoSocial} com ${p.situacao.vencidos.map((d) => `${ROTULO_DOC[d.tipo]} vencida desde ${dataBR(d.validade)}`).join("; ")}`);
  for (const p of n.prestadoresComDocVencendo) {
    const docs = p.situacao.vencendo.filter((d) => {
      const doc = p.documentos.find((x) => x.tipo === d.tipo && x.validade === d.validade);
      return diasDeAvisoDocumento(doc?.emitidoEm ?? null, d.validade).includes(d.dias);
    });
    if (docs.length) linhas.push(`${p.razaoSocial}: ${docs.map((d) => `${ROTULO_DOC[d.tipo]} vence em ${dataBR(d.validade)}`).join("; ")}`);
  }
  for (const a of n.alertasAbertos.filter((x) => x.tipo === "dados_pagamento")) linhas.push(`Alerta: dados de pagamento de ${String(a.fatos?.prestador ?? "prestador")} mudaram; confirme por telefone`);
  const texto = `${c?.nome ?? "Condomínio"} · resumo de ${dataBR(hoje)}\n${linhas.map((l) => `• ${l}`).join("\n")}`;
  return { texto, fatos: { vencidos: v.length, vencendo: n.vencendo.length, naoFeitosOntem: naoFeitosOntem.length, chamadosAbertos: ab.length, duvidasEsperando: n.duvidasEsperando.length, rascunhos: n.totalRascunhos } };
}

/** Grava o resumo do dia (idempotente) e enfileira para os síndicos do condomínio com Telegram. */
export async function gerarResumoDoCondominio(condominioId: string, agora = new Date()) {
  const hoje = hojeISO(agora);
  const [c] = await db.select().from(condominios).where(eq(condominios.id, condominioId)).limit(1);
  if (!c) return { enfileirados: 0 };
  const r = await montarResumoDiario(c.organizacaoId, c.id, hoje);
  await db
    .insert(resumos)
    .values({ organizacaoId: c.organizacaoId, condominioId: c.id, data: hoje, fatos: r.fatos, texto: r.texto })
    .onConflictDoUpdate({ target: [resumos.condominioId, resumos.data], set: { texto: r.texto, fatos: r.fatos } });
  const sindicos = await db.select({ id: pessoas.id }).from(pessoas).where(and(eq(pessoas.condominioId, c.id), inArray(pessoas.papel, ["sindico"])));
  let enfileirados = 0;
  for (const s of sindicos) {
    const e = await enfileirarAvisoPessoa({ organizacaoId: c.organizacaoId, pessoaId: s.id, categoria: "resumo", texto: r.texto, chaveIdempotencia: `resumo:${c.id}:${hoje}:${s.id}` });
    enfileirados += e.enfileirados;
  }
  if (enfileirados) agendarEnvioDaFila(c.organizacaoId);
  return { enfileirados };
}
