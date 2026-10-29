"use client";

import { useActionState } from "react";
import { Botao } from "@/components/ui";
import { rodarJobAgora, testarAnthropic, testarSimples, testarTelegram, type EstadoTeste } from "./acoes";

export function TestarConexao({ servico, desabilitado }: { servico: "anthropic" | "telegram"; desabilitado?: boolean }) {
  const [estado, acao, pendente] = useActionState<EstadoTeste, FormData>(servico === "anthropic" ? testarAnthropic : testarTelegram, null);
  return (
    <form action={acao} className="space-y-2">
      <Botao type="submit" variante="secundario" tamanho="sm" disabled={pendente || desabilitado}>
        {pendente ? "Testando…" : "Testar conexão"}
      </Botao>
      {estado?.ok ? <p className="text-xs text-emerald-700">{estado.ok}</p> : null}
      {estado?.erro ? <p className="text-xs text-perigo">{estado.erro}</p> : null}
    </form>
  );
}

export function RodarAgora({ job }: { job: string }) {
  const [estado, acao, pendente] = useActionState<EstadoTeste, FormData>(rodarJobAgora, null);
  return (
    <form action={acao} className="space-y-2">
      <input type="hidden" name="job" value={job} />
      <Botao type="submit" variante="secundario" tamanho="sm" disabled={pendente}>
        {pendente ? "Rodando…" : "Rodar agora"}
      </Botao>
      {estado?.ok ? <p className="text-xs text-emerald-700">{estado.ok}</p> : null}
      {estado?.erro ? <p className="text-xs text-perigo">{estado.erro}</p> : null}
    </form>
  );
}

export function TestarSimples({ servico }: { servico: "brasilapi" | "viacep" | "armazenamento" }) {
  const [estado, acao, pendente] = useActionState<EstadoTeste, FormData>(testarSimples, null);
  return (
    <form action={acao} className="space-y-2">
      <input type="hidden" name="servico" value={servico} />
      <Botao type="submit" variante="secundario" tamanho="sm" disabled={pendente}>
        {pendente ? "Testando…" : "Testar conexão"}
      </Botao>
      {estado?.ok ? <p className="text-xs text-emerald-700">{estado.ok}</p> : null}
      {estado?.erro ? <p className="text-xs text-perigo">{estado.erro}</p> : null}
    </form>
  );
}
