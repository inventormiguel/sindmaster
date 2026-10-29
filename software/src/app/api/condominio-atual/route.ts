import { cookies } from "next/headers";
import { exigirUsuario } from "@/lib/auth/sessao";
import { condominiosDoUsuario } from "@/lib/negocio/acesso";
import { COOKIE_CONDOMINIO } from "@/lib/negocio/condominio-atual";
import { urlPublica } from "@/lib/url-publica";

export const dynamic = "force-dynamic";

/** Seletor de condomínio: grava o atual no cookie e volta para a página (só caminhos internos). */
export async function GET(req: Request) {
  const u = await exigirUsuario();
  const p = new URLSearchParams(req.url.split("?")[1] ?? "");
  const id = p.get("c") ?? "";
  const voltar = (p.get("voltar") ?? "/app").startsWith("/app") ? (p.get("voltar") ?? "/app") : "/app";
  const lista = await condominiosDoUsuario(u);
  if (lista.some((c) => c.id === id)) {
    const jar = await cookies();
    jar.set(COOKIE_CONDOMINIO, id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 180 });
  }
  return Response.redirect(urlPublica(req.headers, voltar.split("?")[0]), 303);
}
