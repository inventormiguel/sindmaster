import { BRAND } from "@/lib/brand";
import { removerToken } from "./mascara";
import type { TgBotInfo, TgFile, TgMessage, TgUpdate, TgWebhookInfo, TecladoInline } from "./tipos";
import { LIMITE_DOWNLOAD_BYTES } from "./tipos";

/**
 * Cliente da Bot API do Telegram com fetch (sem SDK).
 * - 429: espera `parameters.retry_after` e tenta de novo (até `maxTentativas`).
 *   Se a espera pedida passar de `maxEsperaSegundos`, desiste com TelegramApiError
 *   (retryAfter preenchido) para quem chamou reagendar.
 * - 5xx e falha de rede: novas tentativas com espera crescente.
 * - O token nunca aparece em mensagens de erro.
 */

export class TelegramApiError extends Error {
  constructor(
    public readonly metodo: string,
    public readonly codigo: number,
    public readonly descricao: string,
    public readonly retryAfter?: number,
  ) {
    super(`Telegram ${metodo}: ${codigo} ${descricao}`);
    this.name = "TelegramApiError";
  }
}

export class TelegramRedeError extends Error {
  constructor(public readonly metodo: string, mensagem: string) {
    super(`Telegram ${metodo}: falha de rede (${mensagem})`);
    this.name = "TelegramRedeError";
  }
}

/** A pessoa bloqueou o bot, apagou a conta ou removeu o bot. */
export function ehBloqueio(e: unknown): boolean {
  return (
    e instanceof TelegramApiError &&
    e.codigo === 403 &&
    /blocked|deactivated|kicked|not a member|can't initiate/i.test(e.descricao)
  );
}

export function ehChatInexistente(e: unknown): boolean {
  return e instanceof TelegramApiError && e.codigo === 400 && /chat not found|user not found/i.test(e.descricao);
}

export type OpcoesCliente = {
  token: string;
  fetch?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  maxTentativas?: number;
  maxEsperaSegundos?: number;
  base?: string;
  timeoutMs?: number;
};

const esperarPadrao = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export type ClienteTelegram = ReturnType<typeof criarClienteTelegram>;

export type ArquivoEnvio = { campo: "document" | "photo"; bytes: Uint8Array; nome: string; mime: string };

