import { SignJWT, jwtVerify } from "jose";
import { derivarSegredo } from "@/lib/segredos";
import { BRAND } from "@/lib/brand";

/** Funções de sessão sem dependência de next/headers (usadas também no proxy). */
export const COOKIE_SESSAO = `${BRAND.prefixo}_sessao`;
export const DURACAO_SESSAO_S = 60 * 60 * 24 * 14;

export type DadosSessao = { uid: string; oid: string };

function chave() {
  return new TextEncoder().encode(derivarSegredo("sessao"));
}

export async function assinarSessao(dados: DadosSessao): Promise<string> {
  return new SignJWT(dados)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACAO_SESSAO_S}s`)
    .sign(chave());
}

export async function verificarSessao(token: string | undefined | null): Promise<DadosSessao | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, chave(), { algorithms: ["HS256"] });
    if (typeof payload.uid !== "string" || typeof payload.oid !== "string") return null;
    return { uid: payload.uid, oid: payload.oid };
  } catch {
    return null;
  }
}
