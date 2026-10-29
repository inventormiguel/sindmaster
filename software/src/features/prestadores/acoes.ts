"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pessoas, prestadorCondominios, prestadorDocumentos, prestadores, type TipoDocumentoPrestador } from "@/db/schema";
import { acaoNoCondominio, texto, textoOuNulo } from "@/lib/negocio/acao";
import { cnpjValido, formatarCnpjDigitos } from "@/lib/negocio/cnpj";
import { lerDataBR } from "@/lib/negocio/datas";
import { consultarCnpj } from "@/integrations/brasilapi";
import { salvarArquivoDoPainel } from "@/lib/negocio/upload";
import { enfileirarAvisoPessoa } from "@/lib/telegram/avisos";
import { agendarEnvioDaFila } from "@/lib/negocio/fila";
import { alterarDadosPagamento, confirmarPagamentoPorTelefone, conferirDocumento, recusarDocumento } from "./servico";
import { lerDocumentoIA3 } from "./ia";

export async function confirmarPagamentoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await confirmarPagamentoPorTelefone({ organizacaoId: usuario.organizacao.id, alertaId: texto(form, "alertaId"), comQuem: texto(form, "comQuem"), quem: usuario.nome });
    return "Confirmação registrada; alerta fechado.";
  });
}

export async function cadastrarPrestador(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const cnpj = textoOuNulo(form, "cnpj");
    if (cnpj && !cnpjValido(cnpj)) throw new Error("CNPJ com dígitos verificadores inválidos.");
    let razao = texto(form, "razaoSocial");
    let situacao: string | null = null;
    let consultadoEm: Date | null = null;
    if (cnpj) {
      const r = await consultarCnpj(cnpj);
      consultadoEm = new Date();
      if (r.ok) {
        razao = razao || r.razaoSocial;
        situacao = r.situacao;
      } else situacao = r.status === 404 ? "não encontrado na BrasilAPI" : null;
    }
    if (razao.length < 2) throw new Error("Informe a razão social.");
    const categorias = texto(form, "categorias").split(",").map((x) => x.trim()).filter(Boolean);
    const [p] = await db
      .insert(prestadores)
      .values({ organizacaoId: usuario.organizacao.id, razaoSocial: razao, cnpj: cnpj ? formatarCnpjDigitos(cnpj) : null, situacaoCadastral: situacao, consultadoEm, categorias, contato: textoOuNulo(form, "contato"), telefone: textoOuNulo(form, "telefone") })
      .onConflictDoNothing()
      .returning();
    const prest = p ?? (await db.select().from(prestadores).where(and(eq(prestadores.organizacaoId, usuario.organizacao.id), eq(prestadores.cnpj, formatarCnpjDigitos(cnpj)!))).limit(1))[0];
    if (!prest) throw new Error("Não consegui cadastrar.");
    await db.insert(prestadorCondominios).values({ prestadorId: prest.id, condominioId: condominio.id }).onConflictDoNothing();
    const [ja] = await db.select().from(pessoas).where(and(eq(pessoas.prestadorId, prest.id), eq(pessoas.condominioId, condominio.id))).limit(1);
    if (!ja) await db.insert(pessoas).values({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, nome: `${prest.razaoSocial} (contato)`, papel: "prestador", prestadorId: prest.id, telefone: textoOuNulo(form, "telefone") });
    return `${prest.razaoSocial} cadastrado.${situacao ? ` BrasilAPI: ${situacao}.` : ""}`;
  });
}

export async function alterarPagamentoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const r = await alterarDadosPagamento({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, prestadorId: texto(form, "prestadorId"), tipo: texto(form, "tipo") === "conta" ? "conta" : "pix", dados: texto(form, "dados"), quem: usuario.nome });
    return r.alerta ? "Dados de pagamento alterados: confirme por telefone com o prestador (alerta aberto)." : "Dados de pagamento cadastrados.";
  });
}

export async function enviarDocumentoPrestador(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const prestadorId = texto(form, "prestadorId");
    const [pr] = await db.select().from(prestadores).where(and(eq(prestadores.id, prestadorId), eq(prestadores.organizacaoId, usuario.organizacao.id))).limit(1);
    if (!pr) throw new Error("Prestador não encontrado.");
    const arquivo = form.get("arquivo");
    const a = arquivo instanceof File && arquivo.size > 0 ? await salvarArquivoDoPainel({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, arquivo }) : null;
    const l = a && form.get("lerComIa") === "on" ? await lerDocumentoIA3({ organizacaoId: usuario.organizacao.id, arquivoId: a.id, esperado: "documento_prestador", cnpjPrestador: pr.cnpj }) : null;
    const tipoForm = texto(form, "tipo") as TipoDocumentoPrestador;
    const tipo = l?.ok && ["cnd_federal", "crf_fgts", "cndt", "apolice_rc", "alvara"].includes(l.leitura.tipo) ? (l.leitura.tipo as TipoDocumentoPrestador) : tipoForm || "outro";
    const validade = lerDataBR(texto(form, "validade")) ?? (l?.ok ? l.validade : null);
    const emitidoEm = lerDataBR(texto(form, "emitidoEm")) ?? (l?.ok ? l.emitidoEm : null);
    await db.insert(prestadorDocumentos).values({ organizacaoId: usuario.organizacao.id, prestadorId: pr.id, tipo, titularCnpj: l?.ok ? l.leitura.titularCnpj : pr.cnpj, emitidoEm, validade, arquivoId: a?.id ?? null, origemLeitura: l?.ok ? "ia" : "manual", leituraIa: l?.ok ? l.leitura : null, estado: "para_conferir", enviadoPor: "painel" });
    return l && !l.ok ? `Documento guardado; ${l.mensagem}` : "Documento guardado para conferir.";
  });
}

export async function conferirDocumentoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await conferirDocumento({ organizacaoId: usuario.organizacao.id, documentoId: texto(form, "documentoId"), quem: usuario.nome, validade: lerDataBR(texto(form, "validade")) ?? undefined, emitidoEm: lerDataBR(texto(form, "emitidoEm")) ?? undefined });
    return "Documento conferido.";
  });
}

export async function recusarDocumentoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario }) => {
    await recusarDocumento({ organizacaoId: usuario.organizacao.id, documentoId: texto(form, "documentoId"), quem: usuario.nome });
    return "Documento recusado.";
  });
}

export async function pedirDocumentoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const contatos = await db.select().from(pessoas).where(and(eq(pessoas.prestadorId, texto(form, "prestadorId")), eq(pessoas.condominioId, condominio.id)));
    let n = 0;
    for (const c of contatos) {
      const r = await enfileirarAvisoPessoa({ organizacaoId: usuario.organizacao.id, pessoaId: c.id, categoria: "pedido_documento", texto: `${condominio.nome}: o condomínio pediu a certidão ou apólice atualizada. Envie por aqui com /certidao (PDF ou foto).`, chaveIdempotencia: `pedido-doc:${c.id}:${new Date().toISOString().slice(0, 13)}` });
      n += r.enfileirados;
    }
    agendarEnvioDaFila(usuario.organizacao.id);
    return n ? "Pedido enviado ao prestador pelo Telegram." : "O prestador não tem Telegram vinculado: o pedido ficou registrado como não enviado.";
  });
}
