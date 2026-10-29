import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pessoas, telegramConvites } from "@/db/schema";
import {
  criarConvite,
  desvincularPessoa,
  gerarCodigoConvite,
  hashCodigo,
  linkDoConvite,
  MENSAGEM_RECUSA,
  montarRoteador,
  resgatarConvite,
  revogarConvite,
  tratarUpdate,
} from "@/lib/telegram";
import { criarCenario, mensagem, prepararBanco, saidaDeTeste } from "./ajuda";

let c: Awaited<ReturnType<typeof criarCenario>>;

beforeAll(async () => {
  await prepararBanco();
  c = await criarCenario();
});

describe("código do convite", () => {
  it("tem 256 bits em base64url e cabe no parâmetro start (até 64 caracteres)", () => {
    const codigo = gerarCodigoConvite();
    expect(codigo).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(gerarCodigoConvite()).not.toBe(codigo);
    expect(linkDoConvite("@meu_bot", codigo)).toBe(`https://t.me/meu_bot?start=${codigo}`);
  });

  it("só o hash fica no banco", async () => {
    const p = await c.nova("Hash", "morador");
    const { codigo, convite } = await criarConvite({ organizacaoId: c.org.id, pessoaId: p.id });
    expect(convite.codigoHash).toBe(hashCodigo(codigo));
    const linhas = await db.select().from(telegramConvites);
    expect(JSON.stringify(linhas)).not.toContain(codigo);
  });
});

