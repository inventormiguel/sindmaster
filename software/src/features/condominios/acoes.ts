"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { acessoCondominios, condominios, pessoas, regrasCategoria, unidades, usuarios, type Urgencia } from "@/db/schema";
import { exigirPermissao } from "@/lib/auth/sessao";
import { formatarCnpj } from "@/lib/formato";
import { cnpjValido } from "@/lib/negocio/cnpj";
import { consultarCnpj } from "@/integrations/brasilapi";
import { consultarCep } from "@/integrations/viacep";
import { criarVencimentosDoCondominio } from "@/features/vencimentos/servico";
import { auditar } from "@/lib/negocio/auditoria";
import { NOMES_CONDOMINIOS_DEMO } from "@/db/seed/dados";
import { criarCondominioDemo } from "@/db/seed/condominio-demo";
import { gerarUnidades } from "./unidades";

export type EstadoCondominio = { erro?: string; ok?: string } | null;

const vazioParaNulo = (v: FormDataEntryValue | null) => {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
};

const esquema = z.object({
  nome: z.string().min(2, "Informe o nome do condomínio."),
  cnpj: z
    .string()
    .nullable()
    .refine((v) => v === null || cnpjValido(v), "CNPJ com dígitos verificadores inválidos."),
  cep: z
    .string()
    .nullable()
    .refine((v) => v === null || v.replace(/\D/g, "").length === 8, "CEP com 8 dígitos."),
  endereco: z.string().nullable(),
  cidade: z.string().nullable(),
  uf: z
    .string()
    .nullable()
    .refine((v) => v === null || /^[A-Za-z]{2}$/.test(v), "UF com 2 letras (ex.: PR)."),
});

/** Unidades: gerador "torre A, 12 andares, 4 por andar" ou lista colada (uma por linha ou separadas por vírgula). */
export async function gerarListaUnidades(form: FormData): Promise<{ bloco: string; numero: string; andar: number | null }[]> {
  return gerarUnidades({
    lista: vazioParaNulo(form.get("listaUnidades")) ?? "",
    bloco: vazioParaNulo(form.get("bloco")) ?? "",
    tipo: form.get("tipoUnidade") === "casas" ? "casas" : "apartamentos",
    andares: vazioParaNulo(form.get("andares")) ?? "",
    porAndar: vazioParaNulo(form.get("porAndar")) ?? "",
  });
}

const REGRAS_PADRAO: [string, Urgencia, number][] = [
  ["hidraulica", "media", 48],
  ["eletrica", "alta", 24],
  ["iluminacao", "baixa", 72],
  ["elevador", "alta", 12],
  ["portoes", "media", 48],
  ["interfone", "baixa", 72],
  ["infiltracao", "media", 72],
  ["limpeza", "baixa", 72],
  ["area_comum", "baixa", 72],
  ["seguranca", "alta", 24],
  ["gas", "emergencia", 2],
  ["outra", "media", 72],
];

