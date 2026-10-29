import { z } from "zod";
import { chamarIAJson, delimitar, pseudonimizar, REGRA_DADOS, type BlocoConteudo } from "@/lib/ia/funcoes";

export const CATEGORIAS_CHAMADO = ["hidraulica", "eletrica", "iluminacao", "elevador", "portoes", "interfone", "infiltracao", "limpeza", "area_comum", "seguranca", "gas", "outra"] as const;
/** Natureza das ocorrências (livro de ocorrências como tipo de chamado). */
export const NATUREZAS_OCORRENCIA = ["barulho", "seguranca", "vazamento", "area_comum", "garagem", "animais", "outra"] as const;
export type CategoriaChamado = (typeof CATEGORIAS_CHAMADO)[number];
export const ROTULO_CATEGORIA: Record<string, string> = {
  hidraulica: "Hidráulica",
  eletrica: "Elétrica",
  iluminacao: "Iluminação",
  elevador: "Elevador",
  portoes: "Portões",
  interfone: "Interfone",
  infiltracao: "Infiltração",
  limpeza: "Limpeza",
  area_comum: "Área comum",
  seguranca: "Segurança",
  gas: "Gás",
  outra: "Outra",
  barulho: "Barulho",
  vazamento: "Vazamento",
  garagem: "Garagem",
  animais: "Animais",
};

/** Sinais que a IA pode apontar (lista fixa): só sobem a urgência, nunca baixam. */
export const SINAIS_IA = ["risco_eletrico", "vazamento_grande", "pessoa_presa", "risco_estrutural", "seguranca"] as const;

export const ESQUEMA_IA4 = z.object({
  categoria: z.string().max(30),
  sinaisDeEmergencia: z.array(z.string().max(30)).max(5),
  perguntaEsclarecimento: z.string().max(160).nullable().optional(),
  passoAutoajudaId: z.string().max(40).nullable().optional(),
  resumo: z.string().max(200),
});
export type TriagemIA = { categoria: CategoriaChamado; sinais: string[]; pergunta: string | null; passoAutoajudaId: string | null; resumo: string };

/** IA4 · triagem: categoria, pergunta de esclarecimento e, se houver, um passo da biblioteca APROVADA (a IA nunca escreve instrução de reparo). */
export async function triagemIA4(p: {
  organizacaoId: string;
  texto: string;
  nomes: string[];
  passos: { id: string; categoria: string; titulo: string }[];
  foto?: BlocoConteudo | null;
}): Promise<{ ok: true; triagem: TriagemIA } | { ok: false; mensagem: string }> {
  const sistema = `Você faz a triagem de chamados de manutenção de um condomínio no Brasil.
Categorias permitidas: ${CATEGORIAS_CHAMADO.join(", ")}.
Sinais permitidos (só se o texto indicar claramente): ${SINAIS_IA.join(", ")}.
Se um dos passos de autoajuda da lista resolver o caso de forma segura para um morador leigo, devolva o id dele em passoAutoajudaId; senão null. Nunca invente passos.
perguntaEsclarecimento: no máximo uma pergunta curta, ou null.
${REGRA_DADOS}`;
  const passos = p.passos.map((x) => `${x.id} | ${x.categoria} | ${x.titulo}`).join("\n") || "(nenhum)";
  const conteudo: BlocoConteudo[] = [];
  if (p.foto) conteudo.push(p.foto);
  conteudo.push({ type: "text", text: `${delimitar("CHAMADO", pseudonimizar(p.texto, p.nomes))}\n\nPassos de autoajuda aprovados (id | categoria | título):\n${delimitar("PASSOS", passos)}\n\nDevolva {"categoria","sinaisDeEmergencia","perguntaEsclarecimento","passoAutoajudaId","resumo"}.` });
  const r = await chamarIAJson({ organizacaoId: p.organizacaoId, funcao: "IA4", system: sistema, esquema: ESQUEMA_IA4, conteudo });
  if (!r.ok) return { ok: false, mensagem: r.mensagem };
  const d = r.dados;
  const categoria = (CATEGORIAS_CHAMADO as readonly string[]).includes(d.categoria) ? (d.categoria as CategoriaChamado) : "outra";
  const passoOk = d.passoAutoajudaId && p.passos.some((x) => x.id === d.passoAutoajudaId) ? d.passoAutoajudaId : null;
  return {
    ok: true,
    triagem: {
      categoria,
      sinais: d.sinaisDeEmergencia.filter((s) => (SINAIS_IA as readonly string[]).includes(s)),
      pergunta: d.perguntaEsclarecimento?.trim() || null,
      passoAutoajudaId: passoOk,
      resumo: d.resumo,
    },
  };
}
