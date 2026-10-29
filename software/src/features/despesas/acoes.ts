"use server";

import { acaoNoCondominio, texto } from "@/lib/negocio/acao";
import { salvarArquivoDoPainel } from "@/lib/negocio/upload";
import { lerDataBR } from "@/lib/negocio/datas";
import { lerReais } from "@/lib/negocio/dinheiro";
import { aprovarAcimaDaAlcada, conferirELancar, criarDespesaDeArquivo, editarParaConferir, estornarDespesa, recusarDespesa } from "./servico";

export async function enviarReciboAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const arquivo = form.get("arquivo");
    if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error("Escolha a foto ou o PDF.");
    const a = await salvarArquivoDoPainel({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, arquivo });
    const r = await criarDespesaDeArquivo({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, arquivoId: a.id, quem: usuario.nome });
    return r.erroIa ? `Arquivo guardado; ${r.erroIa}` : "Lido pela IA: confira campo a campo abaixo.";
  });
}

export async function salvarCamposAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    const valor = lerReais(texto(form, "valor"));
    await editarParaConferir({
      organizacaoId: usuario.organizacao.id,
      despesaId: texto(form, "despesaId"),
      quem: usuario.nome,
      campos: {
        fornecedorNome: texto(form, "fornecedorNome") || null,
        cnpj: texto(form, "cnpj") || null,
        valorCentavos: valor,
        dataEmissao: lerDataBR(texto(form, "dataEmissao")),
        vencimento: lerDataBR(texto(form, "vencimento")),
        categoria: texto(form, "categoria") || "outros",
        descricao: texto(form, "descricao") || null,
        prestadorId: texto(form, "prestadorId") || null,
      },
    });
    return "Campos salvos.";
  });
}

export async function lancarAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    const r = await conferirELancar({ organizacaoId: usuario.organizacao.id, despesaId: texto(form, "despesaId"), quem: usuario.nome, beneficiarioConferido: form.get("beneficiario") === "on", motivoLiberacao: texto(form, "motivo") || null });
    return r.estado === "lancada" ? "Conferida e lançada." : "Conferida; acima da alçada, aguardando aprovação.";
  });
}

export async function aprovarAlcadaAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await aprovarAcimaDaAlcada({ organizacaoId: usuario.organizacao.id, despesaId: texto(form, "despesaId"), quem: usuario.nome });
    return "Aprovada e lançada.";
  });
}

export async function recusarAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await recusarDespesa({ organizacaoId: usuario.organizacao.id, despesaId: texto(form, "despesaId"), quem: usuario.nome, motivo: texto(form, "motivo") });
    return "Despesa recusada (com o motivo registrado).";
  });
}

export async function estornarAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await estornarDespesa({ organizacaoId: usuario.organizacao.id, despesaId: texto(form, "despesaId"), quem: usuario.nome, motivo: texto(form, "motivo") });
    return "Despesa estornada (nada é apagado).";
  });
}
