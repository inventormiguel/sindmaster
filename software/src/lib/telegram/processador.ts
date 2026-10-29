import { and, eq, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { telegramMensagens, telegramUpdates, type StatusUpdate, type TipoMensagem } from "@/db/schema";
import { removerToken } from "./mascara";
import { montarContexto, type Roteador, type Saida } from "./roteador";
import { roteadorPadrao } from "./comandos";
import { tipoDoUpdate, type TgUpdate } from "./tipos";
import { buscarPessoaPorChat, marcarBloqueio, vinculosDoChat } from "./vinculo";
import { lerEstado, limparEstado } from "./estado";
import { tokenDoBot } from "./api";

/**
 * Processador único de updates: o webhook e o polling chamam as mesmas funções.
 *
 * 1. `registrarUpdate` grava (bot, update_id). Se já existia, é repetição: não processa de novo.
 * 2. `processarUpdate` registra a conversa e passa ao roteador.
 */
export type Origem = "webhook" | "polling";

/** Tira o código de convite do texto antes de guardar (o código vale como senha até ser usado). */
export function textoSeguroParaLog(texto: string | null | undefined): string | null {
  if (texto == null) return null;
  if (/^\/start(@\w+)?(\s|$)/i.test(texto)) return "/start";
  return texto.slice(0, 4000);
}

function payloadSeguro(update: TgUpdate): TgUpdate {
  const copia = structuredClone(update);
  if (copia.message?.text) copia.message.text = textoSeguroParaLog(copia.message.text) ?? undefined;
  return copia;
}

export async function registrarUpdate(botId: number, update: TgUpdate, origem: Origem): Promise<boolean> {
  const inseridos = await db
    .insert(telegramUpdates)
    .values({ botId, updateId: update.update_id, tipo: tipoDoUpdate(update), origem, payload: payloadSeguro(update) })
    .onConflictDoNothing()
    .returning({ updateId: telegramUpdates.updateId });
  return inseridos.length > 0;
}

function tipoDaMensagem(update: TgUpdate, comando: string | null): TipoMensagem {
  if (update.callback_query) return "botao";
  const m = update.message;
  if (!m) return "outro";
  if (comando) return "comando";
  if (m.photo?.length) return "foto";
  if (m.document) return "documento";
  if (m.text) return "texto";
  return "outro";
}

/** Trata um update já registrado. Devolve o status final. */
export async function tratarUpdate(update: TgUpdate, saida: Saida, roteador: Roteador = roteadorPadrao()): Promise<StatusUpdate> {
  // Bloqueio/desbloqueio do bot numa conversa privada.
  const membro = update.my_chat_member;
  if (membro) {
    if (membro.chat.type !== "private") return "ignorado";
    const status = membro.new_chat_member.status;
    if (status === "kicked") await marcarBloqueio(membro.chat.id, true);
    else if (status === "member") await marcarBloqueio(membro.chat.id, false);
    return "processado";
  }

  const pessoaInicial = await (async () => {
    const chat = update.message?.chat ?? update.callback_query?.message?.chat;
    if (!chat || chat.type !== "private") return null;
    return buscarPessoaPorChat(chat.id);
  })();

  const ctx = montarContexto({ update, pessoa: pessoaInicial, saida });
  if (!ctx) return "ignorado";
  if (!ctx.chatPrivado) return "ignorado";
  if (!pessoaInicial) {
    const opcoes = await vinculosDoChat(ctx.chatId);
    if (opcoes.length > 1) ctx.opcoesContexto = opcoes;
  } else {
    // Os outros vínculos deste Telegram: um comando de outro perfil troca a conversa para ele.
    if (ctx.comando) {
      const opcoes = await vinculosDoChat(ctx.chatId);
      if (opcoes.length > 1) ctx.opcoesContexto = opcoes;
    }
    const estado = await lerEstado(ctx.chatId);
    // O estado vale só para a pessoa (condomínio) em que foi criado.
    ctx.estado = estado && (!estado.pessoaId || estado.pessoaId === pessoaInicial.id) ? estado : null;
  }
  ctx.limparEstado = () => limparEstado(ctx.chatId);

  // Registro da conversa. De quem não está vinculado, guardamos só o tipo (sem texto).
  const textoOriginal = update.callback_query ? `[botão] ${update.callback_query.data ?? ""}` : ctx.texto;
  const [entrada] = await db
    .insert(telegramMensagens)
    .values({
      organizacaoId: ctx.pessoa?.organizacaoId ?? null,
      condominioId: ctx.pessoa?.condominioId ?? null,
      pessoaId: ctx.pessoa?.id ?? null,
      chatId: ctx.chatId,
      direcao: "entrada",
      tipo: tipoDaMensagem(update, ctx.comando),
      texto: ctx.pessoa || ctx.comando === "start" ? textoSeguroParaLog(textoOriginal) : null,
      telegramMessageId: update.message?.message_id ?? update.callback_query?.message?.message_id ?? null,
      updateId: update.update_id,
    })
    .returning({ id: telegramMensagens.id });
  ctx.registroEntradaId = entrada.id;

  try {
    await roteador.rotear(ctx);
  } catch (e) {
    if (ctx.pessoa) {
      await saida
        .enviarTexto({ chatId: ctx.chatId, pessoa: ctx.pessoa }, "Tive um problema para tratar sua mensagem. Tente de novo em alguns minutos.")
        .catch(() => undefined);
    }
    throw e;
  }

  // Quem acabou de se vincular (/start <código>): a mensagem de entrada passa a pertencer ao condomínio.
  if (!pessoaInicial && ctx.pessoa) {
    await db
      .update(telegramMensagens)
      .set({ organizacaoId: ctx.pessoa.organizacaoId, condominioId: ctx.pessoa.condominioId, pessoaId: ctx.pessoa.id })
      .where(eq(telegramMensagens.id, entrada.id));
  }
  return "processado";
}

export async function processarUpdate(
  botId: number,
  update: TgUpdate,
  saida: Saida,
  roteador?: Roteador,
): Promise<StatusUpdate> {
  let status: StatusUpdate;
  let erro: string | null = null;
  try {
    status = await tratarUpdate(update, saida, roteador);
  } catch (e) {
    status = "erro";
    erro = removerToken(e instanceof Error ? e.message : String(e), tokenDoBot()).slice(0, 1000);
    console.error(`[telegram] erro no update ${update.update_id}: ${erro}`);
  }
  await db
    .update(telegramUpdates)
    .set({
      status,
      erro,
      processadoEm: new Date(),
      tentativas: sql`${telegramUpdates.tentativas} + 1`,
      // Depois de processado, o conteúdo bruto não precisa mais ficar guardado.
      ...(status === "erro" ? {} : { payload: null }),
    })
    .where(and(eq(telegramUpdates.botId, botId), eq(telegramUpdates.updateId, update.update_id)));
  return status;
}

/** Registrar + processar em sequência (polling, testes, reprocessamento). */
export async function receberUpdate(
  botId: number,
  update: TgUpdate,
  origem: Origem,
  saida: Saida,
  roteador?: Roteador,
): Promise<{ duplicado: boolean; status?: StatusUpdate }> {
  const novo = await registrarUpdate(botId, update, origem);
  if (!novo) return { duplicado: true };
  const status = await processarUpdate(botId, update, saida, roteador);
  return { duplicado: false, status };
}

/**
 * Updates que ficaram em "recebido" (processo caiu depois do 200) são
 * reprocessados pelo job diário. Até 3 tentativas.
 */
export async function reprocessarPendentes(botId: number, saida: Saida, limite = 50): Promise<number> {
  const pendentes = await db
    .select()
    .from(telegramUpdates)
    .where(
      and(
        eq(telegramUpdates.botId, botId),
        eq(telegramUpdates.status, "recebido"),
        lt(telegramUpdates.recebidoEm, new Date(Date.now() - 2 * 60 * 1000)),
        lt(telegramUpdates.tentativas, 3),
      ),
    )
    .limit(limite);
  for (const p of pendentes) {
    if (p.payload) await processarUpdate(botId, p.payload as TgUpdate, saida);
  }
  return pendentes.length;
}
