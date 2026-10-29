import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { telegramMensagens, telegramUpdates } from "@/db/schema";
import { compararSegredo, segredoWebhookTelegram } from "@/lib/segredos";
import { HEADER_SEGREDO, montarRoteador, receberUpdate, tratarRequisicaoWebhook } from "@/lib/telegram";
import { criarCenario, mensagem, prepararBanco, saidaDeTeste } from "./ajuda";

const TOKEN_FALSO = "123456789:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA";
const BOT_ID = 123456789;

beforeAll(async () => {
  process.env.TELEGRAM_BOT_TOKEN = TOKEN_FALSO;
  process.env.TELEGRAM_WEBHOOK_SECRET = "segredo_de_teste-123";
  await prepararBanco();
  const c = await criarCenario();
  await c.nova("Pessoa Vinculada", "morador", { telegramChatId: 601, telegramUserId: 601 });
});

function requisicao(corpo: unknown, segredo?: string | null) {
  const headers = new Headers({ "content-type": "application/json" });
  if (segredo != null) headers.set(HEADER_SEGREDO, segredo);
  return new Request("http://interno/api/telegram/webhook", { method: "POST", headers, body: JSON.stringify(corpo) });
}

describe("segredo do webhook", () => {
  it("compararSegredo só aceita o valor exato", () => {
    expect(compararSegredo("abc", "abc")).toBe(true);
    expect(compararSegredo("abd", "abc")).toBe(false);
    expect(compararSegredo("abcd", "abc")).toBe(false);
    expect(compararSegredo("", "abc")).toBe(false);
    expect(compararSegredo(null, "abc")).toBe(false);
  });

  it("usa TELEGRAM_WEBHOOK_SECRET quando definido", () => {
    expect(segredoWebhookTelegram()).toBe("segredo_de_teste-123");
  });

  it("sem header ou com header errado responde 401 e não grava nada", async () => {
    const tarefas: (() => Promise<unknown>)[] = [];
    const agendar = (t: () => Promise<unknown>) => void tarefas.push(t);
    const u = mensagem(601, "oi");
    expect((await tratarRequisicaoWebhook(requisicao(u, null), { agendar })).status).toBe(401);
    expect((await tratarRequisicaoWebhook(requisicao(u, "errado"), { agendar })).status).toBe(401);
    expect(tarefas).toHaveLength(0);
    const linhas = await db.select().from(telegramUpdates).where(eq(telegramUpdates.updateId, u.update_id));
    expect(linhas).toHaveLength(0);
  });

  it("corpo sem update_id responde 400", async () => {
    const r = await tratarRequisicaoWebhook(requisicao({ foo: 1 }, "segredo_de_teste-123"), { agendar: () => undefined });
    expect(r.status).toBe(400);
  });

  it("com o segredo certo responde 200 antes de processar, e processa depois", async () => {
    const tarefas: (() => Promise<unknown>)[] = [];
    const { saida, enviadas } = saidaDeTeste();
    const u = mensagem(601, "/eu");
    const r = await tratarRequisicaoWebhook(requisicao(u, "segredo_de_teste-123"), {
      agendar: (t) => void tarefas.push(t),
      saida,
      roteador: montarRoteador(),
    });
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ ok: true, duplicado: false });
    expect(enviadas).toHaveLength(0); // ainda não processou
    await Promise.all(tarefas.map((t) => t()));
    expect(enviadas).toHaveLength(1);
    const [linha] = await db.select().from(telegramUpdates).where(eq(telegramUpdates.updateId, u.update_id));
    expect(linha.status).toBe("processado");
    expect(linha.payload).toBeNull();
  });
});

describe("idempotência por update_id", () => {
  it("o mesmo update entregue duas vezes pelo webhook é processado uma vez só", async () => {
    const tarefas: (() => Promise<unknown>)[] = [];
    const { saida, enviadas } = saidaDeTeste();
    const u = mensagem(601, "mensagem repetida");
    const opcoes = { agendar: (t: () => Promise<unknown>) => void tarefas.push(t), saida, roteador: montarRoteador() };
    const r1 = await tratarRequisicaoWebhook(requisicao(u, "segredo_de_teste-123"), opcoes);
    const r2 = await tratarRequisicaoWebhook(requisicao(u, "segredo_de_teste-123"), opcoes);
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    expect(await r2.json()).toEqual({ ok: true, duplicado: true });
    await Promise.all(tarefas.map((t) => t()));
    expect(tarefas).toHaveLength(1);
    expect(enviadas).toHaveLength(1);
    const logs = await db.select().from(telegramMensagens).where(eq(telegramMensagens.texto, "mensagem repetida"));
    expect(logs).toHaveLength(1);
  });

  it("polling e webhook compartilham a mesma idempotência", async () => {
    const { saida, enviadas } = saidaDeTeste();
    const u = mensagem(601, "via polling");
    const a = await receberUpdate(BOT_ID, u, "polling", saida, montarRoteador());
    const b = await receberUpdate(BOT_ID, u, "webhook", saida, montarRoteador());
    expect(a.duplicado).toBe(false);
    expect(b.duplicado).toBe(true);
    expect(enviadas).toHaveLength(1);
  });

  it("o mesmo update_id de outro bot não é confundido", async () => {
    const { saida } = saidaDeTeste();
    const u = mensagem(601, "outro bot");
    expect((await receberUpdate(BOT_ID, u, "polling", saida)).duplicado).toBe(false);
    expect((await receberUpdate(BOT_ID + 1, u, "polling", saida)).duplicado).toBe(false);
  });

  it("erro no processamento fica registrado no update", async () => {
    const r = montarRoteador();
    r.registrarMensagemLivre(
      async () => {
        throw new Error(`falhou com ${TOKEN_FALSO}`);
      },
      { prioridade: "inicio" },
    );
    const { saida, enviadas } = saidaDeTeste();
    const u = mensagem(601, "vai dar erro");
    const res = await receberUpdate(BOT_ID, u, "webhook", saida, r);
    expect(res.status).toBe("erro");
    const [linha] = await db.select().from(telegramUpdates).where(eq(telegramUpdates.updateId, u.update_id));
    expect(linha.erro).not.toContain(TOKEN_FALSO);
    expect(enviadas[0].texto).toContain("Tive um problema");
  });
});