describe("vínculo por /start <código>", () => {
  it("código certo vincula chat e usuário do Telegram à pessoa e ao condomínio", async () => {
    const p = await c.nova("Ana Moradora", "morador", { unidade: "B-12" });
    const { codigo } = await criarConvite({ organizacaoId: c.org.id, pessoaId: p.id });
    const { saida, enviadas } = saidaDeTeste();
    await tratarUpdate(mensagem(7001, `/start ${codigo}`), saida, montarRoteador());
    expect(enviadas[0].texto).toContain("Pronto, Ana Moradora");
    expect(enviadas[0].texto).toContain(c.cond.nome);
    const [atual] = await db.select().from(pessoas).where(eq(pessoas.id, p.id));
    expect(atual.telegramChatId).toBe(7001);
    expect(atual.telegramUserId).toBe(7001);
    expect(atual.vinculadoEm).not.toBeNull();
  });

  it("código já usado é recusado (inclusive por outra pessoa)", async () => {
    const p = await c.nova("Bruno", "funcionario");
    const { codigo } = await criarConvite({ organizacaoId: c.org.id, pessoaId: p.id });
    expect((await resgatarConvite({ codigo, chatId: 7002, telegramUserId: 7002 })).ok).toBe(true);
    const segunda = await resgatarConvite({ codigo, chatId: 7003, telegramUserId: 7003 });
    expect(segunda).toEqual({ ok: false, motivo: "usado" });
    const { saida, enviadas } = saidaDeTeste();
    await tratarUpdate(mensagem(7003, `/start ${codigo}`), saida, montarRoteador());
    expect(enviadas[0].texto).toBe(MENSAGEM_RECUSA.usado);
  });

  it("código vencido é recusado", async () => {
    const p = await c.nova("Carla", "prestador");
    const criado = new Date(Date.now() - 48 * 3600 * 1000);
    const { codigo } = await criarConvite({ organizacaoId: c.org.id, pessoaId: p.id, validadeHoras: 24, agora: criado });
    expect(await resgatarConvite({ codigo, chatId: 7004, telegramUserId: 7004 })).toEqual({ ok: false, motivo: "vencido" });
    const [atual] = await db.select().from(pessoas).where(eq(pessoas.id, p.id));
    expect(atual.telegramChatId).toBeNull();
  });

  it("código errado ou mal formado é recusado", async () => {
    expect(await resgatarConvite({ codigo: gerarCodigoConvite(), chatId: 7005, telegramUserId: 7005 })).toEqual({ ok: false, motivo: "invalido" });
    expect(await resgatarConvite({ codigo: "curto", chatId: 7005, telegramUserId: 7005 })).toEqual({ ok: false, motivo: "formato" });
    expect(await resgatarConvite({ codigo: "x".repeat(30) + "!", chatId: 7005, telegramUserId: 7005 })).toEqual({ ok: false, motivo: "formato" });
  });

  it("convite cancelado é recusado; gerar outro cancela o anterior", async () => {
    const p = await c.nova("Davi", "morador");
    const primeiro = await criarConvite({ organizacaoId: c.org.id, pessoaId: p.id });
    const segundo = await criarConvite({ organizacaoId: c.org.id, pessoaId: p.id });
    expect(await resgatarConvite({ codigo: primeiro.codigo, chatId: 7006, telegramUserId: 7006 })).toEqual({ ok: false, motivo: "revogado" });
    await revogarConvite(c.org.id, segundo.convite.id);
    expect(await resgatarConvite({ codigo: segundo.codigo, chatId: 7006, telegramUserId: 7006 })).toEqual({ ok: false, motivo: "revogado" });
  });

  it("outra organização não consegue gerar convite nem desvincular pessoa alheia", async () => {
    const outra = await criarCenario("Outra Administradora");
    const p = await c.nova("Eva", "morador", { telegramChatId: 7007, telegramUserId: 7007 });
    await expect(criarConvite({ organizacaoId: outra.org.id, pessoaId: p.id })).rejects.toThrow("Pessoa não encontrada");
    expect(await desvincularPessoa(outra.org.id, p.id)).toBe(false);
    const [atual] = await db.select().from(pessoas).where(eq(pessoas.id, p.id));
    expect(atual.telegramChatId).toBe(7007);
  });

  it("desvincular pelo painel solta o chat; o chat volta a receber só a instrução", async () => {
    const p = await c.nova("Fábio", "morador", { telegramChatId: 7008, telegramUserId: 7008 });
    expect(await desvincularPessoa(c.org.id, p.id)).toBe(true);
    const { saida, enviadas } = saidaDeTeste();
    await tratarUpdate(mensagem(7008, "/eu"), saida, montarRoteador());
    expect(enviadas[0].texto).toContain("peça ao síndico ou à administradora");
  });

  it("B1: o convite novo ACRESCENTA o vínculo à conta (não solta o anterior) e põe o contexto nele", async () => {
    const p1 = await c.nova("Gil 1", "morador");
    const p2 = await c.nova("Gil 2", "prestador");
    const a = await criarConvite({ organizacaoId: c.org.id, pessoaId: p1.id });
    const b = await criarConvite({ organizacaoId: c.org.id, pessoaId: p2.id });
    expect((await resgatarConvite({ codigo: a.codigo, chatId: 7009, telegramUserId: 7009 })).ok).toBe(true);
    const r = await resgatarConvite({ codigo: b.codigo, chatId: 7009, telegramUserId: 7009 });
    expect(r.ok && r.pessoa.id).toBe(p2.id);
    const [x] = await db.select().from(pessoas).where(eq(pessoas.id, p1.id));
    const [y] = await db.select().from(pessoas).where(eq(pessoas.id, p2.id));
    expect(x.telegramChatId).toBe(7009);
    expect(y.telegramChatId).toBe(7009);
    expect(x.telegramContaId).toBe(y.telegramContaId);
  });

  it("dois /start simultâneos com o mesmo código: só um vincula", async () => {
    const p = await c.nova("Hugo", "morador");
    const { codigo } = await criarConvite({ organizacaoId: c.org.id, pessoaId: p.id });
    const rs = await Promise.all([
      resgatarConvite({ codigo, chatId: 7010, telegramUserId: 7010 }),
      resgatarConvite({ codigo, chatId: 7011, telegramUserId: 7011 }),
    ]);
    expect(rs.filter((r) => r.ok)).toHaveLength(1);
  });
});
