import { beforeAll, describe, expect, it } from "vitest";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { chamados, condominios, despesas, duvidas, organizacoes, pessoas, prestadorDocumentos, rotinaItens, trechos, unidades, vencimentos } from "@/db/schema";
import { semear } from "@/db/seed";
import { prepararBanco } from "./ajuda";
import { hojeISO, somarDias } from "@/lib/negocio/datas";
import { numerosHoje } from "@/features/carteira/consultas";
import { montarResumoDiario } from "@/features/resumos/servico";
import { painelDeValor } from "@/features/valor/servico";
import { dividirEmArtigos } from "@/features/documentos/divisao";
import { REGIMENTO } from "@/db/seed/dados";

let orgId = "";
let condId = "";

beforeAll(async () => {
  await prepararBanco();
  await semear();
  const [o] = await db.select().from(organizacoes).where(eq(organizacoes.isDemo, true));
  orgId = o.id;
  const [c] = await db.select().from(condominios).where(and(eq(condominios.organizacaoId, orgId), eq(condominios.nome, "Residencial Jardim das Araucárias")));
  condId = c.id;
}, 120000);

describe("seed da demonstração (6.3.1)", () => {
  it("é idempotente", async () => {
    const r = await semear();
    expect(r.criouDados).toBe(false);
    const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(condominios).where(eq(condominios.organizacaoId, orgId));
    expect(n).toBe(2);
  });

  it("48 unidades, 41 com morador cadastrado (a 302 com proprietária e inquilino), ninguém com Telegram nem telefone", async () => {
    const us = await db.select().from(unidades).where(eq(unidades.condominioId, condId));
    expect(us).toHaveLength(48);
    const mor = await db.select().from(pessoas).where(and(eq(pessoas.condominioId, condId), eq(pessoas.papel, "morador")));
    expect(new Set(mor.map((m) => m.unidadeId)).size).toBe(41);
    expect(mor.filter((m) => m.unidade === "302").map((m) => m.relacaoUnidade).sort()).toEqual(["inquilino", "proprietario"]);
    const todas = await db.select().from(pessoas).where(eq(pessoas.organizacaoId, orgId));
    expect(todas.every((p) => !p.telegramChatId && !p.telefone)).toBe(true);
  });

  it("vencimentos: 1 vencido há 12 dias, 4 em 30 dias, PMOC não ativado", async () => {
    const n = await numerosHoje(orgId, condId);
    expect(n.vencidos).toHaveLength(1);
    expect(n.vencidos[0].situacao.texto).toBe("Fora do prazo cadastrado há 12 dias");
    expect(n.vencendo).toHaveLength(4);
    const pmoc = (await db.select().from(vencimentos).where(eq(vencimentos.condominioId, condId))).find((v) => v.modeloChave === "pmoc");
    expect(pmoc?.estadoConferencia).toBe("nao_conferido");
  });

  it("T-HJ-01: Hoje bate com as listas (3 chamados abertos, 2 dúvidas esperando, 1 para conferir, Hidro Limpa com CND vencida)", async () => {
    const n = await numerosHoje(orgId, condId);
    expect(n.chamadosAbertos).toHaveLength(3);
    expect(n.duvidasEsperando).toHaveLength(2);
    expect(n.rascunhos.despesas).toBe(1);
    expect(n.prestadoresComDocVencido.map((p) => p.razaoSocial)).toEqual(["Hidro Limpa Reservatórios (fictícia)"]);
    const abertosLista = await db.select().from(chamados).where(and(eq(chamados.condominioId, condId), eq(chamados.natureza, "manutencao")));
    expect(abertosLista.filter((c) => ["novo", "com_responsavel", "aguardando_prestador", "agendado"].includes(c.estado))).toHaveLength(3);
  });

  it("T-RS-01: o resumo traz o vencido da caixa d'água", async () => {
    const r = await montarResumoDiario(orgId, condId);
    expect(r.texto).toContain("1 vencido: limpeza e desinfecção dos reservatórios, fora do prazo cadastrado há 12 dias");
  });

  it("T-DC-01: o regimento do seed vira 10 artigos", async () => {
    expect(dividirEmArtigos(REGIMENTO, "Regimento Interno")).toHaveLength(10);
    const t = await db.select().from(trechos).where(eq(trechos.condominioId, condId));
    expect(t.filter((x) => x.rotulo.startsWith("Regimento Interno, art.")).length).toBe(10);
  });

  it("T-VAL-01: painel de valor calculado do banco", async () => {
    const v = await painelDeValor(orgId, condId);
    expect(v.medido.servicosDentro).toEqual({ dentro: 14, total: 16 });
    expect(v.medido.vencidos).toBe(1);
    expect(v.medido.vencendo).toBe(4);
    expect(v.medido.chamados.resolvidos).toBe(11);
    expect(v.medido.chamados.abertos).toBe(14);
    expect(v.medido.chamados.medianaHoras).toBe(18);
    expect(v.medido.autoajuda.resolvidos).toBe(3);
    expect(v.medido.duvidas).toEqual({ respondidasDocs: 15, total: 23 });
    expect(v.medido.prestadores).toEqual({ emDia: 5, total: 6 });
    expect(v.medido.boletosBeneficiarioDivergente).toBe(1);
    expect(v.medido).not.toHaveProperty("comunicados");
    const f = v.medido.rotinas.feitos / v.medido.rotinas.previstos;
    expect(f).toBeGreaterThan(0.93);
    expect(f).toBeLessThan(0.96);
    expect(v.estimado.minutos).toBe(15 * 4 + 19 * 5);
    expect(v.estimado.valorCentavos).toBe(20667);
  });

  it("despesas: 16 lançadas somam R$ 23.418,70", async () => {
    const l = await db.select().from(despesas).where(and(eq(despesas.condominioId, condId), eq(despesas.estado, "lancada")));
    expect(l).toHaveLength(16);
    expect(l.reduce((s, d) => s + (d.valorCentavos ?? 0), 0)).toBe(2341870);
  });

  it("CRF da Hidro Limpa vence em D+18", async () => {
    const docs = await db.select().from(prestadorDocumentos);
    expect(docs.some((d) => d.tipo === "crf_fgts" && d.validade === somarDias(hojeISO(), 18))).toBe(true);
  });

  it("rotinas de exemplo nos últimos 30 dias", async () => {
    const it = await db.select().from(rotinaItens).where(eq(rotinaItens.condominioId, condId));
    expect(it.length).toBeGreaterThan(380);
    void duvidas;
  });
});
