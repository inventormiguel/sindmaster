import { createHash } from "node:crypto";
import { db } from "@/db";
import { integracoesTestes } from "@/db/schema";
import { chaveIA, testarConexaoIA } from "@/lib/ia/anthropic";
import { clienteDoAmbiente, tokenDoBot } from "@/lib/telegram/api";
import { removerToken } from "@/lib/telegram/mascara";
import { provedorConfigurado } from "@/lib/storage";

/**
 * Integrações da instalação. O status "Conectada" só aparece depois de uma
 * chamada real no "Testar conexão" com a chave atual (a impressão digital da
 * chave fica guardada: trocou a chave, o status volta a "não testada").
 */
export type Servico = "anthropic" | "telegram";
export type StatusIntegracao = "conectada" | "falhou" | "nao_testada" | "nao_configurada";

function assinatura(segredo: string | null): string | null {
  if (!segredo) return null;
  return createHash("sha256").update(segredo).digest("hex").slice(0, 16);
}

function segredoDo(servico: Servico): string | null {
  return servico === "anthropic" ? chaveIA() : tokenDoBot();
}

export async function testarIntegracao(servico: Servico): Promise<{ ok: boolean; detalhe: string }> {
  let resultado: { ok: boolean; detalhe: string };
  if (servico === "anthropic") {
    resultado = await testarConexaoIA();
  } else {
    const cliente = clienteDoAmbiente();
    if (!cliente) resultado = { ok: false, detalhe: "TELEGRAM_BOT_TOKEN não configurado." };
    else {
      try {
        const me = await cliente.getMe();
        resultado = { ok: true, detalhe: `Bot @${me.username} (${me.first_name}) respondeu ao getMe.` };
      } catch (e) {
        resultado = { ok: false, detalhe: removerToken(e instanceof Error ? e.message : String(e), tokenDoBot()) };
      }
    }
  }
  const valores = { ok: resultado.ok, detalhe: resultado.detalhe, assinatura: assinatura(segredoDo(servico)), testadoEm: new Date() };
  await db
    .insert(integracoesTestes)
    .values({ servico, ...valores })
    .onConflictDoUpdate({ target: integracoesTestes.servico, set: valores });
  return resultado;
}

export async function statusIntegracoes(): Promise<
  Record<Servico, { status: StatusIntegracao; detalhe: string | null; testadoEm: Date | null }> & { armazenamento: ReturnType<typeof provedorConfigurado> }
> {
  const linhas = await db.select().from(integracoesTestes);
  const montar = (servico: Servico) => {
    const segredo = segredoDo(servico);
    if (!segredo) return { status: "nao_configurada" as const, detalhe: null, testadoEm: null };
    const l = linhas.find((x) => x.servico === servico);
    if (!l || l.assinatura !== assinatura(segredo)) return { status: "nao_testada" as const, detalhe: null, testadoEm: null };
    return { status: l.ok ? ("conectada" as const) : ("falhou" as const), detalhe: l.detalhe, testadoEm: l.testadoEm };
  };
  return { anthropic: montar("anthropic"), telegram: montar("telegram"), armazenamento: provedorConfigurado() };
}
