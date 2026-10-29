/**
 * Fila simples de envio que respeita os limites do Telegram:
 * - ≈1 mensagem por segundo no mesmo chat;
 * - ≈20 mensagens por minuto no mesmo grupo (chat_id negativo);
 * - ≈30 mensagens por segundo no total.
 *
 * Cada chamada a `aguardarVez(chatId)` reserva o próximo horário livre e espera
 * até ele. Várias chamadas simultâneas formam uma fila.
 */
export type OpcoesLimitador = {
  agora?: () => number;
  esperar?: (ms: number) => Promise<void>;
  intervaloPorChatMs?: number;
  maxPorGrupoPorMinuto?: number;
  maxGlobalPorSegundo?: number;
};

export class LimitadorEnvio {
  private readonly agora: () => number;
  private readonly esperar: (ms: number) => Promise<void>;
  private readonly intervaloChat: number;
  private readonly maxGrupo: number;
  private readonly maxGlobal: number;
  private ultimoPorChat = new Map<number, number>();
  private janelaGrupo = new Map<number, number[]>();
  private janelaGlobal: number[] = [];

  constructor(o: OpcoesLimitador = {}) {
    this.agora = o.agora ?? Date.now;
    this.esperar = o.esperar ?? ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.intervaloChat = o.intervaloPorChatMs ?? 1000;
    this.maxGrupo = o.maxPorGrupoPorMinuto ?? 20;
    this.maxGlobal = o.maxGlobalPorSegundo ?? 30;
  }

  /** Calcula e grava o próximo horário permitido para este chat. */
  reservar(chatId: number): number {
    const agora = this.agora();
    let t = agora;
    const ehGrupo = chatId < 0;
    // Repete até todas as regras estarem satisfeitas no horário t.
    for (let i = 0; i < 1000; i++) {
      let ajustou = false;
      const ultimo = this.ultimoPorChat.get(chatId);
      if (ultimo !== undefined && t < ultimo + this.intervaloChat) {
        t = ultimo + this.intervaloChat;
        ajustou = true;
      }
      if (ehGrupo) {
        const janela = (this.janelaGrupo.get(chatId) ?? []).filter((x) => x > t - 60000);
        if (janela.length >= this.maxGrupo) {
          t = janela[janela.length - this.maxGrupo] + 60000;
          ajustou = true;
        }
      }
      const global = this.janelaGlobal.filter((x) => x > t - 1000);
      if (global.length >= this.maxGlobal) {
        t = global[global.length - this.maxGlobal] + 1000;
        ajustou = true;
      }
      if (!ajustou) break;
    }
    this.ultimoPorChat.set(chatId, t);
    if (ehGrupo) {
      const janela = (this.janelaGrupo.get(chatId) ?? []).filter((x) => x > agora - 60000);
      janela.push(t);
      janela.sort((a, b) => a - b);
      this.janelaGrupo.set(chatId, janela);
    }
    this.janelaGlobal = this.janelaGlobal.filter((x) => x > agora - 1000);
    this.janelaGlobal.push(t);
    this.janelaGlobal.sort((a, b) => a - b);
    return t;
  }

  /**
   * Espera a vez de enviar para `chatId`. Resolve com o horário reservado.
   * A reserva é síncrona (sem corrida); só a espera é assíncrona, então um chat
   * lento não segura a fila dos outros.
   */
  async aguardarVez(chatId: number): Promise<number> {
    const t = this.reservar(chatId);
    const espera = t - this.agora();
    if (espera > 0) await this.esperar(espera);
    return t;
  }
}

/** Limitador compartilhado pelo processo (respostas do bot e fila de avisos). */
const global = globalThis as unknown as { __limitadorTelegram?: LimitadorEnvio };
export function limitadorDoProcesso(): LimitadorEnvio {
  if (!global.__limitadorTelegram) global.__limitadorTelegram = new LimitadorEnvio();
  return global.__limitadorTelegram;
}