export async function criarCondominio(_prev: EstadoCondominio, form: FormData): Promise<EstadoCondominio> {
  const usuario = await exigirPermissao("gerenciar_condominios");
  const r = esquema.safeParse({
    nome: vazioParaNulo(form.get("nome")) ?? "",
    cnpj: vazioParaNulo(form.get("cnpj")),
    cep: vazioParaNulo(form.get("cep")),
    endereco: vazioParaNulo(form.get("endereco")),
    cidade: vazioParaNulo(form.get("cidade")),
    uf: vazioParaNulo(form.get("uf")),
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  let us: Awaited<ReturnType<typeof gerarListaUnidades>>;
  try {
    us = await gerarListaUnidades(form);
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Confira a lista de unidades." };
  }
  const avisos: string[] = [];
  let { endereco, cidade, uf } = r.data;
  if (r.data.cep && (!endereco || !cidade)) {
    const cep = await consultarCep(r.data.cep);
    if (cep.ok) {
      endereco = endereco ?? [cep.logradouro, cep.bairro].filter(Boolean).join(" · ");
      cidade = cidade ?? cep.cidade;
      uf = uf ?? cep.uf;
    } else avisos.push(`ViaCEP: ${cep.mensagem}`);
  }
  if (r.data.cnpj) {
    const c = await consultarCnpj(r.data.cnpj);
    avisos.push(c.ok ? `BrasilAPI: ${c.razaoSocial} (${c.situacao})` : `BrasilAPI: ${c.mensagem}`);
  }
  const cond = await db.transaction(async (tx) => {
    const [novo] = await tx
      .insert(condominios)
      .values({ organizacaoId: usuario.organizacao.id, nome: r.data.nome, cnpj: formatarCnpj(r.data.cnpj), cep: r.data.cep, endereco, cidade, uf: uf?.toUpperCase() ?? null, totalUnidades: us.length || null })
      .returning();
    if (us.length) await tx.insert(unidades).values(us.map((u) => ({ organizacaoId: usuario.organizacao.id, condominioId: novo.id, ...u })));
    return novo;
  });
  await criarVencimentosDoCondominio(usuario.organizacao.id, cond.id);
  await db.insert(regrasCategoria).values(REGRAS_PADRAO.map(([categoria, urgenciaPadrao, prazoHoras]) => ({ organizacaoId: usuario.organizacao.id, condominioId: cond.id, categoria, urgenciaPadrao, prazoHoras }))).onConflictDoNothing();
  await db.insert(pessoas).values({ organizacaoId: usuario.organizacao.id, condominioId: cond.id, nome: usuario.nome, papel: "sindico", usuarioId: usuario.id, contatoPlantao: true });
  if (usuario.papel !== "admin") await db.insert(acessoCondominios).values({ organizacaoId: usuario.organizacao.id, usuarioId: usuario.id, condominioId: cond.id, papel: "sindico" }).onConflictDoNothing();
  await auditar({ organizacaoId: usuario.organizacao.id, condominioId: cond.id, ator: usuario.nome, acao: "condominio.criado", alvo: cond.id });
  revalidatePath("/app/condominios");
  revalidatePath("/app/unidades");
  revalidatePath("/app");
  return { ok: `Condomínio "${r.data.nome}" cadastrado com ${us.length} unidade(s) e os vencimentos para conferir.${avisos.length ? ` ${avisos.join(" · ")}` : ""}` };
}

/** Só na organização de demonstração: cria uma cópia completa do caso da caixa d'água. */
export async function criarCondominioDemonstracao() {
  const usuario = await exigirPermissao("gerenciar_condominios");
  if (!usuario.organizacao.isDemo) throw new Error("Disponível só na conta de demonstração.");
  const existentes = await db.select({ nome: condominios.nome }).from(condominios).where(eq(condominios.organizacaoId, usuario.organizacao.id));
  const usados = new Set(existentes.map((x) => x.nome));
  const base = NOMES_CONDOMINIOS_DEMO.find((n) => !usados.has(`${n} (fictício)`)) ?? NOMES_CONDOMINIOS_DEMO[existentes.length % NOMES_CONDOMINIOS_DEMO.length];
  const nome = usados.has(`${base} (fictício)`) ? `${base} ${existentes.length + 1} (fictício)` : `${base} (fictício)`;
  const [jose] = await db.select().from(usuarios).where(and(eq(usuarios.organizacaoId, usuario.organizacao.id), eq(usuarios.papel, "sindico"))).limit(1);
  const c = await criarCondominioDemo({ organizacaoId: usuario.organizacao.id, nome, completo: true, sindicoUsuarioId: jose?.id ?? null, endereco: "Endereço fictício" });
  revalidatePath("/app");
  redirect(`/app/hoje?c=${c.id}`);
}

export async function definirAcesso(form: FormData) {
  const usuario = await exigirPermissao("gerenciar_integracoes");
  const condominioId = String(form.get("condominioId") ?? "");
  const usuarioId = String(form.get("usuarioId") ?? "");
  const papel = String(form.get("papel") ?? "");
  const [c] = await db.select().from(condominios).where(and(eq(condominios.id, condominioId), eq(condominios.organizacaoId, usuario.organizacao.id))).limit(1);
  const [u] = await db.select().from(usuarios).where(and(eq(usuarios.id, usuarioId), eq(usuarios.organizacaoId, usuario.organizacao.id))).limit(1);
  if (c && u) {
    if (papel === "nenhum") await db.delete(acessoCondominios).where(and(eq(acessoCondominios.usuarioId, u.id), eq(acessoCondominios.condominioId, c.id)));
    else if (["sindico", "equipe", "conselho"].includes(papel)) {
      await db
        .insert(acessoCondominios)
        .values({ organizacaoId: usuario.organizacao.id, usuarioId: u.id, condominioId: c.id, papel: papel as "sindico" })
        .onConflictDoUpdate({ target: [acessoCondominios.usuarioId, acessoCondominios.condominioId], set: { papel: papel as "sindico" } });
    }
    await auditar({ organizacaoId: usuario.organizacao.id, condominioId: c.id, ator: usuario.nome, acao: "acesso.definido", alvo: u.id, detalhe: { papel } });
  }
  revalidatePath("/app/condominios");
}
