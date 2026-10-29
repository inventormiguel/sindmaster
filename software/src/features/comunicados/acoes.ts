"use server";

import { acaoNoCondominio, texto } from "@/lib/negocio/acao";
import { iaDisponivel } from "@/lib/ia/funcoes";
import { aprovarEEnviar, criarRascunho, rascunharComunicadoIA } from "./servico";

export async function rascunhoComunicadoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const topicos = texto(form, "topicos");
    if (topicos.length < 5) throw new Error("Escreva os tópicos do comunicado.");
    const publico = (["moradores", "todos", "bloco"] as const).find((x) => x === texto(form, "publico")) ?? "moradores";
    if (form.get("usarIa") === "on" && iaDisponivel()) {
      const r = await rascunharComunicadoIA({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, topicos });
      if (r.ok && r.problemas.length === 0) {
        await criarRascunho({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, topicos, titulo: r.titulo, texto: r.texto, origemTexto: "ia", publico, publicoValor: texto(form, "bloco") || null });
        return "Rascunho da IA criado (datas e horas conferidas com os tópicos). Revise e aprove.";
      }
      await criarRascunho({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, topicos, titulo: texto(form, "titulo") || "Comunicado", texto: topicos, origemTexto: "sindico", publico, publicoValor: texto(form, "bloco") || null });
      return r.ok ? `O rascunho da IA foi descartado (${r.problemas.join("; ")}). Ficou o seu texto.` : `${r.mensagem} Ficou o seu texto.`;
    }
    await criarRascunho({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, topicos, titulo: texto(form, "titulo") || "Comunicado", texto: topicos, origemTexto: "sindico", publico, publicoValor: texto(form, "bloco") || null });
    return "Rascunho criado. Revise e aprove.";
  });
}

export async function aprovarComunicadoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    const r = await aprovarEEnviar({ organizacaoId: usuario.organizacao.id, comunicadoId: texto(form, "comunicadoId"), quem: usuario.nome, titulo: texto(form, "titulo"), texto: texto(form, "texto") });
    return `Aprovado: ${r.destinatarios} destinatário(s); ${r.enfileirados} com Telegram foram para a fila de envio.`;
  });
}
