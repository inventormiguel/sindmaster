"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { vencimentos } from "@/db/schema";
import { acaoNoCondominio, texto } from "@/lib/negocio/acao";
import { instanteLocal, lerDataBR } from "@/lib/negocio/datas";
import { salvarArquivoDoPainel } from "@/lib/negocio/upload";
import { abrirChamado } from "@/features/chamados/servico";
import { lerDocumentoIA3 } from "@/features/prestadores/ia";
import { conferirEAtivar, conferirServico, criarVencimentosDoCondominio, desativarVencimento, recusarServico, registrarServico } from "./servico";

export async function conferirEAtivarAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    const proximo = lerDataBR(texto(form, "proximo"));
    const per = texto(form, "periodicidade");
    await conferirEAtivar({ organizacaoId: usuario.organizacao.id, vencimentoId: texto(form, "vencimentoId"), quem: usuario.nome, proximo: proximo ?? undefined, periodicidadeMeses: per ? Number(per) : undefined });
    return "Conferido e ativo: entra nos avisos do resumo diário.";
  });
}

export async function desativarAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await desativarVencimento({ organizacaoId: usuario.organizacao.id, vencimentoId: texto(form, "vencimentoId"), quem: usuario.nome });
    return "Vencimento desativado.";
  });
}

export async function criarDosModelosAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const n = await criarVencimentosDoCondominio(usuario.organizacao.id, condominio.id);
    return `${n} vencimento(s) criados a partir dos modelos, todos "não conferidos".`;
  });
}

/** Registrar serviço feito: com a data digitada, conferido na hora; só com o comprovante, a IA3 lê e fica para conferir. */
export async function registrarServicoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const vencimentoId = texto(form, "vencimentoId");
    const arquivo = form.get("comprovante");
    const a = arquivo instanceof File && arquivo.size > 0 ? await salvarArquivoDoPainel({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, arquivo }) : null;
    const dataServico = lerDataBR(texto(form, "dataServico"));
    const validade = lerDataBR(texto(form, "validade"));
    if (dataServico || validade) {
      await registrarServico({ organizacaoId: usuario.organizacao.id, vencimentoId, dataServico, validadeImpressa: validade, arquivoId: a?.id ?? null, origemLeitura: "manual", conferidoPor: usuario.nome });
      return "Serviço registrado e conferido; próximo vencimento recalculado.";
    }
    if (!a) throw new Error("Informe a data do serviço (ou a validade impressa) ou anexe o comprovante.");
    const l = await lerDocumentoIA3({ organizacaoId: usuario.organizacao.id, arquivoId: a.id, esperado: "comprovante_servico" });
    await registrarServico({ organizacaoId: usuario.organizacao.id, vencimentoId, dataServico: l.ok ? l.dataServico : null, validadeImpressa: l.ok ? l.validade : null, arquivoId: a.id, origemLeitura: l.ok ? "ia" : "manual", leituraIa: l.ok ? l.leitura : null });
    return l.ok ? "Comprovante lido pela IA: confira a data abaixo para recalcular." : `Comprovante guardado. ${l.mensagem}`;
  });
}

export async function conferirServicoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    const r = await conferirServico({ organizacaoId: usuario.organizacao.id, registroId: texto(form, "registroId"), quem: usuario.nome, dataServico: lerDataBR(texto(form, "dataServico")) ?? undefined, validadeImpressa: lerDataBR(texto(form, "validade")) ?? undefined });
    return `Conferido. Próximo vencimento: ${r.proximo.split("-").reverse().join("/")}.`;
  });
}

export async function recusarServicoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await recusarServico({ organizacaoId: usuario.organizacao.id, registroId: texto(form, "registroId"), quem: usuario.nome });
    return "Leitura recusada.";
  });
}

/** "Agendar serviço": cria o chamado de origem vencimento, com o prestador escolhido. */
export async function agendarServicoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const [v] = await db.select().from(vencimentos).where(and(eq(vencimentos.id, texto(form, "vencimentoId")), eq(vencimentos.condominioId, condominio.id))).limit(1);
    if (!v) throw new Error("Vencimento não encontrado.");
    const data = lerDataBR(texto(form, "data"));
    const prestadorId = texto(form, "prestadorId") || null;
    const { atribuirChamado } = await import("@/features/chamados/servico");
    const r = await abrirChamado({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, origem: "vencimento", descricao: `Serviço do vencimento: ${v.nome}`, abertoPorUsuarioId: usuario.id, autorRotulo: usuario.nome, vencimentoId: v.id, categoria: "outra", categoriaOrigem: "sindico", usarIa: false });
    if (prestadorId) await atribuirChamado({ organizacaoId: usuario.organizacao.id, chamadoId: r.chamado.id, autorRotulo: usuario.nome, autorUsuarioId: usuario.id, prestadorId, agendadoPara: data ? instanteLocal(data, 8) : null, justificativa: texto(form, "justificativa") || null });
    return `Chamado nº ${r.chamado.numero} criado para o serviço${prestadorId ? " e enviado ao prestador" : ""}.`;
  });
}
