import { createHash, randomBytes } from "node:crypto";
import { and, eq, isNull, gt } from "drizzle-orm";
import { db } from "@/db";
import { condominios, pessoas, telegramContas, telegramConvites } from "@/db/schema";
import type { PessoaVinculada } from "./roteador";

/**
 * Vínculo pessoa ↔ chat do Telegram, sem senha.
 * O painel gera um convite de uso único com validade; só o hash SHA-256 do
 * código fica no banco. O código vai no deep link https://t.me/<bot>?start=<código>.
 */

export const VALIDADES_HORAS = [24, 72, 168] as const;
export const VALIDADE_PADRAO_HORAS = 72;

/** 32 bytes aleatórios (256 bits) em base64url: 43 caracteres, cabe no limite de 64 do parâmetro start. */
export function gerarCodigoConvite(): string {
  return randomBytes(32).toString("base64url");
}

export function hashCodigo(codigo: string): string {
  return createHash("sha256").update(codigo, "utf8").digest("hex");
}

export function codigoComFormatoValido(codigo: string): boolean {
  return /^[A-Za-z0-9_-]{20,64}$/.test(codigo);
}

export function linkDoConvite(usernameBot: string, codigo: string): string {
  return `https://t.me/${usernameBot.replace(/^@/, "")}?start=${codigo}`;
}

export async function criarConvite(p: {
  organizacaoId: string;
  pessoaId: string;
  validadeHoras?: number;
  criadoPorUsuarioId?: string | null;
  agora?: Date;
}) {
  const agora = p.agora ?? new Date();
  const [pessoa] = await db
    .select({ id: pessoas.id, condominioId: pessoas.condominioId })
    .from(pessoas)
    .where(and(eq(pessoas.id, p.pessoaId), eq(pessoas.organizacaoId, p.organizacaoId)))
    .limit(1);
  if (!pessoa) throw new Error("Pessoa não encontrada.");
  const horas = p.validadeHoras ?? VALIDADE_PADRAO_HORAS;
  if (!(horas > 0 && horas <= 24 * 30)) throw new Error("Validade do convite inválida.");
  const codigo = gerarCodigoConvite();
  const expiraEm = new Date(agora.getTime() + horas * 3600 * 1000);

  // Um convite ativo por pessoa: os anteriores ainda não usados são revogados.
  await db
    .update(telegramConvites)
    .set({ revogadoEm: agora })
    .where(and(eq(telegramConvites.pessoaId, pessoa.id), isNull(telegramConvites.usadoEm), isNull(telegramConvites.revogadoEm)));

  const [convite] = await db
    .insert(telegramConvites)
    .values({
      organizacaoId: p.organizacaoId,
      condominioId: pessoa.condominioId,
      pessoaId: pessoa.id,
      codigoHash: hashCodigo(codigo),
      expiraEm,
      criadoPorUsuarioId: p.criadoPorUsuarioId ?? null,
      criadoEm: agora,
    })
    .returning();
  return { codigo, convite };
}

export async function revogarConvite(organizacaoId: string, conviteId: string, agora = new Date()) {
  await db
    .update(telegramConvites)
    .set({ revogadoEm: agora })
    .where(
      and(
        eq(telegramConvites.id, conviteId),
        eq(telegramConvites.organizacaoId, organizacaoId),
        isNull(telegramConvites.usadoEm),
        isNull(telegramConvites.revogadoEm),
      ),
    );
}

export type MotivoRecusa = "formato" | "invalido" | "usado" | "vencido" | "revogado";

export type ResultadoResgate = { ok: true; pessoa: PessoaVinculada } | { ok: false; motivo: MotivoRecusa };

