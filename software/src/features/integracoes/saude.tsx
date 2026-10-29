import { and, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/db";
import { aiRuns, cronExecucoes, envios, telegramUpdates } from "@/db/schema";
import { clienteDoAmbiente } from "@/lib/telegram/api";
import { dataHora } from "@/lib/formato";
import { agora } from "@/lib/negocio/datas";
import { Cartao, Selo, TituloCartao } from "@/components/ui";

/** Saúde do sistema: último webhook, último diário, erros de 24 h, custo de IA do mês por função. */
export async function SaudeSistema({ organizacaoId }: { organizacaoId: string }) {
  const ontem = new Date(agora().getTime() - 86400000);
  const inicioMes = agora();
  inicioMes.setUTCDate(1);
  inicioMes.setUTCHours(0, 0, 0, 0);
  const [ultimoUpdate] = await db.select({ em: telegramUpdates.recebidoEm }).from(telegramUpdates).orderBy(desc(telegramUpdates.recebidoEm)).limit(1);
  const [ultimoDiario] = await db.select().from(cronExecucoes).where(eq(cronExecucoes.job, "diario")).orderBy(desc(cronExecucoes.iniciadoEm)).limit(1);
  const [ultimoFrequente] = await db.select().from(cronExecucoes).where(eq(cronExecucoes.job, "frequente")).orderBy(desc(cronExecucoes.iniciadoEm)).limit(1);
  const [{ n: errosUpd }] = await db.select({ n: sql<number>`count(*)::int` }).from(telegramUpdates).where(and(eq(telegramUpdates.status, "erro"), gte(telegramUpdates.recebidoEm, ontem)));
  const [{ n: errosEnv }] = await db.select({ n: sql<number>`count(*)::int` }).from(envios).where(and(eq(envios.organizacaoId, organizacaoId), eq(envios.status, "erro"), gte(envios.criadoEm, ontem)));
  const [{ n: errosIa }] = await db.select({ n: sql<number>`count(*)::int` }).from(aiRuns).where(and(eq(aiRuns.organizacaoId, organizacaoId), eq(aiRuns.status, "erro"), gte(aiRuns.criadoEm, ontem)));
  const uso = await db
    .select({ funcao: aiRuns.funcao, chamadas: sql<number>`count(*)::int`, entrada: sql<number>`coalesce(sum(${aiRuns.tokensEntrada}),0)::int`, saida: sql<number>`coalesce(sum(${aiRuns.tokensSaida}),0)::int`, custo: sql<number>`coalesce(sum(${aiRuns.custoMicroUsd}),0)::int` })
    .from(aiRuns)
    .where(and(eq(aiRuns.organizacaoId, organizacaoId), gte(aiRuns.criadoEm, inicioMes)))
    .groupBy(aiRuns.funcao);
  let webhook: string = "Telegram não configurado";
  const cliente = clienteDoAmbiente();
  if (cliente) {
    try {
      const info = await cliente.getWebhookInfo();
      webhook = info.url ? `webhook ativo · ${info.pending_update_count} pendente(s)${info.last_error_date ? ` · último erro em ${dataHora(new Date(info.last_error_date * 1000))}: ${info.last_error_message ?? ""}` : " · sem erro"}` : "sem webhook (modo local por escuta)";
    } catch (e) {
      webhook = `getWebhookInfo falhou: ${e instanceof Error ? e.message.slice(0, 80) : ""}`;
    }
  }
  const horasSemFrequente = ultimoFrequente ? (agora().getTime() - ultimoFrequente.iniciadoEm.getTime()) / 3600000 : null;
  const total = uso.reduce((s, u) => s + u.custo, 0);
  return (
    <Cartao className="mb-6">
      <TituloCartao descricao="Para saber se está tudo rodando sem precisar de suporte.">Saúde do sistema</TituloCartao>
      <div className="grid gap-4 text-sm md:grid-cols-2 xl:grid-cols-4">
        <div>
          <p className="text-suave">Última mensagem recebida</p>
          <p>{ultimoUpdate ? dataHora(ultimoUpdate.em) : "nenhuma ainda"}</p>
          <p className="text-xs text-suave">{webhook}</p>
        </div>
        <div>
          <p className="text-suave">Último diário</p>
          <p>
            {ultimoDiario ? dataHora(ultimoDiario.iniciadoEm) : "ainda não rodou"} {ultimoDiario ? <Selo tom={ultimoDiario.status === "ok" ? "verde" : "vermelho"}>{ultimoDiario.status}</Selo> : null}
          </p>
          <p className="text-xs text-suave">Agendador frequente: {ultimoFrequente ? `chamado pela última vez em ${dataHora(ultimoFrequente.iniciadoEm)}${horasSemFrequente && horasSemFrequente > 2 ? ` (parou de chamar há ${Math.floor(horasSemFrequente)} h)` : ""}` : "não detectado"}</p>
        </div>
        <div>
          <p className="text-suave">Erros nas últimas 24 h</p>
          <p>
            {errosUpd} mensagem(ns) · {errosEnv} envio(s) · {errosIa} chamada(s) de IA
          </p>
        </div>
        <div>
          <p className="text-suave">IA no mês</p>
          <p>US$ {(total / 1_000_000).toFixed(4).replace(".", ",")}</p>
          <ul className="text-xs text-suave">
            {uso.map((u) => (
              <li key={u.funcao}>
                {u.funcao}: {u.chamadas} chamada(s), {u.entrada} + {u.saida} tokens
              </li>
            ))}
          </ul>
        </div>
      </div>
    </Cartao>
  );
}
