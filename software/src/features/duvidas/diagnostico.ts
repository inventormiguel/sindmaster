"use server";

import { exigirCondominioAcao } from "@/lib/negocio/acesso";
import { iaDisponivel } from "@/lib/ia/funcoes";
import { deveDesviar, montarMensagemResposta, perguntarIA1 } from "./servico";

export type EstadoDiagnostico = { erro?: string; resultados?: { pergunta: string; texto: string; achou: boolean }[] } | null;

/** Diagnóstico: perguntas sobre os documentos do condomínio atual, sem gravar nenhuma dúvida. */
export async function rodarDiagnostico(_prev: EstadoDiagnostico, form: FormData): Promise<EstadoDiagnostico> {
  try {
    const { usuario, condominio } = await exigirCondominioAcao(String(form.get("c") ?? ""));
    if (!iaDisponivel()) return { erro: "Conecte sua chave de IA na página Integrações para o diagnóstico." };
    const perguntas = form.getAll("pergunta").map(String).map((x) => x.trim()).filter(Boolean).slice(0, 5);
    const resultados = [];
    for (const pergunta of perguntas) {
      if (deveDesviar(pergunta)) {
        resultados.push({ pergunta, texto: "Desviada pelo código (dado de terceiros): não iria para a IA.", achou: false });
        continue;
      }
      const r = await perguntarIA1({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, pergunta });
      if (r.tipo === "ok" && !r.dados.pedeDecisaoDoSindico) resultados.push({ pergunta, texto: montarMensagemResposta({ resposta: r.dados.resposta, citacoes: r.citacoes }), achou: true });
      else resultados.push({ pergunta, texto: r.tipo === "ok" ? "Pede decisão do síndico: iria para você com a citação." : "Não encontrei nos documentos: iria para você.", achou: false });
    }
    return { resultados };
  } catch (e) {
    return { erro: e instanceof Error ? e.message : "Falhou." };
  }
}
