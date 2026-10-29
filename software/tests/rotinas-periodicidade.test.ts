import { beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { rotinaItens, rotinaModelos } from "@/db/schema";
import { gerarItensDoDia, modeloCaiNoDia } from "@/features/rotinas/servico";
import { lerPeriodicidadeRotina } from "@/features/rotinas/periodicidade";
import { criarCenario, prepararBanco } from "./ajuda";

function formulario(periodicidade: string, dia = "31", mes = "11") {
  const f = new FormData();
  f.set("periodicidade", periodicidade);
  f.set("diaMes", dia);
  f.set("mesReferencia", mes);
  f.append("dias", "1");
  return f;
}

describe("periodicidades das rotinas", () => {
  it("aceita as cinco opções e grava apenas os campos aplicáveis", () => {
    for (const periodicidade of ["diaria", "semanal", "mensal", "trimestral", "anual"]) {
      const r = lerPeriodicidadeRotina(formulario(periodicidade));
      expect(r.periodicidade).toBe(periodicidade);
      expect(r.diasSemana).toEqual(["diaria", "semanal"].includes(periodicidade) ? [1] : null);
      expect(r.diaMes).toBe(["diaria", "semanal"].includes(periodicidade) ? null : 31);
      expect(r.mesReferencia).toBe(["trimestral", "anual"].includes(periodicidade) ? 11 : null);
    }
  });

  it("recusa periodicidade, dia e mês inválidos", () => {
    expect(() => lerPeriodicidadeRotina(formulario("outra"))).toThrow();
    for (const dia of ["", "0", "32", "2.5", "abc"]) expect(() => lerPeriodicidadeRotina(formulario("mensal", dia))).toThrow();
    for (const mes of ["", "0", "13", "2.5", "abc"]) expect(() => lerPeriodicidadeRotina(formulario("trimestral", "1", mes))).toThrow();
  });

  it("trimestral repete a cada três meses, atravessa o ano e preserva o dia 31", () => {
    const m = lerPeriodicidadeRotina(formulario("trimestral"));
    for (const data of ["2026-11-30", "2027-02-28", "2027-05-31", "2027-08-31", "2027-11-30", "2028-02-29"]) expect(modeloCaiNoDia(m, data)).toBe(true);
    for (const data of ["2026-12-31", "2027-01-31", "2027-02-27", "2027-05-30", "2028-02-28"]) expect(modeloCaiNoDia(m, data)).toBe(false);
  });

  it("anual ocorre só no mês escolhido e ajusta 29 de fevereiro", () => {
    const m = lerPeriodicidadeRotina(formulario("anual", "29", "2"));
    for (const data of ["2027-02-28", "2028-02-29", "2029-02-28"]) expect(modeloCaiNoDia(m, data)).toBe(true);
    for (const data of ["2027-03-29", "2027-01-29", "2028-02-28"]) expect(modeloCaiNoDia(m, data)).toBe(false);
  });
});

describe("geração das novas periodicidades no banco", () => {
  beforeAll(prepararBanco);

  it("persiste a agenda, gera sem duplicar e mantém as organizações separadas", async () => {
    const a = await criarCenario("Rotinas A");
    const b = await criarCenario("Rotinas B");
    for (const c of [a, b]) {
      for (const periodicidade of ["trimestral", "anual"]) await db.insert(rotinaModelos).values({
        organizacaoId: c.org.id, condominioId: c.cond.id, item: periodicidade,
        ...lerPeriodicidadeRotina(formulario(periodicidade)),
      });
    }
    expect(await gerarItensDoDia(a.org.id, a.cond.id, "2026-11-30")).toBe(2);
    expect(await gerarItensDoDia(a.org.id, a.cond.id, "2026-11-30")).toBe(0);
    expect(await gerarItensDoDia(a.org.id, a.cond.id, "2026-12-31")).toBe(0);
    expect(await gerarItensDoDia(a.org.id, a.cond.id, "2027-02-28")).toBe(1);
    const outros = await db.select().from(rotinaItens).where(and(eq(rotinaItens.organizacaoId, b.org.id), eq(rotinaItens.condominioId, b.cond.id)));
    expect(outros).toHaveLength(0);
  });
});
