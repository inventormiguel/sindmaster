/** O token do bot nunca aparece inteiro: só os 4 últimos caracteres. */
export function mascararToken(token: string | null | undefined): string {
  if (!token) return "(não configurado)";
  return `••••${token.slice(-4)}`;
}

/** Remove o token de qualquer texto (mensagens de erro, URLs) antes de logar ou mostrar. */
export function removerToken(texto: string, token: string | null | undefined): string {
  let saida = texto;
  if (token) saida = saida.split(token).join(mascararToken(token));
  // Proteção extra: qualquer coisa com cara de token de bot (123456:ABC...).
  return saida.replace(/\d{5,}:[A-Za-z0-9_-]{30,}/g, "••••");
}

/** ID numérico do bot: a parte antes dos dois-pontos do token (não é segredo). */
export function idDoBot(token: string): number {
  const id = Number(token.split(":")[0]);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error("TELEGRAM_BOT_TOKEN em formato inválido.");
  return id;
}
