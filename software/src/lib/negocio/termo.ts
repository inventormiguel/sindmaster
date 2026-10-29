import { BRAND } from "@/lib/brand";
import { fraseTarefaNaoJornada } from "./linguagem";

/**
 * Termo resumido mostrado ao abrir o convite (LGPD): o Telegram e a IA como operadores,
 * a finalidade das fotos e, para funcionário, a frase fixa de tarefa (não jornada).
 */
export function termoDoConvite(p: { papel: string; empresaContratada?: string | null } | undefined): string {
  const linhas = [
    "Como seus dados são usados:",
    "• Suas mensagens e fotos passam pelos servidores do Telegram (fora do Brasil) e, quando há leitura ou resposta por IA, pela Anthropic (EUA), sem seu nome nem contato.",
    "• O condomínio usa só para atender você e cuidar do prédio; você vê só o que é seu e o que é do condomínio todo.",
    "• Não fotografe pessoas. Para pedir a exclusão dos seus dados, fale com o síndico.",
  ];
  if (p?.papel === "funcionario") {
    linhas.push(`• As fotos de tarefa servem para mostrar a tarefa feita e são apagadas em 90 dias. Não usamos localização.`);
    if (p.empresaContratada) linhas.push(`• As rotinas do seu posto são combinadas com a ${p.empresaContratada}.`);
    linhas.push(fraseTarefaNaoJornada(BRAND.nome));
  }
  return linhas.join("\n");
}
