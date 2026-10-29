/**
 * Regras de linguagem por código (testadas):
 * - expressões proibidas nos textos da IA e da interface (responsabilidade);
 * - palavras de emergência (pulam a IA e a autoajuda);
 * - termos de jornada que nunca aparecem (rotina é tarefa, não ponto).
 */

export function normalizar(t: string): string {
  return t
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export const EXPRESSOES_PROIBIDAS = [
  "de acordo com a lei",
  "conforme a lei",
  "obrigatorio por lei",
  "dentro da legislacao",
  "voce sera multado",
  "a multa sera aplicada",
  "aplicar multa",
  "parecer",
  "garantido",
  "registro de ponto",
  "jornada",
  "em conformidade",
  "regular perante a lei",
];

export function expressoesProibidasEm(texto: string): string[] {
  const n = ` ${normalizar(texto).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ")} `;
  return EXPRESSOES_PROIBIDAS.filter((e) => n.includes(` ${e} `));
}

/**
 * Emergência: grupos de palavras fixos no código (o síndico pode acrescentar, nunca tirar).
 * Achou: mensagem fixa de segurança na hora, sem IA, sem pergunta, sem autoajuda.
 */
export type GrupoEmergencia = "fogo_gas" | "elevador" | "agua" | "eletrica";

export const GRUPOS_EMERGENCIA: Record<GrupoEmergencia, { rotulo: string; palavras: string[]; mensagem: string }> = {
  fogo_gas: {
    rotulo: "Gás, fogo, fumaça",
    palavras: ["gas", "cheiro de gas", "vazamento de gas", "fogo", "incendio", "fumaca", "cheiro de queimado", "faisca", "faiscando", "faiscas"],
    mensagem:
      "Se for seguro, saia do local e afaste as pessoas. Não acenda luz nem acione interruptores, não use fósforo nem isqueiro. Ligue 193 (Bombeiros). Estou avisando agora o síndico e o plantão ({plantao}).",
  },
  elevador: {
    rotulo: "Elevador",
    palavras: ["preso no elevador", "presa no elevador", "presos no elevador", "presas no elevador", "elevador parado com gente"],
    mensagem: "Não force a porta. Aperte o botão de alarme do elevador. Estou avisando agora o síndico e o plantão ({plantao}). Se alguém passar mal, ligue 192 (SAMU) ou 193.",
  },
  agua: {
    rotulo: "Água",
    palavras: ["alagamento", "alagando", "alagado", "inundacao", "inundando", "cano estourou", "cano estourado"],
    mensagem: "Se for seguro, feche o registro da sua unidade e afaste aparelhos elétricos da água. Estou avisando agora o síndico e o plantão ({plantao}). Em risco às pessoas, ligue 193.",
  },
  eletrica: {
    rotulo: "Elétrica",
    palavras: ["choque", "levou choque", "curto circuito", "curto-circuito", "fio desencapado"],
    mensagem: "Não toque no local nem em quem levou choque se ele ainda estiver em contato com a fonte. Ligue 193. Estou avisando agora o síndico e o plantão ({plantao}).",
  },
};

/** Procura uma expressão de emergência (código + extras do condomínio). Devolve o grupo e a expressão. */
export function detectarEmergencia(texto: string, extras: { grupo: GrupoEmergencia; expressao: string }[] = []): { grupo: GrupoEmergencia; palavra: string } | null {
  const n = ` ${normalizar(texto).replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ")} `;
  const lista: { grupo: GrupoEmergencia; palavra: string }[] = [
    ...(Object.entries(GRUPOS_EMERGENCIA) as [GrupoEmergencia, { palavras: string[] }][]).flatMap(([grupo, g]) => g.palavras.map((palavra) => ({ grupo, palavra: normalizar(palavra).replace(/-/g, " ") }))),
    ...extras.map((e) => ({ grupo: e.grupo, palavra: normalizar(e.expressao) })),
  ].sort((a, b) => b.palavra.length - a.palavra.length);
  for (const x of lista) if (x.palavra && n.includes(` ${x.palavra} `)) return x;
  return null;
}

/** Compatível: só a palavra. */
export function palavraDeEmergencia(texto: string): string | null {
  return detectarEmergencia(texto)?.palavra ?? null;
}

export function mensagemSeguranca(grupo: GrupoEmergencia, plantao: string, editadas?: Record<string, string> | null): string {
  const base = editadas?.[grupo]?.trim() || GRUPOS_EMERGENCIA[grupo].mensagem;
  const texto = base.replace("{plantao}", plantao || "contato de plantão");
  // O 193 e o plantão são obrigatórios mesmo na mensagem editada.
  return /\b193\b/.test(texto) ? texto : `${texto} Em risco à vida, ligue 193.`;
}

/** Termos de controle de jornada que não podem aparecer na interface nem no bot. */
export const TERMOS_JORNADA = [
  "bater ponto",
  "registro de ponto",
  "ponto eletronico",
  "hora extra",
  "banco de horas",
  "horas trabalhadas",
  "inicio do turno",
  "fim do turno",
  "hora de chegada",
  "pontualidade",
];

/** Frase fixa (a única com a palavra "jornada" permitida, nas rotinas e no convite do funcionário). */
export function fraseTarefaNaoJornada(produto: string): string {
  return `O ${produto} registra tarefas feitas, não a jornada. O controle de jornada continua no meio que o empregador usa (no caso de porteiros terceirizados, a empresa contratada). Você não precisa responder fora do seu horário.`;
}

export const IDENTIFICACAO_IA = "Resposta automática da IA, a partir dos documentos do condomínio";

export const RODAPE_DUVIDA = "Esta resposta reproduz os documentos do condomínio; não é orientação jurídica.";