export function criarClienteTelegram(opcoes: OpcoesCliente) {
  const token = opcoes.token;
  const fetchFn = opcoes.fetch ?? fetch;
  const esperar = opcoes.esperar ?? esperarPadrao;
  const maxTentativas = opcoes.maxTentativas ?? 4;
  const maxEspera = opcoes.maxEsperaSegundos ?? 30;
  const base = (opcoes.base ?? "https://api.telegram.org").replace(/\/+$/, "");
  const timeoutPadrao = opcoes.timeoutMs ?? 15000;

  async function chamar<T>(metodo: string, params: Record<string, unknown> = {}, cfg: { timeoutMs?: number } = {}): Promise<T> {
    let ultimoErro: unknown;
    for (let tentativa = 1; tentativa <= maxTentativas; tentativa++) {
      let resposta: Response;
      try {
        // Envio de arquivo (sendDocument/sendPhoto): multipart, com o arquivo em memória.
        const arquivo = params.__arquivo as ArquivoEnvio | undefined;
        let corpo: BodyInit;
        const cabecalhos: Record<string, string> = { "user-agent": BRAND.userAgent };
        if (arquivo) {
          const form = new FormData();
          for (const [k, v] of Object.entries(params)) {
            if (k === "__arquivo" || v === undefined) continue;
            form.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
          }
          form.append(arquivo.campo, new Blob([arquivo.bytes as BlobPart], { type: arquivo.mime }), arquivo.nome);
          corpo = form;
        } else {
          cabecalhos["content-type"] = "application/json";
          corpo = JSON.stringify(params);
        }
        resposta = await fetchFn(`${base}/bot${token}/${metodo}`, {
          method: "POST",
          headers: cabecalhos,
          body: corpo,
          signal: AbortSignal.timeout(cfg.timeoutMs ?? timeoutPadrao),
        });
      } catch (e) {
        ultimoErro = new TelegramRedeError(metodo, removerToken(e instanceof Error ? e.message : String(e), token));
        if (tentativa < maxTentativas) {
          await esperar(500 * 2 ** (tentativa - 1));
          continue;
        }
        throw ultimoErro;
      }

      const corpo = (await resposta.json().catch(() => null)) as {
        ok?: boolean;
        result?: T;
        error_code?: number;
        description?: string;
        parameters?: { retry_after?: number };
      } | null;

      if (corpo?.ok) return corpo.result as T;

      const codigo = corpo?.error_code ?? resposta.status;
      const descricao = removerToken(corpo?.description ?? `HTTP ${resposta.status}`, token);

      if (codigo === 429) {
        const retryAfter = Math.max(1, Number(corpo?.parameters?.retry_after ?? 1));
        ultimoErro = new TelegramApiError(metodo, 429, descricao, retryAfter);
        if (retryAfter <= maxEspera && tentativa < maxTentativas) {
          await esperar(retryAfter * 1000);
          continue;
        }
        throw ultimoErro;
      }
      if (codigo >= 500 && tentativa < maxTentativas) {
        ultimoErro = new TelegramApiError(metodo, codigo, descricao);
        await esperar(500 * 2 ** (tentativa - 1));
        continue;
      }
      throw new TelegramApiError(metodo, codigo, descricao);
    }
    throw ultimoErro;
  }

  return {
    chamar,
    getMe: () => chamar<TgBotInfo>("getMe"),
    getWebhookInfo: () => chamar<TgWebhookInfo>("getWebhookInfo"),
    deleteWebhook: (dropPendingUpdates = false) =>
      chamar<boolean>("deleteWebhook", { drop_pending_updates: dropPendingUpdates }),
    setWebhook: (p: { url: string; secret_token: string; allowed_updates: readonly string[]; max_connections?: number; drop_pending_updates?: boolean }) =>
      chamar<boolean>("setWebhook", p),
    getUpdates: (p: { offset?: number; timeout?: number; allowed_updates?: readonly string[]; limit?: number }) =>
      chamar<TgUpdate[]>("getUpdates", p, { timeoutMs: ((p.timeout ?? 0) + 15) * 1000 }),
    sendMessage: (p: { chat_id: number; text: string; reply_markup?: { inline_keyboard: TecladoInline }; parse_mode?: "HTML"; disable_web_page_preview?: boolean }) =>
      chamar<TgMessage>("sendMessage", comTecladoAceito(p)),
    editMessageText: (p: { chat_id: number; message_id: number; text: string; reply_markup?: { inline_keyboard: TecladoInline } }) =>
      chamar<TgMessage | true>("editMessageText", comTecladoAceito(p)),
    answerCallbackQuery: (p: { callback_query_id: string; text?: string; show_alert?: boolean }) =>
      chamar<boolean>("answerCallbackQuery", p),
    setMyCommands: (p: { commands: { command: string; description: string }[]; scope?: Record<string, unknown> }) =>
      chamar<boolean>("setMyCommands", p),
    /** Envia um arquivo como documento ou foto (o bot manda o PDF, não um link). */
    enviarArquivo: (p: { chat_id: number; arquivo: ArquivoEnvio; caption?: string; reply_markup?: unknown }) =>
      chamar<TgMessage>(p.arquivo.campo === "photo" ? "sendPhoto" : "sendDocument", {
        chat_id: p.chat_id,
        caption: p.caption,
        reply_markup: comTecladoAceito({ reply_markup: p.reply_markup as { inline_keyboard: TecladoInline } | undefined }).reply_markup,
        __arquivo: p.arquivo,
      }),
    getFile: (fileId: string) => chamar<TgFile>("getFile", { file_id: fileId }),

    /** Baixa o conteúdo de um arquivo (limite de 20 MB da Bot API). */
    async baixarArquivo(fileId: string): Promise<{ bytes: Uint8Array; caminho: string; tamanho: number }> {
      const info = await chamar<TgFile>("getFile", { file_id: fileId });
      if (info.file_size && info.file_size > LIMITE_DOWNLOAD_BYTES) {
        throw new ArquivoGrandeDemaisError(info.file_size);
      }
      if (!info.file_path) throw new TelegramApiError("getFile", 400, "arquivo sem caminho para download");
      let r: Response;
      try {
        r = await fetchFn(`${base}/file/bot${token}/${info.file_path}`, {
          headers: { "user-agent": BRAND.userAgent },
          signal: AbortSignal.timeout(60000),
        });
      } catch (e) {
        throw new TelegramRedeError("download", removerToken(e instanceof Error ? e.message : String(e), token));
      }
      if (!r.ok) throw new TelegramApiError("download", r.status, `HTTP ${r.status}`);
      const bytes = new Uint8Array(await r.arrayBuffer());
      if (bytes.byteLength > LIMITE_DOWNLOAD_BYTES) throw new ArquivoGrandeDemaisError(bytes.byteLength);
      return { bytes, caminho: info.file_path, tamanho: bytes.byteLength };
    },
  };
}

