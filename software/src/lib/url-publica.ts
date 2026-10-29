/**
 * Endereço público do sistema, respeitando proxies (X-Forwarded-Host/Proto).
 * Nunca monte a URL a partir do endereço da requisição: atrás de proxy, ele aponta para
 * o endereço interno.
 */
const PORTA_PADRAO = 3241;

function primeiro(valor: string | null): string | null {
  if (!valor) return null;
  const v = valor.split(",")[0]?.trim();
  return v || null;
}

function ehLocal(host: string): boolean {
  return /^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/i.test(host) || host.endsWith(".localhost");
}

export function appUrl(): string {
  const v = process.env.APP_URL?.trim();
  if (v) return v.replace(/\/+$/, "");
  return `http://localhost:${PORTA_PADRAO}`;
}

export function origemPublica(headers: Headers): string {
  const host = primeiro(headers.get("x-forwarded-host")) ?? primeiro(headers.get("host"));
  if (!host) return appUrl();
  const proto = primeiro(headers.get("x-forwarded-proto")) ?? (ehLocal(host) ? "http" : "https");
  return `${proto}://${host}`;
}

export function urlPublica(headers: Headers, caminho: string): URL {
  return new URL(caminho, origemPublica(headers));
}

export function protocoloSeguro(headers: Headers): boolean {
  return origemPublica(headers).startsWith("https://");
}

export function appUrlEhLocal(): boolean {
  try {
    return ehLocal(new URL(appUrl()).host);
  } catch {
    return true;
  }
}
