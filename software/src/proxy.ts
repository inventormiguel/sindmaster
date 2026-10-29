import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_SESSAO, verificarSessao } from "@/lib/auth/token";
import { urlPublica } from "@/lib/url-publica";

/** Protege o painel (/app) e manda quem já entrou do login direto para o painel. */
export async function proxy(req: NextRequest) {
  const caminho = req.nextUrl.pathname;
  const sessao = await verificarSessao(req.cookies.get(COOKIE_SESSAO)?.value);

  if (caminho === "/app" || caminho.startsWith("/app/")) {
    if (!sessao) {
      const destino = urlPublica(req.headers, "/login");
      destino.searchParams.set("proximo", caminho);
      return NextResponse.redirect(destino);
    }
    return NextResponse.next();
  }
  if ((caminho === "/login" || caminho === "/cadastro") && sessao) {
    return NextResponse.redirect(urlPublica(req.headers, "/app"));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/app", "/app/:path*", "/login", "/cadastro"],
};
