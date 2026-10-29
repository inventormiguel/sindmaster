import { after } from "next/server";
import { clienteDoAmbiente } from "@/lib/telegram/api";
import { processarFilaEnvios } from "@/lib/telegram/avisos";

/**
 * Depois de enfileirar avisos numa ação do painel ou no webhook, a fila anda logo
 * (sem esperar o cron). Fora de uma requisição (scripts, testes), envia na hora se
 * houver Telegram configurado.
 */
export function agendarEnvioDaFila(organizacaoId: string) {
  const tarefa = async () => {
    const cliente = clienteDoAmbiente();
    if (!cliente) return;
    try {
      await processarFilaEnvios({ cliente, organizacaoId, prazoMs: 20000 });
    } catch (e) {
      console.error("[fila] envio falhou:", e instanceof Error ? e.message : e);
    }
  };
  try {
    after(tarefa);
  } catch {
    void tarefa();
  }
}