export const MENSAGEM_RECUSA: Record<MotivoRecusa, string> = {
  formato: "Este código de convite não é válido. Confira o link que você recebeu.",
  invalido: "Não encontrei este convite. Confira o link ou peça um novo ao síndico ou à administradora.",
  usado: "Este convite já foi usado. Cada convite vale uma vez só: peça um novo ao síndico ou à administradora.",
  vencido: "Este convite venceu. Peça um novo ao síndico ou à administradora.",
  revogado: "Este convite foi cancelado. Peça um novo ao síndico ou à administradora.",
};

/** /start <código>: confere o convite e vincula o chat à pessoa. */
/** /start <código>: confere o convite e vincula o chat à pessoa (sem soltar os outros vínculos da conta). */
export async function resgatarConvite(p: {
  codigo: string;
  chatId: number;
  telegramUserId: number;
  username?: string | null;
  nomeTelegram?: string | null;
  agora?: Date;
}): Promise<ResultadoResgate> {
  const agora = p.agora ?? new Date();
  if (!codigoComFormatoValido(p.codigo)) return { ok: false, motivo: "formato" };
  const [convite] = await db
    .select()
    .from(telegramConvites)
    .where(eq(telegramConvites.codigoHash, hashCodigo(p.codigo)))
    .limit(1);
  if (!convite) return { ok: false, motivo: "invalido" };
  if (convite.usadoEm) return { ok: false, motivo: "usado" };
  if (convite.revogadoEm) return { ok: false, motivo: "revogado" };
  if (convite.expiraEm.getTime() <= agora.getTime()) return { ok: false, motivo: "vencido" };

  const r = await db.transaction(async (tx) => {
    // Marca como usado só se ainda estiver livre (protege contra dois /start ao mesmo tempo).
    const marcados = await tx
      .update(telegramConvites)
      .set({ usadoEm: agora, usadoPorTelegramUserId: p.telegramUserId })
      .where(
        and(
          eq(telegramConvites.id, convite.id),
          isNull(telegramConvites.usadoEm),
          isNull(telegramConvites.revogadoEm),
          gt(telegramConvites.expiraEm, agora),
        ),
      )
      .returning({ id: telegramConvites.id });
    if (marcados.length === 0) return { ok: false as const, motivo: "usado" as const };

    // Conta do Telegram (uma por usuário): guarda o chat e os vínculos com várias pessoas.
    const [conta] = await tx
      .insert(telegramContas)
      .values({ telegramUserId: p.telegramUserId, chatId: p.chatId, username: p.username ?? null, nome: p.nomeTelegram ?? null, contextoPessoaId: convite.pessoaId })
      .onConflictDoUpdate({
        target: telegramContas.chatId,
        set: { telegramUserId: p.telegramUserId, username: p.username ?? null, nome: p.nomeTelegram ?? null, contextoPessoaId: convite.pessoaId, botBloqueadoEm: null },
      })
      .returning({ id: telegramContas.id });

    const [pessoaAntes] = await tx.select({ provisoria: pessoas.provisoria }).from(pessoas).where(eq(pessoas.id, convite.pessoaId)).limit(1);
    await tx
      .update(pessoas)
      .set({
        telegramChatId: p.chatId,
        telegramUserId: p.telegramUserId,
        telegramUsername: p.username ?? null,
        telegramNome: p.nomeTelegram ?? null,
        telegramContaId: conta.id,
        vinculadoEm: agora,
        botBloqueadoEm: null,
        revogadaEm: null,
        saiuEm: null,
        // Convite da unidade: o cadastro provisório ("Morador do 302") ganha o nome do Telegram.
        ...(pessoaAntes?.provisoria && p.nomeTelegram ? { nome: p.nomeTelegram.slice(0, 80), provisoria: false } : {}),
      })
      .where(eq(pessoas.id, convite.pessoaId));
    return { ok: true as const };
  });
  if (!r.ok) return r;
  const pessoa = await buscarPessoaPorChat(p.chatId);
  if (!pessoa) return { ok: false, motivo: "invalido" };
  return { ok: true, pessoa };
}