export class ArquivoGrandeDemaisError extends Error {
  constructor(public readonly tamanho: number) {
    super(`Arquivo com ${(tamanho / 1024 / 1024).toFixed(1).replace(".", ",")} MB: o limite do Telegram para bots é 20 MB.`);
    this.name = "ArquivoGrandeDemaisError";
  }
}

/* ------------------------- Configuração do ambiente ------------------------- */

export function tokenDoBot(): string | null {
  return process.env.TELEGRAM_BOT_TOKEN?.trim() || null;
}

let clientePadrao: ClienteTelegram | null = null;
let tokenDoClientePadrao: string | null = null;

/** Cliente com o token do ambiente (ou null se o Telegram não estiver configurado). */
export function clienteDoAmbiente(): ClienteTelegram | null {
  const token = tokenDoBot();
  if (!token) return null;
  if (!clientePadrao || tokenDoClientePadrao !== token) {
    clientePadrao = criarClienteTelegram({ token });
    tokenDoClientePadrao = token;
  }
  return clientePadrao;
}

export function exigirCliente(): ClienteTelegram {
  const c = clienteDoAmbiente();
  if (!c) throw new Error("Telegram não configurado: defina TELEGRAM_BOT_TOKEN.");
  return c;
}

/**
 * O Telegram recusa botão com link local ("Wrong HTTP URL") e derruba a mensagem inteira.
 * Rodando no computador (APP_URL local), o botão "Abrir no painel" sai do teclado; o resto vai.
 */
function urlAceitaPeloTelegram(url: string): boolean {
  try {
    const { protocol, hostname } = new URL(url);
    if (protocol !== "https:" && protocol !== "http:" && protocol !== "tg:") return false;
    return !/^(localhost|127\.\d+\.\d+\.\d+|\[::1\]|0\.0\.0\.0)$/i.test(hostname) && !hostname.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function tecladoAceito(teclado: TecladoInline): TecladoInline {
  return teclado
    .map((linha) => linha.filter((b) => !("url" in b) || typeof b.url !== "string" || urlAceitaPeloTelegram(b.url)))
    .filter((linha) => linha.length > 0) as TecladoInline;
}

function comTecladoAceito<T extends { reply_markup?: { inline_keyboard: TecladoInline } }>(p: T): T {
  if (!p.reply_markup?.inline_keyboard) return p;
  const teclado = tecladoAceito(p.reply_markup.inline_keyboard);
  const { reply_markup: _descartado, ...resto } = p;
  void _descartado;
  return (teclado.length ? { ...resto, reply_markup: { inline_keyboard: teclado } } : resto) as T;
}
