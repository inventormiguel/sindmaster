import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db, fecharConexao } from "@/db";
import { condominios, unidades, usuarios } from "@/db/schema";
import { gerarUnidades } from "@/features/condominios/unidades";
import { criarCondominio } from "@/features/condominios/acoes";
import { exigirPermissao } from "@/lib/auth/sessao";
import { criarCenario, prepararBanco } from "./ajuda";

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/auth/sessao", async (original) => ({
  ...await original<typeof import("@/lib/auth/sessao")>(),
  exigirPermissao: vi.fn(),
}));

describe("interpretação das unidades", () => {
  it.each(["de 1 a 14", "1 a 14", "1 até 14", "1-14", "Casas de 1 a 14", "Casas:1 a 14", "Unidades de 1 a 14", "unidades 1 a 14", "Casas de 1 a 14, sem andar"])("expande %s em 14 casas", (lista) => {
    const resultado = gerarUnidades({ lista, tipo: "casas" });
    expect(resultado).toHaveLength(14);
    expect(resultado.map((u) => u.numero)).toEqual(Array.from({ length: 14 }, (_, i) => String(i + 1)));
    expect(resultado.every((u) => u.andar === null && u.bloco === "")).toBe(true);
  });

  it("não infere andares para casas com números maiores que 100", () => {
    expect(gerarUnidades({ lista: "Casas de 101 a 114" }).every((u) => u.andar === null)).toBe(true);
    expect(gerarUnidades({ lista: "101 a 114", tipo: "casas" }).every((u) => u.andar === null)).toBe(true);
  });

  it("mantém blocos, apartamentos e a ordem numérica", () => {
    expect(gerarUnidades({ lista: "A - 101\nA - 102\nB - 201" })).toEqual([
      { bloco: "A", numero: "101", andar: 1 },
      { bloco: "A", numero: "102", andar: 1 },
      { bloco: "B", numero: "201", andar: 2 },
    ]);
    expect(gerarUnidades({ lista: "14, 2 e 1, 10", tipo: "casas" }).map((u) => u.numero)).toEqual(["1", "2", "10", "14"]);
  });

  it("deduplica intervalos e listas sobrepostos antes de contar", () => {
    expect(gerarUnidades({ lista: "1 a 14, 2, 10 a 14", tipo: "casas" })).toHaveLength(14);
  });

  it("preserva zeros iniciais e aplica o bloco informado", () => {
    const us = gerarUnidades({ lista: "01 a 03", bloco: "A", tipo: "casas" });
    expect(us.map((u) => u.numero)).toEqual(["01", "02", "03"]);
    expect(us.every((u) => u.bloco === "A")).toBe(true);
  });

  it("continua gerando apartamentos por andar", () => {
    const us = gerarUnidades({ andares: "12", porAndar: "4", bloco: "A" });
    expect(us).toHaveLength(48);
    expect(us[0]).toEqual({ bloco: "A", numero: "101", andar: 1 });
    expect(us.at(-1)).toEqual({ bloco: "A", numero: "1204", andar: 12 });
  });

  it.each(["14 a 1", "1 a 99999", "um monte de casas", "1 a catorze"])("rejeita uma lista sem interpretação segura: %s", (lista) => {
    expect(() => gerarUnidades({ lista })).toThrow();
  });
});

describe("cadastro pelo servidor", () => {
  let organizacaoId: string;
  beforeAll(async () => {
    await prepararBanco();
    const { org } = await criarCenario("Cadastro de casas");
    organizacaoId = org.id;
    const [u] = await db.insert(usuarios).values({ organizacaoId, nome: "Responsável teste", email: "cadastro@teste.exemplo", senhaHash: "hash-de-teste", papel: "admin" }).returning();
    vi.mocked(exigirPermissao).mockResolvedValue({ id: u.id, nome: u.nome, email: u.email, papel: u.papel, organizacao: { id: org.id, nome: org.nome, tipo: org.tipo, isDemo: org.isDemo } });
  });
  afterAll(fecharConexao);

  it("grava as 14 casas e o total correto na organização autenticada", async () => {
    const form = new FormData();
    form.set("nome", "Condomínio de casas teste");
    form.set("tipoUnidade", "casas");
    form.set("listaUnidades", "de 1 a 14");
    const resultado = await criarCondominio(null, form);
    expect(resultado?.ok).toContain("14 unidade(s)");
    const [cond] = await db.select().from(condominios).where(and(eq(condominios.nome, "Condomínio de casas teste"), eq(condominios.organizacaoId, organizacaoId)));
    expect(cond.totalUnidades).toBe(14);
    const us = await db.select().from(unidades).where(eq(unidades.condominioId, cond.id));
    expect(us).toHaveLength(14);
    expect(us.every((u) => u.organizacaoId === organizacaoId && u.andar === null)).toBe(true);
    expect(new Set(us.map((u) => u.numero))).toEqual(new Set(Array.from({ length: 14 }, (_, i) => String(i + 1))));
  });

  it("não cria condomínio quando a lista é inválida", async () => {
    const form = new FormData();
    form.set("nome", "Cadastro inválido teste");
    form.set("listaUnidades", "de um a catorze");
    expect((await criarCondominio(null, form))?.erro).toContain("Não entendi");
    expect(await db.select().from(condominios).where(eq(condominios.nome, "Cadastro inválido teste"))).toHaveLength(0);
  });
});
