import { exigirUsuario, pode } from "@/lib/auth/sessao";
import { exportarPessoa } from "@/features/lgpd/servico";
import { auditar } from "@/lib/negocio/auditoria";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const u = await exigirUsuario();
  if (!pode(u, "gerenciar_integracoes")) return new Response("Só o administrador.", { status: 403 });
  const form = await req.formData();
  const id = String(form.get("pessoaId") ?? "");
  try {
    const dados = await exportarPessoa(u.organizacao.id, id);
    await auditar({ organizacaoId: u.organizacao.id, ator: u.nome, acao: "lgpd.dados_exportados", alvo: id });
    return new Response(JSON.stringify(dados, null, 2), { headers: { "content-type": "application/json; charset=utf-8", "content-disposition": `attachment; filename="dados-pessoa.json"`, "cache-control": "no-store" } });
  } catch {
    return new Response("Não encontrado.", { status: 404 });
  }
}
