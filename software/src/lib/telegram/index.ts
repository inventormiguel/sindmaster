/**
 * Módulo Telegram — ponto de entrada para o resto do sistema.
 *
 * - api.ts         cliente da Bot API (fetch, retry com retry_after do 429)
 * - limitador.ts   fila de envio (1/s por chat, 20/min por grupo, 30/s no total)
 * - webhook.ts     validação do segredo e recepção (o route handler só chama isto)
 * - processador.ts idempotência por update_id, registro da conversa, roteamento
 * - roteador.ts    registry de comandos, botões, arquivos e mensagem livre
 * - comandos/      comandos de cada módulo (base, arquivos, mensagem livre…)
 * - vinculo.ts     convites de uso único e vínculo pessoa ↔ chat
 * - avisos.ts      fila de avisos para uma pessoa ou para um papel
 * - status.ts      getMe/getWebhookInfo para o painel
 */
export * from "./api";
export * from "./avisos";
export * from "./limitador";
export * from "./mascara";
export * from "./processador";
export * from "./roteador";
export * from "./saida";
export * from "./status";
export * from "./tipos";
export * from "./vinculo";
export * from "./webhook";
export { montarRoteador, roteadorPadrao } from "./comandos";
export { aoReceberArquivo } from "./comandos/arquivos";
