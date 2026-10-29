import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";
import { obterSegredoBase } from "@/lib/segredos";

/**
 * Cifra dos dados de pagamento dos prestadores (AES-256-GCM).
 * Chave: CHAVE_CIFRA_DADOS, ou derivada por HKDF do segredo da instalação.
 */
function chave(): Buffer {
  const base = process.env.CHAVE_CIFRA_DADOS?.trim() || obterSegredoBase();
  return Buffer.from(hkdfSync("sha256", base, "dados-pagamento", "aes-256-gcm", 32));
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const corpo = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), corpo.toString("base64url")].join(".");
}

export function decifrar(valor: string): string | null {
  try {
    const [v, iv, tag, corpo] = valor.split(".");
    if (v !== "v1") return null;
    const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(corpo, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}

/** "chave Pix ••••4321" — o que aparece em listas e alertas. */
export function mascarar(texto: string): string {
  const limpo = texto.replace(/\s/g, "");
  return `••••${limpo.slice(-4)}`;
}
