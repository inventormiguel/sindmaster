import { exigirUsuario, pode } from "@/lib/auth/sessao";
import { exportarOrganizacao } from "@/features/exportar/servico";
import { auditar } from "@/lib/negocio/auditoria";
import { db } from "@/db";
import { exportacoes } from "@/db/schema";
import { obterArmazenamento } from "@/lib/storage";
import { hojeISO } from "@/lib/negocio/datas";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/** Exportar tudo (admin): na nuvem, o ZIP vai ao Blob privado e a resposta é um link assinado de 10 min; local, baixa direto. */
export async function POST() {
  const u = await exigirUsuario();
  if (!pode(u, "gerenciar_integracoes")) return new Response("Só o administrador exporta tudo.", { status: 403 });
  const { zip } = await exportarOrganizacao(u.organizacao.id);
  await auditar({ organizacaoId: u.organizacao.id, ator: u.nome, acao: "exportacao.tudo", detalhe: { bytes: zip.byteLength } });
  const nome = `exportacao-${hojeISO()}.zip`;
  const arm = obterArmazenamento();
  if (arm.provedor === "blob") {
    const chave = `${u.organizacao.id}/exportacoes/${crypto.randomUUID()}-${nome}`;
    await arm.salvar(chave, zip, "application/zip");
    await db.insert(exportacoes).values({ organizacaoId: u.organizacao.id, arquivoChave: chave, tamanho: zip.byteLength, expiraEm: new Date(Date.now() + 86400000), pedidoPorRotulo: u.nome });
    const url = await arm.urlTemporaria(chave, 600);
    if (url) return Response.redirect(url, 303);
  }
  return new Response(zip as BodyInit, { headers: { "content-type": "application/zip", "content-disposition": `attachment; filename="${nome}"`, "cache-control": "no-store" } });
}