const COLUNAS_PESSOA = {
  id: pessoas.id,
  nome: pessoas.nome,
  papel: pessoas.papel,
  unidade: pessoas.unidade,
  organizacaoId: pessoas.organizacaoId,
  condominioId: pessoas.condominioId,
  condominioNome: condominios.nome,
};

/** Todos os vínculos (pessoas) de um chat: um por condomínio e papel. */
export async function vinculosDoChat(chatId: number): Promise<PessoaVinculada[]> {
  const linhas = await db
    .select(COLUNAS_PESSOA)
    .from(pessoas)
    .innerJoin(condominios, eq(condominios.id, pessoas.condominioId))
    .where(and(eq(pessoas.telegramChatId, chatId), isNull(pessoas.removidaEm), isNull(pessoas.saiuEm)))
    .orderBy(condominios.nome);
  return linhas.map((l) => ({ ...l, vinculos: linhas.length }));
}

/**
 * Pessoa do condomínio atual do chat. Com um vínculo só, é ele. Com vários, é o
 * contexto escolhido por /condominio; sem contexto, devolve null (o roteador pede a escolha).
 */
export async function buscarPessoaPorChat(chatId: number): Promise<PessoaVinculada | null> {
  const lista = await vinculosDoChat(chatId);
  if (lista.length === 0) return null;
  if (lista.length === 1) return lista[0];
  const [conta] = await db.select({ contexto: telegramContas.contextoPessoaId }).from(telegramContas).where(eq(telegramContas.chatId, chatId)).limit(1);
  return lista.find((x) => x.id === conta?.contexto) ?? null;
}

/** /condominio: troca o condomínio atual (só entre os vínculos do próprio chat). */
export async function trocarContexto(chatId: number, pessoaId: string): Promise<PessoaVinculada | null> {
  const lista = await vinculosDoChat(chatId);
  const alvo = lista.find((x) => x.id === pessoaId);
  if (!alvo) return null;
  await db.update(telegramContas).set({ contextoPessoaId: alvo.id }).where(eq(telegramContas.chatId, chatId));
  return alvo;
}

const SEM_VINCULO = {
  telegramChatId: null,
  telegramUserId: null,
  telegramUsername: null,
  telegramNome: null,
  telegramContaId: null,
  vinculadoEm: null,
  botBloqueadoEm: null,
};

async function limparContexto(pessoaId: string) {
  await db.update(telegramContas).set({ contextoPessoaId: null }).where(eq(telegramContas.contextoPessoaId, pessoaId));
}

/** Desvincular pelo painel (sempre filtrado pela organização). O histórico fica, sem o identificador do Telegram. */
export async function desvincularPessoa(organizacaoId: string, pessoaId: string) {
  const r = await db
    .update(pessoas)
    .set({ ...SEM_VINCULO, revogadaEm: new Date() })
    .where(and(eq(pessoas.id, pessoaId), eq(pessoas.organizacaoId, organizacaoId)))
    .returning({ id: pessoas.id });
  if (r.length > 0) await limparContexto(pessoaId);
  return r.length > 0;
}

/** Desvincular pelo próprio Telegram (/sair): só o vínculo do condomínio atual. */
export async function desvincularChat(chatId: number) {
  const atual = await buscarPessoaPorChat(chatId);
  if (!atual) return false;
  await db.update(pessoas).set(SEM_VINCULO).where(eq(pessoas.id, atual.id));
  await limparContexto(atual.id);
  return true;
}

/** A pessoa bloqueou (ou desbloqueou) o bot: vale para todos os vínculos do chat. */
export async function marcarBloqueio(chatId: number, bloqueado: boolean, agora = new Date()) {
  await db.update(telegramContas).set({ botBloqueadoEm: bloqueado ? agora : null }).where(eq(telegramContas.chatId, chatId));
  await db
    .update(pessoas)
    .set({ botBloqueadoEm: bloqueado ? agora : null })
    .where(eq(pessoas.telegramChatId, chatId));
}
