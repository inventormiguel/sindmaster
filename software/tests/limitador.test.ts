import { describe, expect, it } from "vitest";
import { LimitadorEnvio } from "@/lib/telegram/limitador";

function relogio() {
  let t = 1_000_000;
  return { agora: () => t, avancar: (ms: number) => (t += ms) };
}

describe("fila de envio (limites do Telegram)", () => {
  it("1 mensagem por segundo no mesmo chat", () => {
    const r = relogio();
    const l = new LimitadorEnvio({ agora: r.agora });
    const tempos = [l.reservar(10), l.reservar(10), l.reservar(10)];
    expect(tempos.map((x) => x - r.agora())).toEqual([0, 1000, 2000]);
  });

  it("chats diferentes não esperam um pelo outro", () => {
    const r = relogio();
    const l = new LimitadorEnvio({ agora: r.agora });
    expect(l.reservar(1) - r.agora()).toBe(0);
    expect(l.reservar(2) - r.agora()).toBe(0);
  });

  it("no máximo 20 por minuto no mesmo grupo", () => {
    const r = relogio();
    const l = new LimitadorEnvio({ agora: r.agora });
    const tempos = Array.from({ length: 21 }, () => l.reservar(-100));
    expect(tempos[19] - r.agora()).toBe(19000);
    // a 21ª só depois de 60 s da primeira
    expect(tempos[20] - tempos[0]).toBeGreaterThanOrEqual(60000);
  });

  it("no máximo 30 por segundo no total", () => {
    const r = relogio();
    const l = new LimitadorEnvio({ agora: r.agora });
    const tempos = Array.from({ length: 31 }, (_, i) => l.reservar(i + 1));
    expect(tempos.slice(0, 30).every((t) => t === r.agora())).toBe(true);
    expect(tempos[30] - r.agora()).toBe(1000);
  });

  it("aguardarVez espera o tempo reservado", async () => {
    const r = relogio();
    const esperas: number[] = [];
    const l = new LimitadorEnvio({ agora: r.agora, esperar: async (ms) => void esperas.push(ms) });
    await l.aguardarVez(5);
    await l.aguardarVez(5);
    expect(esperas).toEqual([1000]);
  });
});
