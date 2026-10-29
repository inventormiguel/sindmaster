import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { organizacoes, usuarios, type PapelUsuario, type TipoConta } from "@/db/schema";
import { protocoloSeguro } from "@/lib/url-publica";
import { COOKIE_SESSAO, DURACAO_SESSAO_S, assinarSessao, verificarSessao } from "./token";

export type UsuarioLogado = {
  id: string;
  nome: string;
  email: string;
  papel: PapelUsuario;
  organizacao: { id: string; nome: string; tipo: TipoConta; isDemo: boolean };
};

export async function iniciarSessao(uid: string, oid: string) {
  const token = await assinarSessao({ uid, oid });
  const jar = await cookies();
  jar.set(COOKIE_SESSAO, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: protocoloSeguro(await headers()),
    path: "/",
    maxAge: DURACAO_SESSAO_S,
  });
}

export async function encerrarSessao() {
  const jar = await cookies();
  jar.delete(COOKIE_SESSAO);
}

export async function usuarioAtual(): Promise<UsuarioLogado | null> {
  const jar = await cookies();
  const sessao = await verificarSessao(jar.get(COOKIE_SESSAO)?.value);
  if (!sessao) return null;
  const [linha] = await db
    .select({
      id: usuarios.id,
      nome: usuarios.nome,
      email: usuarios.email,
      papel: usuarios.papel,
      orgId: organizacoes.id,
      orgNome: organizacoes.nome,
      orgTipo: organizacoes.tipo,
      orgDemo: organizacoes.isDemo,
    })
    .from(usuarios)
    .innerJoin(organizacoes, eq(organizacoes.id, usuarios.organizacaoId))
    .where(eq(usuarios.id, sessao.uid))
    .limit(1);
  if (!linha || linha.orgId !== sessao.oid) return null;
  return {
    id: linha.id,
    nome: linha.nome,
    email: linha.email,
    papel: linha.papel,
    organizacao: { id: linha.orgId, nome: linha.orgNome, tipo: linha.orgTipo, isDemo: linha.orgDemo },
  };
}

/**
 * Exige usuário logado. Sessão órfã (banco recriado, usuário apagado) vai para a
 * rota que limpa o cookie e manda ao login, em vez de mostrar um painel vazio.
 */
export async function exigirUsuario(): Promise<UsuarioLogado> {
  const u = await usuarioAtual();
  if (!u) redirect("/api/auth/limpar-sessao");
  return u;
}

/** Permissões do painel por papel (admin / síndico / conselho / equipe). O acesso a cada condomínio fica em lib/negocio/acesso.ts. */
export type AcaoPainel = "gerenciar_condominios" | "gerenciar_telegram" | "enviar_avisos" | "gerenciar_integracoes";

const PERMISSOES: Record<PapelUsuario, AcaoPainel[]> = {
  admin: ["gerenciar_condominios", "gerenciar_telegram", "enviar_avisos", "gerenciar_integracoes"],
  sindico: ["gerenciar_telegram", "enviar_avisos"],
  conselho: [],
  equipe: ["gerenciar_telegram", "enviar_avisos"],
};

export function pode(usuario: Pick<UsuarioLogado, "papel">, acao: AcaoPainel): boolean {
  return PERMISSOES[usuario.papel]?.includes(acao) ?? false;
}

export async function exigirPermissao(acao: AcaoPainel): Promise<UsuarioLogado> {
  const u = await exigirUsuario();
  if (!pode(u, acao)) throw new Error("Seu perfil não tem permissão para esta ação.");
  return u;
}
