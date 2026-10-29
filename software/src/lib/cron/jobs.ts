import { eq } from "drizzle-orm";
import { db } from "@/db";
import { cronExecucoes } from "@/db/schema";
import { clienteDoAmbiente, tokenDoBot } from "@/lib/telegram/api";
import { processarFilaEnvios } from "@/lib/telegram/avisos";
import { idDoBot } from "@/lib/telegram/mascara";
import { reprocessarPendentes } from "@/lib/telegram/processador";
import { criarSaidaTelegram } from "@/lib/telegram/saida";

/**
 * Rotinas agendadas. Na Vercel (plano Hobby) o cron roda 1 vez por dia; toda
 * rotina também roda pelo botão "Rodar agora" no painel e por `npm run cron -- <job>`.
 *
 * Ponto de extensão: módulos de negócio registram geradores de lembretes com
 * `registrarGeradorDeLembretes`. O job "diario" chama todos (eles
 * enfileiram avisos com `enfileirarAvisoPessoa/Papel`) e depois envia a fila.
 */
export type ResumoJob = Record<string, unknown>;
export type GeradorDeLembretes = { nome: string; gerar: (agora: Date) => Promise<{ enfileirados: number }> };

const geradores: GeradorDeLembretes[] = [];
export function registrarGeradorDeLembretes(g: GeradorDeLembretes) {
  if (!geradores.some((x) => x.nome === g.nome)) geradores.push(g);
}

export type Job = { nome: string; descricao: string; executar: () => Promise<ResumoJob> };

/** Prazo de trabalho de uma invocação do diário (o maxDuration da rota é 300 s). */
export const PRAZO_DIARIO_MS = 240_000;

/**
 * Diário: enfileira um item por condomínio em fila_trabalho (chave diario:{cond}:{data}) e
 * processa em laço com prazo. Itens que sobram (prazo estourado) ficam para o frequente
 * ou para o "Processar pendentes". Nenhum condomínio é processado duas vezes no dia.
 */
async function rodarDiario(agora = new Date(), prazoMs = PRAZO_DIARIO_MS): Promise<ResumoJob> {
  const { condominios, filaTrabalho } = await import("@/db/schema");
  const { hojeISO } = await import("@/lib/negocio/datas");
  const hoje = hojeISO(agora);
  const conds = await db.select({ id: condominios.id }).from(condominios);
  for (const c of conds) {
    await db.insert(filaTrabalho).values({ tipo: "diario", refId: c.id, chave: `diario:${c.id}:${hoje}` }).onConflictDoNothing();
  }
  const r = await processarFilaTrabalho(agora, prazoMs);
  const resumo: ResumoJob = { condominios: conds.length, ...r };
  // Geradores registrados por outros módulos (ponto de extensão da base).
  for (const g of geradores) resumo[`gerador:${g.nome}`] = await g.gerar(agora);
  const { fecharSemConfirmacao } = await import("@/features/chamados/servico");
  resumo.chamadosSemConfirmacao = await fecharSemConfirmacao(agora);
  const { purgarFotosDeRotina } = await import("@/features/rotinas/servico");
  resumo.fotosPurgadas = await purgarFotosDeRotina(agora);
  resumo.saudeWebhook = await conferirSaudeWebhook();
  const cliente = clienteDoAmbiente();
  const token = tokenDoBot();
  if (!cliente || !token) {
    resumo.telegram = "não configurado: fila mantida";
    return resumo;
  }
  resumo.updatesReprocessados = await reprocessarPendentes(idDoBot(token), criarSaidaTelegram(cliente));
  resumo.fila = await processarFilaEnvios({ cliente, prazoMs: 45000 });
  return resumo;
}

