"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirPermissao } from "@/lib/auth/sessao";
import { apagarPessoa } from "./servico";

export async function apagarPessoaAcao(form: FormData) {
  const u = await exigirPermissao("gerenciar_integracoes");
  const id = String(form.get("pessoaId") ?? "");
  let destino = "/app/lgpd?ok=Dados+pessoais+apagados.+O+hist%C3%B3rico+ficou+sem+identificar+a+pessoa.";
  try {
    if (String(form.get("confirmo") ?? "") !== "APAGAR") throw new Error("Digite APAGAR para confirmar.");
    await apagarPessoa({ organizacaoId: u.organizacao.id, pessoaId: id, quem: u.nome });
  } catch (e) {
    destino = `/app/lgpd?erro=${encodeURIComponent(e instanceof Error ? e.message : "Falhou.")}`;
  }
  revalidatePath("/app/lgpd");
  redirect(destino);
}
