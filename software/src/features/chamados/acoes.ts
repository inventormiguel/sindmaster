"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { chamados, type Urgencia } from "@/db/schema";
import { acaoNoCondominio, texto, textoOuNulo } from "@/lib/negocio/acao";
import { salvarArquivoDoPainel } from "@/lib/negocio/upload";
import { instanteLocal, lerDataBR } from "@/lib/negocio/datas";
import { abrirChamado, arquivosDoChamado, atribuirChamado, encerrarPeloSindico, mudarUrgencia, resolverChamado } from "./servico";
import { CATEGORIAS_CHAMADO, type CategoriaChamado } from "./ia";

export async function abrirChamadoPainel(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const cat = texto(form, "categoria");
    const r = await abrirChamado({
      organizacaoId: usuario.organizacao.id,
      condominioId: condominio.id,
      origem: "sindico",
      natureza: texto(form, "natureza") === "ocorrencia" ? "ocorrencia" : "manutencao",
      descricao: texto(form, "descricao"),
      abertoPorUsuarioId: usuario.id,
      autorRotulo: usuario.nome,
      unidadeId: textoOuNulo(form, "unidadeId"),
      categoria: (CATEGORIAS_CHAMADO as readonly string[]).includes(cat) ? (cat as CategoriaChamado) : null,
      categoriaOrigem: "sindico",
      usarIa: !cat,
    });
    return `Chamado nº ${r.chamado.numero} aberto${r.emergencia ? " como EMERGÊNCIA (síndico e plantão avisados)" : ""}.`;
  });
}

export async function atribuirChamadoPainel(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    const alvo = texto(form, "alvo");
    const [tipo, id] = alvo.split(":");
    const data = lerDataBR(texto(form, "data"));
    const hora = texto(form, "hora").match(/^(\d{1,2}):(\d{2})$/);
    const agendadoPara = data ? instanteLocal(data, hora ? Number(hora[1]) : 9, hora ? Number(hora[2]) : 0) : null;
    await atribuirChamado({
      organizacaoId: usuario.organizacao.id,
      chamadoId: texto(form, "chamadoId"),
      autorRotulo: usuario.nome,
      autorUsuarioId: usuario.id,
      pessoaId: tipo === "p" ? id : null,
      prestadorId: tipo === "x" ? id : null,
      agendadoPara,
      justificativa: textoOuNulo(form, "justificativa"),
    });
    return "Responsável definido e avisado.";
  });
}

export async function mudarUrgenciaPainel(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await mudarUrgencia({ organizacaoId: usuario.organizacao.id, chamadoId: texto(form, "chamadoId"), urgencia: texto(form, "urgencia") as Urgencia, motivo: texto(form, "motivo"), autorRotulo: usuario.nome, autorUsuarioId: usuario.id });
    return "Urgência alterada (com motivo no histórico).";
  });
}

export async function resolverChamadoPainel(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const arquivo = form.get("foto");
    if (!(arquivo instanceof File) || arquivo.size === 0) throw new Error("Para resolver, anexe a foto do serviço feito.");
    const a = await salvarArquivoDoPainel({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, arquivo });
    const r = await resolverChamado({ organizacaoId: usuario.organizacao.id, chamadoId: texto(form, "chamadoId"), arquivoIds: [a.id], texto: textoOuNulo(form, "texto"), autorRotulo: usuario.nome, autorUsuarioId: usuario.id });
    return r.avisados ? "Resolvido: o morador vai confirmar pelo Telegram." : "Resolvido. Sem morador vinculado para confirmar: encerre quando conferir.";
  });
}

export async function encerrarChamadoPainel(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await encerrarPeloSindico({ organizacaoId: usuario.organizacao.id, chamadoId: texto(form, "chamadoId"), motivo: texto(form, "motivo"), autorRotulo: usuario.nome, autorUsuarioId: usuario.id });
    return "Chamado encerrado pelo síndico.";
  });
}

/** Ocorrência → chamado de manutenção (com o texto e as fotos); a ocorrência fica como está. */
export async function virarManutencao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const [o] = await db.select().from(chamados).where(and(eq(chamados.id, texto(form, "chamadoId")), eq(chamados.condominioId, condominio.id), eq(chamados.natureza, "ocorrencia"))).limit(1);
    if (!o) throw new Error("Ocorrência não encontrada.");
    const fotos = await arquivosDoChamado(o);
    const r = await abrirChamado({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, origem: "sindico", descricao: `${o.descricao} (da ocorrência nº ${o.numero})`, abertoPorUsuarioId: usuario.id, autorRotulo: usuario.nome, unidadeId: o.unidadeId, arquivoIds: fotos });
    return `Chamado de manutenção nº ${r.chamado.numero} criado a partir da ocorrência nº ${o.numero}.`;
  });
}
