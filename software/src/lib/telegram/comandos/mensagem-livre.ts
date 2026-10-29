import type { Roteador } from "../roteador";

/**
 * Mensagem livre (texto que não é comando) de quem está vinculado.
 *
 * Ponto de extensão da IA: um módulo registra um tratador com
 * `roteador.registrarMensagemLivre(fn, { prioridade: "inicio" })`. O tratador
 * recebe o contexto (pessoa, condomínio, texto) e devolve true quando respondeu.
 * Se nenhum tratador responder, este padrão confirma o recebimento: a mensagem
 * já ficou registrada em telegram_mensagens e aparece no painel.
 */
export function registrarMensagemLivrePadrao(roteador: Roteador) {
  roteador.registrarMensagemLivre(async (ctx) => {
    await ctx.responder(
      "Recebi sua mensagem e ela ficou registrada para a administração do condomínio. As respostas automáticas ainda não estão ativas por aqui. Envie /ajuda para ver os comandos.",
    );
    return true;
  });
}