/** Processa os itens pendentes da fila de trabalho (reserva com travado_ate; um por vez). */
export async function processarFilaTrabalho(agora = new Date(), prazoMs = PRAZO_DIARIO_MS) {
  const { filaTrabalho } = await import("@/db/schema");
  const { and, isNull, lt, or } = await import("drizzle-orm");
  const inicio = Date.now();
  let feitos = 0;
  let erros = 0;
  for (;;) {
    if (Date.now() - inicio > prazoMs) break;
    const [livre] = await db
      .select()
      .from(filaTrabalho)
      .where(and(isNull(filaTrabalho.feitoEm), or(isNull(filaTrabalho.travadoAte), lt(filaTrabalho.travadoAte, new Date())), lt(filaTrabalho.tentativas, 3)))
      .limit(1);
    if (!livre) break;
    const pegos = await db
      .update(filaTrabalho)
      .set({ travadoAte: new Date(Date.now() + 120_000), tentativas: livre.tentativas + 1 })
      .where(and(eq(filaTrabalho.id, livre.id), isNull(filaTrabalho.feitoEm), or(isNull(filaTrabalho.travadoAte), lt(filaTrabalho.travadoAte, new Date()))))
      .returning({ id: filaTrabalho.id });
    if (pegos.length === 0) continue;
    try {
      if (livre.tipo === "diario" && livre.refId) await diarioDoCondominio(livre.refId, agora);
      await db.update(filaTrabalho).set({ feitoEm: new Date(), erro: null }).where(eq(filaTrabalho.id, livre.id));
      feitos++;
    } catch (e) {
      erros++;
      await db.update(filaTrabalho).set({ erro: (e instanceof Error ? e.message : String(e)).slice(0, 500), travadoAte: null }).where(eq(filaTrabalho.id, livre.id));
    }
  }
  return { itensFeitos: feitos, itensComErro: erros };
}

/** Trabalho do dia de um condomínio: itens de rotina (e envio dentro da janela) e resumo do síndico. */
async function diarioDoCondominio(condominioId: string, agora: Date) {
  const { enviarRotinasDoCondominio } = await import("@/features/rotinas/servico");
  const { gerarResumoDoCondominio } = await import("@/features/resumos/servico");
  await enviarRotinasDoCondominio(condominioId, agora);
  await gerarResumoDoCondominio(condominioId, agora);
}

/** getWebhookInfo com erro nas últimas 24 h: avisa o síndico pelo bot (Saúde do sistema). */
async function conferirSaudeWebhook(): Promise<string> {
  const cliente = clienteDoAmbiente();
  if (!cliente) return "Telegram não configurado";
  try {
    const info = await cliente.getWebhookInfo();
    if (!info.url) return "sem webhook (modo local)";
    if (info.last_error_date && Date.now() / 1000 - info.last_error_date < 86400) {
      const { pessoas } = await import("@/db/schema");
      const { enfileirarAvisoPessoa } = await import("@/lib/telegram/avisos");
      const sindicos = await db.select().from(pessoas).where(eq(pessoas.papel, "sindico"));
      for (const s of sindicos) {
        if (!s.telegramChatId) continue;
        await enfileirarAvisoPessoa({ organizacaoId: s.organizacaoId, pessoaId: s.id, categoria: "saude", texto: `Saúde do sistema: o webhook do Telegram teve erro nas últimas 24 h (${(info.last_error_message ?? "").slice(0, 120)}). Veja Integrações no painel.`, chaveIdempotencia: `saude-webhook:${s.id}:${info.last_error_date}` });
      }
      return `erro recente: ${(info.last_error_message ?? "").slice(0, 80)}`;
    }
    return `ok (${info.pending_update_count} pendentes)`;
  } catch (e) {
    return `falhou: ${e instanceof Error ? e.message.slice(0, 80) : "?"}`;
  }
}

/**
 * Frequente (opcional: agendador externo fora da Vercel, ou cron do Pro): consome o que
 * sobrou do diário, manda rotinas que esperavam a janela e envia a fila. Idempotente.
 */
