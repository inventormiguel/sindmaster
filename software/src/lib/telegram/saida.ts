import { db } from "@/db";
import { telegramMensagens } from "@/db/schema";
import { ehBloqueio, type ClienteTelegram } from "./api";
import { limitadorDoProcesso, type LimitadorEnvio } from "./limitador";
import type { Saida } from "./roteador";
import { marcarBloqueio } from "./vinculo";

/**
 * Saída real do bot: passa pela fila (limitador), chama a Bot API e registra a
 * mensagem enviada em telegram_mensagens. Se a pessoa bloqueou o bot, marca
 * "bot bloqueado" no cadastro e não insiste.
 */
export function criarSaidaTelegram(cliente: ClienteTelegram, limitador: LimitadorEnvio = limitadorDoProcesso()): Saida {
  return {
    async enviarTexto(destino, texto, opcoes) {
      await limitador.aguardarVez(destino.chatId);
      try {
        const msg = await cliente.sendMessage({
          chat_id: destino.chatId,
          text: texto,
          disable_web_page_preview: true,
          ...(opcoes?.teclado ? { reply_markup: { inline_keyboard: opcoes.teclado } } : {}),
        });
        await db.insert(telegramMensagens).values({
          organizacaoId: destino.pessoa?.organizacaoId ?? null,
          condominioId: destino.pessoa?.condominioId ?? null,
          pessoaId: destino.pessoa?.id ?? null,
          chatId: destino.chatId,
          direcao: "saida",
          tipo: "texto",
          // Respostas para quem não está vinculado não guardam texto.
          texto: destino.pessoa ? texto : null,
          telegramMessageId: msg.message_id,
        });
        return { messageId: msg.message_id };
      } catch (e) {
        if (ehBloqueio(e)) {
          await marcarBloqueio(destino.chatId, true);
          return null;
        }
        throw e;
      }
    },
    async responderBotao(callbackId, texto) {
      await cliente.answerCallbackQuery({ callback_query_id: callbackId, ...(texto ? { text: texto } : {}) });
    },
    async editarTexto(chatId, messageId, texto, teclado) {
      await limitador.aguardarVez(chatId);
      await cliente.editMessageText({
        chat_id: chatId,
        message_id: messageId,
        text: texto,
        ...(teclado ? { reply_markup: { inline_keyboard: teclado } } : {}),
      });
    },
    baixarArquivo(fileId) {
      return cliente.baixarArquivo(fileId);
    },
    async enviarArquivo(destino, arquivo, legenda) {
      await limitador.aguardarVez(destino.chatId);
      try {
        const msg = await cliente.enviarArquivo({ chat_id: destino.chatId, arquivo, caption: legenda?.slice(0, 1024) });
        await db.insert(telegramMensagens).values({
          organizacaoId: destino.pessoa?.organizacaoId ?? null,
          condominioId: destino.pessoa?.condominioId ?? null,
          pessoaId: destino.pessoa?.id ?? null,
          chatId: destino.chatId,
          direcao: "saida",
          tipo: arquivo.campo === "photo" ? "foto" : "documento",
          texto: destino.pessoa ? `[arquivo] ${arquivo.nome}` : null,
          telegramMessageId: msg.message_id,
        });
        return { messageId: msg.message_id };
      } catch (e) {
        if (ehBloqueio(e)) {
          await marcarBloqueio(destino.chatId, true);
          return null;
        }
        throw e;
      }
    },
  };
}
