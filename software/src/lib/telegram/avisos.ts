import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray, isNull, lt, lte, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { condominios, envios, pessoas, telegramMensagens, type PapelPessoa } from "@/db/schema";
import { rotuloVinculo } from "./roteador";
import { ehBloqueio, ehChatInexistente, TelegramApiError, type ClienteTelegram } from "./api";
import { limitadorDoProcesso, type LimitadorEnvio } from "./limitador";
import { removerToken } from "./mascara";
import { marcarBloqueio } from "./vinculo";
import type { TecladoInline } from "./tipos";

/**
 * Avisos do sistema pelo Telegram (lembretes de vencimento, tarefas e chamados).
 *
 * Enfileirar não envia: grava uma linha em `envios` por pessoa. O envio é feito
 * por `processarFilaEnvios` (botão "Enviar agora", job diário ou script), que
 * respeita os limites do Telegram e registra entrega ou erro de cada pessoa.
 * Cada mensagem vai só para a própria pessoa: nunca uma lista com dados de outros.
 */

export const MAX_TENTATIVAS = 5;

export type ResultadoEnfileirar = {
  loteId: string;
  enfileirados: number;
  semVinculo: number;
  bloqueados: number;
  repetidos: number;
};

type Destinatario = typeof pessoas.$inferSelect;

async function enfileirar(
  lista: Destinatario[],
  p: { organizacaoId: string; texto: string; categoria?: string; teclado?: TecladoInline; chaveIdempotencia?: (pessoaId: string) => string; criadoPorUsuarioId?: string | null },
): Promise<ResultadoEnfileirar> {
  const loteId = randomUUID();
  const r: ResultadoEnfileirar = { loteId, enfileirados: 0, semVinculo: 0, bloqueados: 0, repetidos: 0 };
  const texto = p.texto.trim();
  if (!texto) throw new Error("O aviso está vazio.");
  if (texto.length > 4096) throw new Error("O aviso passou de 4.096 caracteres (limite do Telegram).");

  // Toda mensagem que sai começa com "{Condomínio} · {papel}" (a conta pode ter vínculos em vários).
  const ids = [...new Set(lista.map((x) => x.condominioId))];
  const nomes = ids.length ? await db.select({ id: condominios.id, nome: condominios.nome }).from(condominios).where(inArray(condominios.id, ids)) : [];
  const nomeDe = new Map(nomes.map((x) => [x.id, x.nome]));
  for (const pessoa of lista) {
    const textoFinal = `${rotuloVinculo({ condominioNome: nomeDe.get(pessoa.condominioId) ?? "", papel: pessoa.papel, unidade: pessoa.unidade })}\n\n${texto}`;
    let status: "pendente" | "nao_enviado" = "pendente";
    let erro: string | null = null;
    if (!pessoa.telegramChatId) {
      status = "nao_enviado";
      erro = "Pessoa sem Telegram vinculado.";
      r.semVinculo++;
    } else if (pessoa.botBloqueadoEm) {
      status = "nao_enviado";
      erro = "A pessoa bloqueou o bot.";
      r.bloqueados++;
    }
    const inseridos = await db
      .insert(envios)
      .values({
        organizacaoId: p.organizacaoId,
        condominioId: pessoa.condominioId,
        pessoaId: pessoa.id,
        chatId: pessoa.telegramChatId,
        categoria: p.categoria ?? "aviso",
        texto: textoFinal,
        teclado: p.teclado ?? null,
        status,
        erro,
        chaveIdempotencia: p.chaveIdempotencia ? p.chaveIdempotencia(pessoa.id) : null,
        loteId,
        criadoPorUsuarioId: p.criadoPorUsuarioId ?? null,
      })
      .onConflictDoNothing()
      .returning({ id: envios.id });
    if (inseridos.length === 0) r.repetidos++;
    else if (status === "pendente") r.enfileirados++;
  }
  return r;
}

/** Aviso para uma pessoa (sempre conferindo a organização). */
export async function enfileirarAvisoPessoa(p: {
  organizacaoId: string;
  pessoaId: string;
  texto: string;
  categoria?: string;
  teclado?: TecladoInline;
  chaveIdempotencia?: string;
  criadoPorUsuarioId?: string | null;
}): Promise<ResultadoEnfileirar> {
  const lista = await db
    .select()
    .from(pessoas)
    .where(and(eq(pessoas.id, p.pessoaId), eq(pessoas.organizacaoId, p.organizacaoId)));
  if (lista.length === 0) throw new Error("Pessoa não encontrada.");
  return enfileirar(lista, { ...p, chaveIdempotencia: p.chaveIdempotencia ? () => p.chaveIdempotencia! : undefined });
}

/** Aviso para todos de um papel (ou de vários papéis) num condomínio. */
export async function enfileirarAvisoPapel(p: {
  organizacaoId: string;
  condominioId: string;
  papeis: PapelPessoa[];
  texto: string;
  categoria?: string;
  teclado?: TecladoInline;
  /** Ex.: (pessoaId) => `vencimento:123:${pessoaId}` para não repetir o mesmo lembrete. */
  chaveIdempotencia?: (pessoaId: string) => string;
  criadoPorUsuarioId?: string | null;
}): Promise<ResultadoEnfileirar> {
  if (p.papeis.length === 0) throw new Error("Escolha ao menos um papel.");
  const lista = await db
    .select()
    .from(pessoas)
    .where(
      and(
        eq(pessoas.organizacaoId, p.organizacaoId),
        eq(pessoas.condominioId, p.condominioId),
        inArray(pessoas.papel, p.papeis),
        // Quem se mudou ou pediu para apagar os dados não recebe mais avisos.
        isNull(pessoas.saiuEm),
        isNull(pessoas.removidaEm),
      ),
    );
  return enfileirar(lista, p);
}

