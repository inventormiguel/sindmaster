import { createHash } from "node:crypto";
import { and, eq, isNull, sql } from "drizzle-orm";
import { db } from "@/db";
import { arquivos, telegramAlbuns, telegramMensagens } from "@/db/schema";
import { montarChave, obterArmazenamento } from "@/lib/storage";
import { prepararImagem } from "@/lib/storage/imagem";
import { ArquivoGrandeDemaisError } from "../api";
import { LIMITE_DOWNLOAD_BYTES } from "../tipos";
import type { ContextoBot, Roteador } from "../roteador";

/**
 * Recebe foto e documento: getFile + download (limite de 20 MB da Bot API),
 * guarda no armazenamento e registra os metadados (uma vez por mensagem).
 *
 * - `obterArquivoDaMensagem(ctx)` é usado pelos tratadores de estado (rotina, recibo, documento…).
 * - Imagem mandada como DOCUMENTO chega com EXIF (GPS): é reduzida e regravada sem metadados.
 *   Foto mandada como foto já chega recomprimida e sem EXIF pelo Telegram.
 * - Ponto de extensão: `aoReceberArquivo` é chamado depois de salvar.
 */
export type ArquivoRecebido = { id: string; nome: string; mimeType: string; tamanho: number; ctx: ContextoBot };
const ouvintes: ((a: ArquivoRecebido) => Promise<void>)[] = [];

export function aoReceberArquivo(fn: (a: ArquivoRecebido) => Promise<void>) {
  ouvintes.push(fn);
}

