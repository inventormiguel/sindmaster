import Anthropic from "@anthropic-ai/sdk";

/**
 * IA (Anthropic). Modelo em ANTHROPIC_MODEL (padrão Haiku 5.5, o mais barato) e
 * reserva em ANTHROPIC_MODEL_FALLBACK, usada se o modelo principal não existir mais.
 * Nunca enviamos temperature, top_p nem top_k (o Haiku 5.5 recusa).
 */
export const MODELO_PADRAO = "claude-haiku-5-5";
export const MODELO_RESERVA_PADRAO = "claude-haiku-4-5-20251001";

/** Folga para o raciocínio dos modelos que pensam antes de responder (o raciocínio conta em max_tokens). */
export const FOLGA_RACIOCINIO = 2048;

/**
 * Limite de tokens e esforço conforme o modelo. O Haiku 4.5 não pensa sem pedido e recusa `effort`;
 * os modelos novos pensam por padrão, então vão com esforço baixo e folga no limite.
 */
export function ajustesDoModelo(modelo: string, maxTokens: number) {
  if (/haiku-4/.test(modelo)) return { max_tokens: maxTokens };
  return { max_tokens: maxTokens + FOLGA_RACIOCINIO, output_config: { effort: "low" as const } };
}

export function modeloPrincipal() {
  return process.env.ANTHROPIC_MODEL?.trim() || MODELO_PADRAO;
}
export function modeloReserva() {
  return process.env.ANTHROPIC_MODEL_FALLBACK?.trim() || MODELO_RESERVA_PADRAO;
}
export function chaveIA(): string | null {
  return process.env.ANTHROPIC_API_KEY?.trim() || null;
}

export type ParametrosMensagem = {
  system?: string;
  mensagens: { role: "user" | "assistant"; content: string }[];
  maxTokens: number;
};

/** Monta o corpo da chamada. Separado para o teste conferir que não há temperature/top_p/top_k. */
export function montarCorpo(modelo: string, p: ParametrosMensagem) {
  return {
    model: modelo,
    ...ajustesDoModelo(modelo, p.maxTokens),
    ...(p.system ? { system: p.system } : {}),
    messages: p.mensagens,
  };
}

export type RespostaIA = { texto: string; modelo: string; tokensEntrada: number; tokensSaida: number; cortada: boolean };

export async function gerarTexto(p: ParametrosMensagem, cliente?: Anthropic): Promise<RespostaIA> {
  const chave = chaveIA();
  if (!cliente && !chave) throw new Error("Conecte sua chave de IA na página Integrações.");
  const c = cliente ?? new Anthropic({ apiKey: chave!, maxRetries: 2 });
  const chamar = async (modelo: string) => {
    const r = await c.messages.create(montarCorpo(modelo, p));
    const texto = r.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    return {
      texto,
      modelo: r.model,
      tokensEntrada: r.usage.input_tokens,
      tokensSaida: r.usage.output_tokens,
      cortada: r.stop_reason === "max_tokens",
    };
  };
  try {
    return await chamar(modeloPrincipal());
  } catch (e) {
    if (e instanceof Anthropic.NotFoundError) return chamar(modeloReserva());
    throw e;
  }
}

/** "Testar conexão": uma chamada real e curta. */
export async function testarConexaoIA(): Promise<{ ok: boolean; detalhe: string }> {
  if (!chaveIA()) return { ok: false, detalhe: "ANTHROPIC_API_KEY não configurada." };
  try {
    const r = await gerarTexto({
      mensagens: [{ role: "user", content: "Responda apenas com a palavra: conectado" }],
      maxTokens: 16,
    });
    return { ok: true, detalhe: `Modelo ${r.modelo} respondeu "${r.texto.trim().slice(0, 40)}" (${r.tokensEntrada} + ${r.tokensSaida} tokens).` };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, detalhe: "A chave foi recusada (401). Confira a ANTHROPIC_API_KEY." };
    if (e instanceof Anthropic.APIError) return { ok: false, detalhe: `Erro da API (${e.status ?? "sem status"}): ${e.message.slice(0, 200)}` };
    return { ok: false, detalhe: e instanceof Error ? e.message.slice(0, 200) : "Falha desconhecida." };
  }
}