export type ResumoFila = { processados: number; enviados: number; erros: number; adiados: number; restantes: number };

/**
 * Envia os avisos pendentes, em ordem de criação, respeitando os limites.
 * - 429 com retry_after longo: volta para "pendente" com nova data.
 * - Bloqueio (403): marca a pessoa como "bot bloqueado" e o envio como erro.
 * - Outros erros: novas tentativas com espera crescente, até 5.
 * Para quando acabar a fila ou o prazo (`prazoMs`), para caber no tempo da função.
 */
export async function processarFilaEnvios(p: {
  cliente: ClienteTelegram;
  limitador?: LimitadorEnvio;
  limite?: number;
  prazoMs?: number;
  organizacaoId?: string;
  agora?: () => Date;
}): Promise<ResumoFila> {
  const agora = p.agora ?? (() => new Date());
  const limitador = p.limitador ?? limitadorDoProcesso();
  const inicio = Date.now();
  const prazo = p.prazoMs ?? 45000;
  const resumo: ResumoFila = { processados: 0, enviados: 0, erros: 0, adiados: 0, restantes: 0 };

  // Envios presos em "enviando" há mais de 10 minutos (processo caiu) voltam para a fila.
  await db
    .update(envios)
    .set({ status: "pendente" })
    .where(and(eq(envios.status, "enviando"), lt(envios.proximaTentativaEm, new Date(agora().getTime() - 10 * 60 * 1000))));

  const filtroOrg = p.organizacaoId ? eq(envios.organizacaoId, p.organizacaoId) : undefined;
  // O módulo foi removido: mensagens históricas dessa categoria nunca voltam a ser enviadas.
  const categoriaAtiva = ne(envios.categoria, "comunicado");
  const fila = await db
    .select()
    .from(envios)
    .where(and(eq(envios.status, "pendente"), lte(envios.proximaTentativaEm, agora()), categoriaAtiva, filtroOrg))
    .orderBy(asc(envios.criadoEm))
    .limit(p.limite ?? 200);

  for (const envio of fila) {
    if (Date.now() - inicio > prazo) break;
    // Reserva o envio (se outro processo pegou antes, pula).
    const pegos = await db
      .update(envios)
      .set({ status: "enviando", proximaTentativaEm: agora() })
      .where(and(eq(envios.id, envio.id), eq(envios.status, "pendente")))
      .returning({ id: envios.id });
    if (pegos.length === 0) continue;
    resumo.processados++;

    if (!envio.chatId) {
      await db.update(envios).set({ status: "nao_enviado", erro: "Pessoa sem Telegram vinculado." }).where(eq(envios.id, envio.id));
      resumo.erros++;
      continue;
    }

    try {
      await limitador.aguardarVez(envio.chatId);
      const msg = await p.cliente.sendMessage({
        chat_id: envio.chatId,
        text: envio.texto,
        disable_web_page_preview: true,
        ...(envio.teclado ? { reply_markup: { inline_keyboard: envio.teclado as TecladoInline } } : {}),
      });
      await db
        .update(envios)
        .set({ status: "enviado", enviadoEm: agora(), telegramMessageId: msg.message_id, erro: null, tentativas: sql`${envios.tentativas} + 1` })
        .where(eq(envios.id, envio.id));
      await db.insert(telegramMensagens).values({
        organizacaoId: envio.organizacaoId,
        condominioId: envio.condominioId,
        pessoaId: envio.pessoaId,
        chatId: envio.chatId,
        direcao: "saida",
        tipo: "texto",
        texto: envio.texto,
        telegramMessageId: msg.message_id,
        envioId: envio.id,
      });
      resumo.enviados++;
    } catch (e) {
      const descricao = removerToken(e instanceof Error ? e.message : String(e), process.env.TELEGRAM_BOT_TOKEN);
      if (ehBloqueio(e)) {
        await marcarBloqueio(envio.chatId, true);
        await db
          .update(envios)
          .set({ status: "erro", erro: "A pessoa bloqueou o bot.", tentativas: sql`${envios.tentativas} + 1` })
          .where(eq(envios.id, envio.id));
        resumo.erros++;
      } else if (ehChatInexistente(e)) {
        await db
          .update(envios)
          .set({ status: "erro", erro: "Conversa não encontrada no Telegram.", tentativas: sql`${envios.tentativas} + 1` })
          .where(eq(envios.id, envio.id));
        resumo.erros++;
      } else if (e instanceof TelegramApiError && e.codigo === 429 && e.retryAfter) {
        await db
          .update(envios)
          .set({ status: "pendente", erro: `Limite do Telegram: nova tentativa em ${e.retryAfter} s.`, proximaTentativaEm: new Date(agora().getTime() + e.retryAfter * 1000) })
          .where(eq(envios.id, envio.id));
        resumo.adiados++;
      } else {
        const tentativas = envio.tentativas + 1;
        const desistir = tentativas >= MAX_TENTATIVAS || (e instanceof TelegramApiError && e.codigo === 400);
        await db
          .update(envios)
          .set({
            status: desistir ? "erro" : "pendente",
            erro: descricao.slice(0, 500),
            tentativas,
            proximaTentativaEm: new Date(agora().getTime() + 60_000 * 2 ** tentativas),
          })
          .where(eq(envios.id, envio.id));
        if (desistir) resumo.erros++;
        else resumo.adiados++;
      }
    }
  }

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(envios)
    .where(and(eq(envios.status, "pendente"), categoriaAtiva, filtroOrg));
  resumo.restantes = total;
  return resumo;
}
