"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentos } from "@/db/schema";
import { acaoNoCondominio, texto } from "@/lib/negocio/acao";
import { salvarArquivoDoPainel } from "@/lib/negocio/upload";
import { auditar } from "@/lib/negocio/auditoria";
import { criarDocumento, redividir, ROTULO_TIPO_DOC } from "./servico";

export async function enviarDocumentoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const tipo = texto(form, "tipo") as keyof typeof ROTULO_TIPO_DOC;
    if (!(tipo in ROTULO_TIPO_DOC)) throw new Error("Escolha o tipo do documento.");
    const conteudo = texto(form, "texto");
    const arquivo = form.get("arquivo");
    const a = arquivo instanceof File && arquivo.size > 0 ? await salvarArquivoDoPainel({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, arquivo }) : null;
    if (!a && conteudo.length < 20) throw new Error("Envie o arquivo (PDF com texto ou DOCX) ou cole o texto.");
    const titulo = texto(form, "titulo") || ROTULO_TIPO_DOC[tipo];
    const r = await criarDocumento({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, tipo, titulo, texto: conteudo || null, arquivoId: a?.id ?? null, quem: usuario.nome });
    if (a && conteudo.length < 20) return "Arquivo guardado, mas sem texto: este PDF parece uma imagem. Cole o texto ou envie um DOCX para usar nas respostas.";
    return `Documento publicado: ${r.trechos} trecho(s) por artigo. Confira a divisão.`;
  });
}

export async function alternarChaveDocumento(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const [d] = await db.select().from(documentos).where(and(eq(documentos.id, texto(form, "documentoId")), eq(documentos.condominioId, condominio.id))).limit(1);
    if (!d) throw new Error("Documento não encontrado.");
    const chave = texto(form, "chave");
    if (chave === "visivel") await db.update(documentos).set({ visivelMoradores: !d.visivelMoradores }).where(eq(documentos.id, d.id));
    else if (chave === "respostas") await db.update(documentos).set({ usarNasRespostas: !d.usarNasRespostas }).where(eq(documentos.id, d.id));
    await auditar({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, ator: usuario.nome, acao: `documento.${chave}`, alvo: d.id });
    return "Alterado.";
  });
}

export async function conferirDivisaoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    await db
      .update(documentos)
      .set({ divisaoConferidaPorNome: usuario.nome, divisaoConferidaEm: new Date() })
      .where(and(eq(documentos.id, texto(form, "documentoId")), eq(documentos.condominioId, condominio.id)));
    return "Divisão conferida.";
  });
}

export async function atualizarTextoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const id = texto(form, "documentoId");
    await db.update(documentos).set({ texto: texto(form, "texto") }).where(and(eq(documentos.id, id), eq(documentos.condominioId, condominio.id)));
    const n = await redividir(usuario.organizacao.id, id);
    return `Texto atualizado: ${n} trecho(s). Confira a divisão.`;
  });
}
