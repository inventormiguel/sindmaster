"use server";

import { acaoNoCondominio, texto } from "@/lib/negocio/acao";
import { enviarRespostaConferida, responderPeloSindico } from "./servico";

export async function enviarRespostaAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await enviarRespostaConferida({ organizacaoId: usuario.organizacao.id, duvidaId: texto(form, "duvidaId"), quem: usuario.nome, respostaEditada: texto(form, "resposta") || null });
    return "Resposta conferida e enviada ao morador.";
  });
}

export async function responderAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await responderPeloSindico({ organizacaoId: usuario.organizacao.id, duvidaId: texto(form, "duvidaId"), quem: usuario.nome, resposta: texto(form, "resposta"), salvarComoResposta: form.get("salvar") === "on" });
    return form.get("salvar") === "on" ? "Resposta enviada e salva como resposta do condomínio." : "Resposta enviada ao morador.";
  });
}
