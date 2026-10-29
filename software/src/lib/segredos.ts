import { createHmac, randomBytes, timingSafeEqual, createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

/**
 * Segredo base da instalação.
 * - Em produção (VERCEL=1): AUTH_SECRET é obrigatório.
 * - Local: AUTH_SECRET, se existir; senão 32 bytes aleatórios gerados na
 *   primeira execução em ./.data/segredo-local (permissão 0600).
 * Nenhum segredo fixo no código.
 */
let segredoEmCache: string | null = null;

export function diretorioDados(): string {
  return process.env.DATA_DIR ?? path.join(process.cwd(), ".data");
}

export function obterSegredoBase(): string {
  if (segredoEmCache) return segredoEmCache;
  const doAmbiente = process.env.AUTH_SECRET?.trim();
  if (doAmbiente) {
    segredoEmCache = doAmbiente;
    return doAmbiente;
  }
  if (process.env.VERCEL === "1") {
    throw new Error("AUTH_SECRET não configurado. Defina a variável no projeto antes do deploy.");
  }
  const dir = diretorioDados();
  const arquivo = path.join(dir, "segredo-local");
  if (!fs.existsSync(arquivo)) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(arquivo, randomBytes(32).toString("hex"), { mode: 0o600 });
  }
  segredoEmCache = fs.readFileSync(arquivo, "utf8").trim();
  return segredoEmCache;
}

/** Deriva um segredo de uso específico a partir do segredo base. */
export function derivarSegredo(finalidade: string): string {
  return createHmac("sha256", obterSegredoBase()).update(finalidade).digest("hex");
}

/** Segredo do cron: CRON_SECRET (Vercel) ou derivado do segredo da instalação. */
export function segredoCron(): string {
  return process.env.CRON_SECRET?.trim() || derivarSegredo("cron");
}

/**
 * Segredo do webhook do Telegram (header X-Telegram-Bot-Api-Secret-Token).
 * TELEGRAM_WEBHOOK_SECRET, se existir; senão derivado do segredo da instalação.
 * O Telegram aceita 1 a 256 caracteres A-Z, a-z, 0-9, _ e -.
 */
export function segredoWebhookTelegram(): string {
  return process.env.TELEGRAM_WEBHOOK_SECRET?.trim() || derivarSegredo("telegram-webhook");
}

/** Comparação em tempo constante (também quando os tamanhos diferem). */
export function compararSegredo(recebido: string | null | undefined, esperado: string): boolean {
  if (!recebido || !esperado) return false;
  const a = createHash("sha256").update(recebido).digest();
  const b = createHash("sha256").update(esperado).digest();
  return timingSafeEqual(a, b) && recebido.length === esperado.length;
}

/** Usado só nos testes, para isolar o cache entre cenários. */
export function limparCacheSegredos() {
  segredoEmCache = null;
}
