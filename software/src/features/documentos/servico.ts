import { and, asc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { documentos, trechos } from "@/db/schema";
import { auditar } from "@/lib/negocio/auditoria";
import { dividirEmArtigos, pedeRevisaoDadoPessoal } from "./divisao";

export const ROTULO_TIPO_DOC = {
  convencao: "Convenção",
  regimento: "Regimento interno",
  ata: "Ata",
  contrato: "Contrato",
  apolice: "Apólice",
  laudo: "Laudo",
  outro: "Outro",
} as const;

export function tituloCurto(tipo: keyof typeof ROTULO_TIPO_DOC, titulo: string): string {
  if (tipo === "regimento") return "Regimento Interno";
  if (tipo === "convencao") return "Convenção";
  return titulo.slice(0, 60);
}

/** Cria o documento e divide em artigos. Atas nascem com "visível" e "usar nas respostas" desligados. */
export async function criarDocumento(p: {
  organizacaoId: string;
  condominioId: string;
  tipo: keyof typeof ROTULO_TIPO_DOC;
  titulo: string;
  texto: string | null;
  arquivoId?: string | null;
  quem: string;
  visivelMoradores?: boolean;
  usarNasRespostas?: boolean;
}) {
  const ata = p.tipo === "ata";
  const [doc] = await db
    .insert(documentos)
    .values({
      organizacaoId: p.organizacaoId,
      condominioId: p.condominioId,
      tipo: p.tipo,
      titulo: p.titulo.trim().slice(0, 160),
      texto: p.texto,
      arquivoId: p.arquivoId ?? null,
      visivelMoradores: ata ? false : (p.visivelMoradores ?? true),
      usarNasRespostas: ata ? false : (p.usarNasRespostas ?? (p.tipo === "regimento" || p.tipo === "convencao")),
      criadoPorRotulo: p.quem,
    })
    .returning();
  let n = 0;
  if (p.texto) n = await redividir(p.organizacaoId, doc.id);
  await auditar({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, ator: p.quem, acao: "documento.criado", alvo: doc.id, detalhe: { tipo: p.tipo, trechos: n } });
  return { doc, trechos: n };
}

export async function redividir(organizacaoId: string, documentoId: string) {
  const [doc] = await db.select().from(documentos).where(and(eq(documentos.id, documentoId), eq(documentos.organizacaoId, organizacaoId))).limit(1);
  if (!doc || !doc.texto) return 0;
  await db.delete(trechos).where(and(eq(trechos.documentoId, doc.id), eq(trechos.origem, "documento")));
  const lista = dividirEmArtigos(doc.texto, tituloCurto(doc.tipo, doc.titulo));
  if (lista.length === 0) return 0;
  await db.insert(trechos).values(
    lista.map((t, i) => ({
      organizacaoId,
      condominioId: doc.condominioId,
      documentoId: doc.id,
      rotulo: t.rotulo,
      texto: t.texto,
      ordem: i,
      revisarDadoPessoal: pedeRevisaoDadoPessoal(t.texto),
      origem: "documento" as const,
    })),
  );
  await db.update(documentos).set({ divisaoConferidaPorNome: null, divisaoConferidaEm: null }).where(eq(documentos.id, doc.id));
  return lista.length;
}

/** Trechos que podem ir para a IA: documentos com "Usar nas respostas", sem marca de dado pessoal, e as respostas salvas pelo síndico. */
export async function trechosParaRespostas(organizacaoId: string, condominioId: string) {
  const docs = await db
    .select({ id: documentos.id })
    .from(documentos)
    .where(and(eq(documentos.organizacaoId, organizacaoId), eq(documentos.condominioId, condominioId), eq(documentos.usarNasRespostas, true)));
  const ids = docs.map((d) => d.id);
  const deDocs = ids.length
    ? await db.select().from(trechos).where(and(inArray(trechos.documentoId, ids), eq(trechos.revisarDadoPessoal, false))).orderBy(asc(trechos.ordem))
    : [];
  const salvas = await db
    .select()
    .from(trechos)
    .where(and(eq(trechos.organizacaoId, organizacaoId), eq(trechos.condominioId, condominioId), eq(trechos.origem, "resposta_sindico")));
  return [...deDocs, ...salvas];
}

export async function documentosVisiveis(organizacaoId: string, condominioId: string) {
  return db
    .select()
    .from(documentos)
    .where(and(eq(documentos.organizacaoId, organizacaoId), eq(documentos.condominioId, condominioId), eq(documentos.visivelMoradores, true)))
    .orderBy(asc(documentos.titulo));
}
