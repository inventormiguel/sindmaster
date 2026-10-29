"use client";

import { Botao } from "@/components/ui";

export function BotaoImprimir() {
  return (
    <Botao type="button" variante="secundario" tamanho="sm" onClick={() => window.print()}>
      Imprimir
    </Botao>
  );
}
