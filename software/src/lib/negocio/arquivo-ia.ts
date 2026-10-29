import { eq } from "drizzle-orm";
import { db } from "@/db";
import { arquivos } from "@/db/schema";
import { obterArmazenamento } from "@/lib/storage";
import type { BlocoConteudo } from "@/lib/ia/funcoes";

/** Limites da leitura por IA: PDF só com as 3 primeiras páginas e até 10 MB. */
export const PAGINAS_PARA_IA = 3;
export const LIMITE_PDF_IA = 10 * 1024 * 1024;

async function lerBytes(conteudo: { corpo: ReadableStream<Uint8Array> | Uint8Array }): Promise<Uint8Array> {
  if (conteudo.corpo instanceof Uint8Array) return conteudo.corpo;
  return new Uint8Array(await new Response(conteudo.corpo).arrayBuffer());
}

export async function bytesDoArquivo(arquivoId: string, organizacaoId: string) {
  const [a] = await db.select().from(arquivos).where(eq(arquivos.id, arquivoId)).limit(1);
  if (!a || a.organizacaoId !== organizacaoId) return null;
  if (a.provedor === "seed") return null;
  const c = await obterArmazenamento().abrir(a.chave);
  if (!c) return null;
  return { arquivo: a, bytes: await lerBytes(c) };
}

export async function primeirasPaginas(pdf: Uint8Array, paginas = PAGINAS_PARA_IA): Promise<Uint8Array> {
  const { PDFDocument } = await import("pdf-lib");
  const doc = await PDFDocument.load(pdf, { ignoreEncryption: true });
  if (doc.getPageCount() <= paginas) return pdf;
  const novo = await PDFDocument.create();
  const copiadas = await novo.copyPages(doc, [...Array(paginas).keys()]);
  copiadas.forEach((p) => novo.addPage(p));
  return novo.save();
}

/** Bloco de conteúdo (imagem ou PDF) para a IA a partir de um arquivo guardado. */
export async function blocoDoArquivo(arquivoId: string, organizacaoId: string): Promise<{ bloco: BlocoConteudo } | { erro: string }> {
  const r = await bytesDoArquivo(arquivoId, organizacaoId);
  if (!r) return { erro: "Arquivo não encontrado no armazenamento." };
  const tipo = r.arquivo.mimeType;
  if (tipo === "application/pdf") {
    if (r.bytes.byteLength > LIMITE_PDF_IA) return { erro: "PDF acima de 10 MB: preencha à mão." };
    let pdf = r.bytes;
    try {
      pdf = await primeirasPaginas(r.bytes);
    } catch {
      return { erro: "Não consegui abrir este PDF." };
    }
    return { bloco: { type: "document", source: { type: "base64", media_type: "application/pdf", data: Buffer.from(pdf).toString("base64") } } };
  }
  if (/^image\/(jpeg|png|webp|gif)$/.test(tipo)) {
    return { bloco: { type: "image", source: { type: "base64", media_type: tipo as "image/jpeg", data: Buffer.from(r.bytes).toString("base64") } } };
  }
  return { erro: "Tipo de arquivo que a IA não lê (envie foto ou PDF)." };
}