async function rodarFrequente(agora = new Date()): Promise<ResumoJob> {
  const r: ResumoJob = { ...(await processarFilaTrabalho(agora, 60_000)) };
  const { enviarRotinasDoDia } = await import("@/features/rotinas/servico");
  r.rotinas = await enviarRotinasDoDia(agora);
  const cliente = clienteDoAmbiente();
  if (cliente) r.fila = await processarFilaEnvios({ cliente, prazoMs: 30000 });
  else r.telegram = "não configurado: fila mantida";
  return r;
}

export const JOBS: Record<string, Job> = {
  diario: {
    nome: "diario",
    descricao: "Rotina do dia aos funcionários (dentro da janela), resumo do síndico, chamados sem confirmação em 72 h, purga de fotos, saúde do webhook e fila de avisos.",
    executar: () => rodarDiario(),
  },
  frequente: {
    nome: "frequente",
    descricao: "Opcional (agendador externo ou cron do Pro): consome o que sobrou do diário, rotinas que esperavam a janela e a fila de avisos.",
    executar: () => rodarFrequente(),
  },
  "enviar-fila": {
    nome: "enviar-fila",
    descricao: "Só envia os avisos pendentes (usado pelo modo local de escuta e pelo botão do painel).",
    async executar() {
      const cliente = clienteDoAmbiente();
      if (!cliente) return { telegram: "não configurado: fila mantida" };
      return { fila: await processarFilaEnvios({ cliente, prazoMs: 45000 }) };
    },
  },
};
/** Nome antigo do diário (base): continua funcionando. */
export const ALIAS_JOBS: Record<string, string> = { "lembretes-do-dia": "diario" };
export { rodarDiario, rodarFrequente };

export async function executarJob(nomePedido: string, origem: "cron" | "manual" | "script") {
  const nome = ALIAS_JOBS[nomePedido] ?? nomePedido;
  const job = JOBS[nome];
  if (!job) return null;
  const [exec] = await db.insert(cronExecucoes).values({ job: nome, origem, status: "executando" }).returning({ id: cronExecucoes.id });
  try {
    const resumo = await job.executar();
    await db.update(cronExecucoes).set({ status: "ok", resumo, terminadoEm: new Date() }).where(eq(cronExecucoes.id, exec.id));
    return { ok: true as const, resumo };
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    await db.update(cronExecucoes).set({ status: "erro", erro: erro.slice(0, 1000), terminadoEm: new Date() }).where(eq(cronExecucoes.id, exec.id));
    return { ok: false as const, erro };
  }
}

/** Resumo da execução em português, para a tela (nunca o objeto cru). */
export function descreverResumo(resumo: ResumoJob): string {
  const partes: string[] = [];
  const fila = resumo.fila as { enviados: number; erros: number; adiados: number; restantes: number } | undefined;
  if (fila) partes.push(`${fila.enviados} aviso(s) enviado(s), ${fila.erros} com erro, ${fila.adiados} adiado(s), ${fila.restantes} na fila`);
  if (typeof resumo.updatesReprocessados === "number" && resumo.updatesReprocessados > 0) {
    partes.push(`${resumo.updatesReprocessados} mensagem(ns) reprocessada(s)`);
  }
  if (typeof resumo.telegram === "string") partes.push(`Telegram ${resumo.telegram}`);
  if (typeof resumo.condominios === "number") partes.push(`${resumo.itensFeitos ?? 0} de ${resumo.condominios} condomínio(s) processado(s)`);
  if (typeof resumo.chamadosSemConfirmacao === "number" && resumo.chamadosSemConfirmacao > 0) partes.push(`${resumo.chamadosSemConfirmacao} chamado(s) encerrado(s) sem confirmação`);
  if (typeof resumo.saudeWebhook === "string") partes.push(`webhook: ${resumo.saudeWebhook}`);
  for (const [k, v] of Object.entries(resumo)) {
    if (k.startsWith("gerador:")) partes.push(`${k.slice(8)}: ${(v as { enfileirados: number }).enfileirados} lembrete(s)`);
  }
  return partes.join("; ") || "nada a fazer";
}
