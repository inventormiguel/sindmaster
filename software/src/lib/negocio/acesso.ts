import "server-only";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { acessoCondominios, condominios } from "@/db/schema";
import { exigirUsuario, type UsuarioLogado } from "@/lib/auth/sessao";

/**
 * Acesso por condomínio:
 * - admin da organização: todos os condomínios dela (gestão);
 * - síndico/equipe: os condomínios em acesso_condominio com papel "sindico" (gestão);
 * - conselho: os condomínios com papel "conselho" (só leitura, sem dado pessoal).
 * Id de outra organização ou sem acesso = 404 (não revela que existe).
 */
export type PapelNoCondominio = "admin" | "sindico" | "conselho";
export type CondominioAcessivel = typeof condominios.$inferSelect & { papel: PapelNoCondominio };

export async function condominiosDoUsuario(u: Pick<UsuarioLogado, "id" | "papel" | "organizacao">): Promise<CondominioAcessivel[]> {
  const todos = await db.select().from(condominios).where(eq(condominios.organizacaoId, u.organizacao.id)).orderBy(asc(condominios.criadoEm), asc(condominios.nome));
  if (u.papel === "admin") return todos.map((c) => ({ ...c, papel: "admin" as const }));
  const acessos = await db
    .select()
    .from(acessoCondominios)
    .where(and(eq(acessoCondominios.usuarioId, u.id), eq(acessoCondominios.organizacaoId, u.organizacao.id)));
  const mapa = new Map(acessos.map((a) => [a.condominioId, a.papel]));
  return todos.filter((c) => mapa.has(c.id)).map((c) => ({ ...c, papel: (u.papel === "conselho" ? "conselho" : mapa.get(c.id)!) as PapelNoCondominio }));
}

export function podeGerir(papel: PapelNoCondominio) {
  return papel === "admin" || papel === "sindico";
}

async function resolver(id: string, u: UsuarioLogado, nivel: "gestao" | "leitura") {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const lista = await condominiosDoUsuario(u);
  const c = lista.find((x) => x.id === id);
  if (!c) return null;
  if (nivel === "gestao" && !podeGerir(c.papel)) return null;
  return c;
}

/** Para páginas: 404 quando não há acesso. */
export async function exigirCondominio(id: string, nivel: "gestao" | "leitura" = "gestao") {
  const usuario = await exigirUsuario();
  const condominio = await resolver(id, usuario, nivel);
  if (!condominio) notFound();
  return { usuario, condominio };
}

/** Para ações de servidor: erro quando não há acesso. */
export async function exigirCondominioAcao(id: string | null | undefined, nivel: "gestao" | "leitura" = "gestao") {
  const usuario = await exigirUsuario();
  const condominio = id ? await resolver(id, usuario, nivel) : null;
  if (!condominio) throw new Error("Condomínio não encontrado.");
  return { usuario, condominio };
}

export async function idsCondominiosDoUsuario(u: UsuarioLogado): Promise<string[]> {
  return (await condominiosDoUsuario(u)).map((c) => c.id);
}

export { inArray };
