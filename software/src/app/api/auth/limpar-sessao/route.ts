import { NextResponse } from "next/server";
import { COOKIE_SESSAO } from "@/lib/auth/token";
import { urlPublica } from "@/lib/url-publica";

export const dynamic = "force-dynamic";

/** Sessão órfã (usuário ou organização não existe mais): limpa o cookie e manda ao login. */
export async function GET(req: Request) {
  const r = NextResponse.redirect(urlPublica(req.headers, "/login"));
  r.cookies.delete(COOKIE_SESSAO);
  return r;
}
