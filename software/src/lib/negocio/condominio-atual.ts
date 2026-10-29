import "server-only";
import { cookies } from "next/headers";
import { exigirUsuario, type UsuarioLogado } from "@/lib/auth/sessao";
import { condominiosDoUsuario, podeGerir, type CondominioAcessivel } from "./acesso";

/** Cookie do condomínio atual do painel (por navegador); `?c=<id>` na URL tem prioridade. */
export const COOKIE_CONDOMINIO = "gicon_condominio";

export type ContextoPagina = {
  usuario: UsuarioLogado;
  lista: CondominioAcessivel[];
  condominio: CondominioAcessivel | null;
  gestao: boolean;
};

export async function contextoDaPagina(searchParams?: { c?: string | string[] }): Promise<ContextoPagina> {
  const usuario = await exigirUsuario();
  const lista = await condominiosDoUsuario(usuario);
  const pedido = typeof searchParams?.c === "string" ? searchParams.c : null;
  const jar = await cookies();
  const salvo = jar.get(COOKIE_CONDOMINIO)?.value ?? null;
  const condominio = lista.find((c) => c.id === pedido) ?? lista.find((c) => c.id === salvo) ?? lista[0] ?? null;
  return { usuario, lista, condominio, gestao: condominio ? podeGerir(condominio.papel) : false };
}

export function caminhoComCondominio(caminho: string, condominioId: string) {
  return `${caminho}${caminho.includes("?") ? "&" : "?"}c=${condominioId}`;
}
