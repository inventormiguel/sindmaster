import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/db";
import { arquivos } from "@/db/schema";
import { montarChave, obterArmazenamento } from "@/lib/storage";
import { prepararImagem } from "@/lib/storage/imagem";

/** Limite do upload pelo painel (corpo da função na Vercel: 4,5 MB). */
export const LIMITE_UPLOAD_PAINEL = 4 * 1024 * 1024;
const TIPOS = /^(image\/(jpeg|png|webp)|application\/pdf|text\/plain|application\/vnd\.openxmlformats-officedocument\.wordprocessingml\.document)$/;

/** Upload pelo painel: imagem reduzida e sem EXIF; PDF/DOCX/TXT como vieram. */
export async function salvarArquivoDoPainel(p: { organizacaoId: string; condominioId: string | null; arquivo: File }) {
  if (p.arquivo.size > LIMITE_UPLOAD_PAINEL) throw new Error("Arquivo acima de 4 MB: reduza ou envie pelo Telegram (até 20 MB).");
  if (!TIPOS.test(p.arquivo.type)) throw new Error("Tipo de arquivo não aceito (use foto, PDF, DOCX ou TXT).");
  let bytes = new Uint8Array(await p.arquivo.arrayBuffer());
  let mime = p.arquivo.type;
  let nome = p.arquivo.name || "arquivo";
  if (mime.startsWith("image/")) {
    const r = await prepararImagem(bytes);
    if (r) {
      bytes = new Uint8Array(r.bytes);
      mime = r.mimeType;
      nome = nome.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    }
  }
  const armazenamento = obterArmazenamento();
  const chave = montarChave(p.organizacaoId, nome);
  await armazenamento.salvar(chave, bytes, mime);
  const [a] = await db
    .insert(arquivos)
    .values({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, origem: "painel", nomeOriginal: nome, mimeType: mime, tamanhoBytes: bytes.byteLength, provedor: armazenamento.provedor, chave, sha256: createHash("sha256").update(bytes).digest("hex"), recebidoComo: "painel" })
    .returning();
  return a;
}
