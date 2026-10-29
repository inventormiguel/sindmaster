import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { arquivos } from "@/db/schema";
import { usuarioAtual } from "@/lib/auth/sessao";
import { obterArmazenamento } from "@/lib/storage";
import { condominiosDoUsuario } from "@/lib/negocio/acesso";
import { urlPublica } from "@/lib/url-publica";

export const dynamic = "force-dynamic";

/** Entrega um arquivo recebido pelo bot, só para quem é da mesma organização. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const usuario = await usuarioAtual();
  if (!usuario) return new Response("Não autorizado.", { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new Response("Não encontrado.", { status: 404 });
  const [a] = await db
    .select()
    .from(arquivos)
    .where(and(eq(arquivos.id, id), eq(arquivos.organizacaoId, usuario.organizacao.id)))
    .limit(1);
  if (!a) return new Response("Não encontrado.", { status: 404 });
  // Acesso por condomínio: quem não tem acesso ao condomínio do arquivo não vê (404).
  if (a.condominioId) {
    const meus = await condominiosDoUsuario(usuario);
    if (!meus.some((c) => c.id === a.condominioId)) return new Response("Não encontrado.", { status: 404 });
  }
  // Ilustrações do seed: servidas pelo próprio app (public/exemplos), não gastam o Blob.
  if (a.provedor === "seed") return Response.redirect(urlPublica(_req.headers, `/${a.chave}`), 302);

  const armazenamento = obterArmazenamento();
  if (armazenamento.provedor !== a.provedor) return new Response("Arquivo guardado em outro armazenamento.", { status: 409 });

  // Na nuvem: link temporário assinado (o arquivo não passa pela função).
  const assinado = await armazenamento.urlTemporaria(a.chave, 600);
  if (assinado) return Response.redirect(assinado, 302);

  const conteudo = await armazenamento.abrir(a.chave);
  if (!conteudo) return new Response("Arquivo não encontrado no armazenamento.", { status: 404 });
  const nome = encodeURIComponent(a.nomeOriginal);
  return new Response(conteudo.corpo as BodyInit, {
    headers: {
      "content-type": a.mimeType,
      "content-disposition": `inline; filename*=UTF-8''${nome}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}