export function formatarTamanho(bytes: number): string {
  if (bytes < 1024) return `${bytes} bytes`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1).replace(".", ",")} MB`;
}

const EXTENSAO_POR_TIPO: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Guarda o arquivo da mensagem (uma vez) e devolve o registro; null se não houver arquivo ou se foi recusado (já respondido). */
export async function obterArquivoDaMensagem(ctx: ContextoBot): Promise<ContextoBot["arquivoSalvo"]> {
  if (ctx.arquivoSalvo !== undefined) return ctx.arquivoSalvo;
  const m = ctx.mensagem;
  const pessoa = ctx.pessoa;
  if (!m || !pessoa) return (ctx.arquivoSalvo = null);
  let fileId: string;
  let fileUniqueId: string;
  let nome: string;
  let mimeType: string;
  let tamanhoInformado: number | undefined;

  if (m.photo?.length) {
    const maior = [...m.photo].sort((a, b) => (b.file_size ?? b.width * b.height) - (a.file_size ?? a.width * a.height))[0];
    fileId = maior.file_id;
    fileUniqueId = maior.file_unique_id;
    mimeType = "image/jpeg";
    nome = `foto-${m.message_id}.jpg`;
    tamanhoInformado = maior.file_size;
  } else if (m.document) {
    fileId = m.document.file_id;
    fileUniqueId = m.document.file_unique_id;
    mimeType = m.document.mime_type || "application/octet-stream";
    nome = m.document.file_name || `documento-${m.message_id}.${EXTENSAO_POR_TIPO[mimeType] ?? "bin"}`;
    tamanhoInformado = m.document.file_size;
  } else {
    return (ctx.arquivoSalvo = null);
  }

  if (tamanhoInformado && tamanhoInformado > LIMITE_DOWNLOAD_BYTES) {
    await ctx.responder(new ArquivoGrandeDemaisError(tamanhoInformado).message + " Envie uma versão menor ou peça ao síndico para subir pelo painel.");
    return (ctx.arquivoSalvo = null);
  }

  let baixado: { bytes: Uint8Array; tamanho: number };
  try {
    baixado = await ctx.saida.baixarArquivo(fileId);
  } catch (e) {
    if (e instanceof ArquivoGrandeDemaisError) {
      await ctx.responder(e.message + " Envie uma versão menor.");
      return (ctx.arquivoSalvo = null);
    }
    throw e;
  }

  let bytes = baixado.bytes;
  if (m.document && /^image\/(jpeg|png|webp)$/.test(mimeType)) {
    const r = await prepararImagem(bytes);
    if (r) {
      bytes = r.bytes;
      mimeType = r.mimeType;
      nome = nome.replace(/\.[a-z0-9]+$/i, "") + ".jpg";
    }
  }

  const armazenamento = obterArmazenamento();
  const chave = montarChave(pessoa.organizacaoId, nome);
  await armazenamento.salvar(chave, bytes, mimeType);

  const [registro] = await db
    .insert(arquivos)
    .values({
      organizacaoId: pessoa.organizacaoId,
      condominioId: pessoa.condominioId,
      pessoaId: pessoa.id,
      origem: "telegram",
      nomeOriginal: nome,
      mimeType,
      tamanhoBytes: bytes.byteLength,
      provedor: armazenamento.provedor,
      chave,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      recebidoComo: m.photo?.length ? "foto" : "documento",
      telegramFileId: fileId,
      telegramFileUniqueId: fileUniqueId,
    })
    .returning({ id: arquivos.id });

  if (ctx.registroEntradaId) {
    await db.update(telegramMensagens).set({ arquivoId: registro.id }).where(eq(telegramMensagens.id, ctx.registroEntradaId));
  }
  ctx.arquivoSalvo = { id: registro.id, nome, mimeType, tamanho: bytes.byteLength };
  for (const fn of ouvintes) await fn({ ...ctx.arquivoSalvo, ctx });
  return ctx.arquivoSalvo;
}

/**
 * Álbum (media_group_id): as fotos chegam em updates separados (às vezes em paralelo).
 * Cada update acrescenta o arquivo ao álbum (INSERT … ON CONFLICT); o primeiro espera
 * um pouco e processa o álbum UMA vez (UPDATE … WHERE processado_em IS NULL RETURNING).
 */
export const ESPERA_ALBUM_MS = 2000;

export async function registrarNoAlbum(ctx: ContextoBot, arquivoId: string): Promise<{ grupo: string | null; primeiro: boolean }> {
  const grupo = ctx.mensagem?.media_group_id ?? null;
  if (!grupo) return { grupo: null, primeiro: true };
  const legenda = ctx.mensagem?.caption?.trim() || null;
  const novos = await db
    .insert(telegramAlbuns)
    .values({ mediaGroupId: grupo, chatId: ctx.chatId, pessoaId: ctx.pessoa?.id ?? null, arquivoIds: [arquivoId], legenda })
    .onConflictDoNothing()
    .returning({ id: telegramAlbuns.mediaGroupId });
  if (novos.length === 0) {
    await db
      .update(telegramAlbuns)
      .set({ arquivoIds: sql`${telegramAlbuns.arquivoIds} || ${JSON.stringify([arquivoId])}::jsonb`, legenda: sql`coalesce(${telegramAlbuns.legenda}, ${legenda})` })
      .where(eq(telegramAlbuns.mediaGroupId, grupo));
  }
  return { grupo, primeiro: novos.length > 0 };
}

/** Espera os outros updates do álbum e reserva o processamento (só um update consegue). */
export async function reservarAlbum(grupo: string, esperaMs = ESPERA_ALBUM_MS) {
  if (esperaMs > 0) await new Promise((r) => setTimeout(r, esperaMs));
  const [a] = await db
    .update(telegramAlbuns)
    .set({ processadoEm: new Date() })
    .where(and(eq(telegramAlbuns.mediaGroupId, grupo), isNull(telegramAlbuns.processadoEm)))
    .returning();
  return a ?? null;
}

export async function arquivosDoAlbum(grupo: string): Promise<string[]> {
  const [a] = await db.select({ ids: telegramAlbuns.arquivoIds }).from(telegramAlbuns).where(eq(telegramAlbuns.mediaGroupId, grupo)).limit(1);
  return a?.ids ?? [];
}

/** Tratador padrão (último da fila): guarda o arquivo e confirma o recebimento. */
export function registrarArquivos(roteador: Roteador) {
  roteador.registrarArquivo(async (ctx) => {
    const a = await obterArquivoDaMensagem(ctx);
    if (!a) return true;
    await ctx.responder(`Recebi ${ctx.mensagem?.photo?.length ? "a foto" : `o arquivo "${a.nome}"`} (${formatarTamanho(a.tamanho)}). Ele ficou guardado para a administração do condomínio.`);
    return true;
  });
}
