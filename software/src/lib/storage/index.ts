import fs from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { diretorioDados } from "@/lib/segredos";

/**
 * Adaptador de armazenamento de arquivos.
 * - BLOB_READ_WRITE_TOKEN definido → Vercel Blob (store privado).
 * - Sem token, fora da Vercel → pasta local .data/uploads (só desenvolvimento).
 * - Na Vercel sem token → erro claro (o disco da função não é persistente).
 */
export type Provedor = "blob" | "local";

export type ConteudoArquivo = { corpo: ReadableStream<Uint8Array> | Uint8Array; contentType: string; tamanho?: number };

export interface Armazenamento {
  provedor: Provedor;
  salvar(chave: string, dados: Uint8Array, contentType: string): Promise<{ chave: string }>;
  abrir(chave: string): Promise<ConteudoArquivo | null>;
  /** URL temporária assinada para baixar direto do armazenamento (quando o provedor suporta). */
  urlTemporaria(chave: string, validadeSegundos?: number): Promise<string | null>;
}

export class ArmazenamentoNaoConfiguradoError extends Error {
  constructor() {
    super("Armazenamento de arquivos não configurado: defina BLOB_READ_WRITE_TOKEN.");
    this.name = "ArmazenamentoNaoConfiguradoError";
  }
}

/** Nome de arquivo seguro (sem barras, sem caracteres estranhos, até 80 caracteres). */
export function nomeSeguro(nome: string): string {
  const base = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9._-]+/g, "-")
    .replace(/^[.-]+/, "")
    .slice(-80);
  return base || "arquivo";
}

/** Chave: <organização>/<aaaa>/<mm>/<uuid>-<nome>. */
export function montarChave(organizacaoId: string, nomeOriginal: string, agora = new Date()): string {
  const aaaa = String(agora.getUTCFullYear());
  const mm = String(agora.getUTCMonth() + 1).padStart(2, "0");
  return `${organizacaoId}/${aaaa}/${mm}/${randomUUID()}-${nomeSeguro(nomeOriginal)}`;
}

function validarChave(chave: string) {
  if (!/^[A-Za-z0-9._/-]+$/.test(chave) || chave.includes("..") || chave.startsWith("/")) {
    throw new Error("Chave de arquivo inválida.");
  }
}

export function diretorioUploads(): string {
  return process.env.UPLOADS_DIR ?? path.join(diretorioDados(), "uploads");
}

function armazenamentoLocal(): Armazenamento {
  const raiz = diretorioUploads();
  const caminho = (chave: string) => {
    validarChave(chave);
    // Pasta local só existe em desenvolvimento: não entra no rastreamento de arquivos do build.
    const base = path.resolve(/*turbopackIgnore: true*/ raiz);
    const p = path.resolve(/*turbopackIgnore: true*/ base, chave);
    if (!p.startsWith(base + path.sep)) throw new Error("Chave de arquivo inválida.");
    return p;
  };
  return {
    provedor: "local",
    async salvar(chave, dados) {
      const p = caminho(chave);
      await fs.mkdir(path.dirname(p), { recursive: true });
      await fs.writeFile(p, dados);
      return { chave };
    },
    async abrir(chave) {
      try {
        const bytes = new Uint8Array(await fs.readFile(caminho(chave)));
        return { corpo: bytes, contentType: "application/octet-stream", tamanho: bytes.byteLength };
      } catch {
        return null;
      }
    },
    async urlTemporaria() {
      return null;
    },
  };
}

/**
 * Vercel Blob privado. Com `token` (BLOB_READ_WRITE_TOKEN) ou, sem ele, com a autenticação OIDC
 * da Vercel (loja ligada ao projeto: BLOB_STORE_ID + VERCEL_OIDC_TOKEN, lidos pelo SDK).
 * Se a URL pré-assinada não for possível com OIDC, a entrega passa pela função (até 4,5 MB);
 * para arquivos maiores, defina BLOB_READ_WRITE_TOKEN (portão P-BLOB no README).
 */
function armazenamentoBlob(token: string | undefined): Armazenamento {
  return {
    provedor: "blob",
    async salvar(chave, dados, contentType) {
      validarChave(chave);
      const { put } = await import("@vercel/blob");
      const r = await put(chave, Buffer.from(dados), {
        access: "private",
        contentType,
        addRandomSuffix: false,
        token,
      });
      return { chave: r.pathname };
    },
    async abrir(chave) {
      const { get } = await import("@vercel/blob");
      const r = await get(chave, { access: "private", token });
      if (!r || r.statusCode !== 200) return null;
      return { corpo: r.stream, contentType: r.blob.contentType, tamanho: r.blob.size };
    },
    async urlTemporaria(chave, validadeSegundos = 300) {
      try {
        const { issueSignedToken, presignUrl } = await import("@vercel/blob");
        const validUntil = Date.now() + validadeSegundos * 1000;
        const assinado = await issueSignedToken({ pathname: chave, operations: ["get"], validUntil, ...(token ? { token } : {}) });
        const { presignedUrl } = await presignUrl(assinado, { operation: "get", pathname: chave, validUntil, access: "private" });
        return presignedUrl;
      } catch {
        return null;
      }
    },
  };
}

export function obterArmazenamento(): Armazenamento {
  const token = process.env.BLOB_READ_WRITE_TOKEN?.trim();
  if (token) return armazenamentoBlob(token);
  if (process.env.VERCEL === "1" && process.env.BLOB_STORE_ID?.trim()) return armazenamentoBlob(undefined);
  if (process.env.VERCEL === "1") throw new ArmazenamentoNaoConfiguradoError();
  return armazenamentoLocal();
}

export function provedorConfigurado(): Provedor | "nenhum" {
  if (process.env.BLOB_READ_WRITE_TOKEN?.trim()) return "blob";
  if (process.env.VERCEL === "1" && process.env.BLOB_STORE_ID?.trim()) return "blob";
  if (process.env.VERCEL === "1") return "nenhum";
  return "local";
}
