import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { envios, pessoas } from "@/db/schema";
import { criarClienteTelegram, enfileirarAvisoPapel, enfileirarAvisoPessoa, LimitadorEnvio, processarFilaEnvios } from "@/lib/telegram";
import { criarCenario, prepararBanco } from "./ajuda";

const TOKEN = "111111111:CCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCC";
let c: Awaited<ReturnType<typeof criarCenario>>;

/** Telegram falso: o chat 902 bloqueou o bot; os outros recebem. Só nos testes. */
function telegramFalso() {
  const enviados: { chat_id: number; text: string }[] = [];
  let id = 1;
  const fn = (async (_url: string | URL | Request, init?: RequestInit) => {
    const corpo = JSON.parse(String(init?.body));
    if (corpo.chat_id === 902) {
      return Response.json({ ok: false, error_code: 403, description: "Forbidden: bot was blocked by the user" }, { status: 403 });
    }
    enviados.push(corpo);
    return Response.json({ ok: true, result: { message_id: id++, date: 0, chat: { id: corpo.chat_id, type: "private" } } });
  }) as typeof fetch;
  return { cliente: criarClienteTelegram({ token: TOKEN, fetch: fn, esperar: async () => undefined }), enviados };
}

const semEspera = () => new LimitadorEnvio({ esperar: async () => undefined });

beforeAll(async () => {
  await prepararBanco();
  c = await criarCenario();
  await c.nova("Morador A", "morador", { telegramChatId: 901 });
  await c.nova("Morador Bloqueou", "morador", { telegramChatId: 902 });
  await c.nova("Morador Sem Telegram", "morador");
  await c.nova("Funcionário", "funcionario", { telegramChatId: 903 });
});

describe("avisos pelo Telegram", () => {
  it("aviso para um papel: cada pessoa recebe a própria mensagem; entrega e erro ficam registrados", async () => {
    const r = await enfileirarAvisoPapel({ organizacaoId: c.org.id, condominioId: c.cond.id, papeis: ["morador"], texto: "Limpeza da caixa d'água na terça." });
    expect(r).toMatchObject({ enfileirados: 2, semVinculo: 1, bloqueados: 0 });

    const { cliente, enviados } = telegramFalso();
    const resumo = await processarFilaEnvios({ cliente, limitador: semEspera() });
    expect(resumo).toMatchObject({ enviados: 1, erros: 1, restantes: 0 });
    expect(enviados.map((e) => e.chat_id)).toEqual([901]);

    const linhas = await db.select().from(envios).where(eq(envios.loteId, r.loteId));
    const porStatus = Object.fromEntries(linhas.map((l) => [l.chatId ?? "sem", l.status]));
    expect(porStatus).toEqual({ 901: "enviado", 902: "erro", sem: "nao_enviado" });

    // Quem bloqueou o bot fica marcado no cadastro e não entra nos próximos avisos.
    const [bloqueou] = await db.select().from(pessoas).where(eq(pessoas.telegramChatId, 902));
    expect(bloqueou.botBloqueadoEm).not.toBeNull();
    const r2 = await enfileirarAvisoPapel({ organizacaoId: c.org.id, condominioId: c.cond.id, papeis: ["morador"], texto: "Outro aviso." });
    expect(r2).toMatchObject({ enfileirados: 1, bloqueados: 1, semVinculo: 1 });
  });

  it("a chave de idempotência evita repetir o mesmo lembrete", async () => {
    const [f] = await db.select().from(pessoas).where(eq(pessoas.telegramChatId, 903));
    const a = await enfileirarAvisoPessoa({ organizacaoId: c.org.id, pessoaId: f.id, texto: "Vence amanhã: seguro.", chaveIdempotencia: "vencimento:1:2026-11-05" });
    const b = await enfileirarAvisoPessoa({ organizacaoId: c.org.id, pessoaId: f.id, texto: "Vence amanhã: seguro.", chaveIdempotencia: "vencimento:1:2026-11-05" });
    expect(a.enfileirados).toBe(1);
    expect(b.repetidos).toBe(1);
  });

  it("outra organização não consegue mandar aviso para pessoa alheia", async () => {
    const outra = await criarCenario("Outra");
    const [f] = await db.select().from(pessoas).where(eq(pessoas.telegramChatId, 903));
    await expect(enfileirarAvisoPessoa({ organizacaoId: outra.org.id, pessoaId: f.id, texto: "x" })).rejects.toThrow("Pessoa não encontrada");
  });

  it("429 com espera longa: o envio volta para a fila com nova data", async () => {
    const fn = (async () =>
      Response.json({ ok: false, error_code: 429, description: "Too Many Requests", parameters: { retry_after: 90 } }, { status: 429 })) as typeof fetch;
    const cliente = criarClienteTelegram({ token: TOKEN, fetch: fn, esperar: async () => undefined, maxEsperaSegundos: 30 });
    const resumo = await processarFilaEnvios({ cliente, limitador: semEspera() });
    expect(resumo.adiados).toBeGreaterThanOrEqual(1);
    const pendentes = await db.select().from(envios).where(eq(envios.status, "pendente"));
    expect(pendentes.every((p) => p.proximaTentativaEm.getTime() > Date.now() + 60_000)).toBe(true);
  });
});
