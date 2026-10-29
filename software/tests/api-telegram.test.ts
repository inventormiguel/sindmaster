import { describe, expect, it } from "vitest";
import { criarClienteTelegram, ehBloqueio, TelegramApiError, mascararToken, removerToken, ArquivoGrandeDemaisError } from "@/lib/telegram";

const TOKEN = "987654321:BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB";

/** fetch falso: devolve as respostas da lista, em ordem, e guarda as chamadas. Só nos testes. */
function fetchFalso(respostas: { status: number; corpo: unknown }[]) {
  const chamadas: { url: string; corpo: unknown }[] = [];
  const fn = (async (url: string | URL | Request, init?: RequestInit) => {
    chamadas.push({ url: String(url), corpo: init?.body ? JSON.parse(String(init.body)) : null });
    const r = respostas.shift();
    if (!r) throw new Error("sem resposta");
    return new Response(JSON.stringify(r.corpo), { status: r.status, headers: { "content-type": "application/json" } });
  }) as typeof fetch;
  return { fn, chamadas };
}

const ok = (result: unknown) => ({ status: 200, corpo: { ok: true, result } });
const limite = (s: number) => ({ status: 429, corpo: { ok: false, error_code: 429, description: `Too Many Requests: retry after ${s}`, parameters: { retry_after: s } } });

describe("cliente da Bot API", () => {
  it("429: espera retry_after e tenta de novo", async () => {
    const esperas: number[] = [];
    const { fn, chamadas } = fetchFalso([limite(3), ok({ message_id: 9 })]);
    const c = criarClienteTelegram({ token: TOKEN, fetch: fn, esperar: async (ms) => void esperas.push(ms) });
    const msg = await c.sendMessage({ chat_id: 1, text: "oi" });
    expect(msg.message_id).toBe(9);
    expect(esperas).toEqual([3000]);
    expect(chamadas).toHaveLength(2);
    expect(chamadas[0].url).toContain("/sendMessage");
  });

  it("429 seguidos: desiste depois do máximo de tentativas, com retryAfter no erro", async () => {
    const esperas: number[] = [];
    const { fn } = fetchFalso([limite(1), limite(2), limite(4)]);
    const c = criarClienteTelegram({ token: TOKEN, fetch: fn, esperar: async (ms) => void esperas.push(ms), maxTentativas: 3 });
    const erro = await c.sendMessage({ chat_id: 1, text: "oi" }).catch((e) => e);
    expect(erro).toBeInstanceOf(TelegramApiError);
    expect(erro.codigo).toBe(429);
    expect(erro.retryAfter).toBe(4);
    expect(esperas).toEqual([1000, 2000]);
  });

  it("429 com espera longa demais: devolve o erro na hora para reagendar", async () => {
    const esperas: number[] = [];
    const { fn } = fetchFalso([limite(120)]);
    const c = criarClienteTelegram({ token: TOKEN, fetch: fn, esperar: async (ms) => void esperas.push(ms), maxEsperaSegundos: 30 });
    const erro = await c.sendMessage({ chat_id: 1, text: "oi" }).catch((e) => e);
    expect(erro.retryAfter).toBe(120);
    expect(esperas).toEqual([]);
  });

  it("5xx: tenta de novo com espera crescente", async () => {
    const esperas: number[] = [];
    const { fn } = fetchFalso([{ status: 502, corpo: { ok: false, error_code: 502, description: "Bad Gateway" } }, ok(true)]);
    const c = criarClienteTelegram({ token: TOKEN, fetch: fn, esperar: async (ms) => void esperas.push(ms) });
    expect(await c.deleteWebhook()).toBe(true);
    expect(esperas).toEqual([500]);
  });

  it("403 de bloqueio é reconhecido e não é repetido", async () => {
    const { fn, chamadas } = fetchFalso([{ status: 403, corpo: { ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" } }]);
    const c = criarClienteTelegram({ token: TOKEN, fetch: fn, esperar: async () => undefined });
    const erro = await c.sendMessage({ chat_id: 1, text: "oi" }).catch((e) => e);
    expect(ehBloqueio(erro)).toBe(true);
    expect(chamadas).toHaveLength(1);
  });

  it("o token não aparece nas mensagens de erro", async () => {
    const fn = (async () => {
      throw new Error(`connect ECONNREFUSED https://api.telegram.org/bot${TOKEN}/getMe`);
    }) as typeof fetch;
    const c = criarClienteTelegram({ token: TOKEN, fetch: fn, esperar: async () => undefined, maxTentativas: 1 });
    const erro = await c.getMe().catch((e) => e);
    expect(String(erro.message)).not.toContain(TOKEN);
    expect(mascararToken(TOKEN)).toBe("••••BBBB");
    expect(removerToken(`x ${TOKEN} y`, null)).not.toContain(TOKEN);
  });

  it("arquivo acima de 20 MB não é baixado", async () => {
    const { fn, chamadas } = fetchFalso([ok({ file_id: "f", file_unique_id: "u", file_size: 21 * 1024 * 1024, file_path: "documents/x.pdf" })]);
    const c = criarClienteTelegram({ token: TOKEN, fetch: fn, esperar: async () => undefined });
    await expect(c.baixarArquivo("f")).rejects.toBeInstanceOf(ArquivoGrandeDemaisError);
    expect(chamadas).toHaveLength(1);
  });
});
