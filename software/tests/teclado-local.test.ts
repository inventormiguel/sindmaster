import { describe, expect, it } from "vitest";
import { tecladoAceito } from "@/lib/telegram/api";

describe("teclado aceito pelo Telegram", () => {
  it("tira o botão com link local e mantém os outros", () => {
    const t = tecladoAceito([
      [{ text: "Abrir no painel", url: "http://localhost:3241/app/hoje?c=1" }],
      [{ text: "Aprovar", callback_data: "ap:1" }, { text: "Painel", url: "http://127.0.0.1:3241/app" }],
    ]);
    expect(t).toEqual([[{ text: "Aprovar", callback_data: "ap:1" }]]);
  });

  it("mantém o link público", () => {
    const t = tecladoAceito([[{ text: "Abrir no painel", url: "https://gicon.vercel.app/app/hoje" }]]);
    expect(t).toHaveLength(1);
  });
});
