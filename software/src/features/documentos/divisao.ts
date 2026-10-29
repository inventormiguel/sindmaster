import { normalizar } from "@/lib/negocio/linguagem";

/**
 * Divisão de documentos do condomínio em trechos por artigo ("Art. 15", "Artigo 15", "Art. 9º").
 * Parágrafos (§, "Parágrafo único") ficam dentro do artigo. "Capítulo" é título, não trecho.
 * O síndico confere a divisão antes de usar nas respostas.
 */
export type TrechoDividido = { rotulo: string; numero: string; texto: string };

const RE_ARTIGO = /^\s*(?:art\.?|artigo)\s*(\d+)\s*(?:º|°|o)?\s*[.\-–:]?\s*/i;

export function dividirEmArtigos(texto: string, tituloCurto: string): TrechoDividido[] {
  const linhas = texto.replace(/\r/g, "").split("\n");
  const trechos: TrechoDividido[] = [];
  let atual: { numero: string; linhas: string[] } | null = null;
  const fechar = () => {
    if (atual) {
      const t = atual.linhas.join(" ").replace(/\s+/g, " ").trim();
      if (t) trechos.push({ numero: atual.numero, rotulo: `${tituloCurto}, art. ${atual.numero}`, texto: t });
    }
  };
  for (const linha of linhas) {
    const m = linha.match(RE_ARTIGO);
    if (m) {
      fechar();
      atual = { numero: m[1], linhas: [linha.trim()] };
      continue;
    }
    if (/^\s*cap[ií]tulo\b/i.test(linha)) continue;
    if (atual && linha.trim()) atual.linhas.push(linha.trim());
  }
  fechar();
  return trechos;
}

/** Trecho com unidade + dívida vai para revisão (atas podem citar unidades e débitos) e fica fora das respostas. */
export function pedeRevisaoDadoPessoal(texto: string): boolean {
  const n = normalizar(texto);
  const temUnidade = /\b(apto|apartamento|unidade|ap)\.?\s*\d{1,4}\b/.test(n) || /\b\d{3,4}\b/.test(n);
  const temDivida = /\b(debito|debitos|inadimplen\w*|atraso|atrasad\w*|devedor\w*|devendo)\b/.test(n);
  return temUnidade && temDivida;
}

/** Estimativa simples de tokens (≈ 4 caracteres por token em português). */
export function estimarTokens(texto: string): number {
  return Math.ceil(texto.length / 4);
}

const PARADAS = new Set(
  "a o as os de da do das dos e em no na nos nas um uma uns umas para por com sem que se ao aos pode posso podemos fazer ter tem eu meu minha nesse nessa esse essa isso qual quais como quando onde ate até mais muito sobre".split(" "),
);

/** Sinônimos que a busca léxica não pega ("cachorro" → art. dos animais). */
export const SINONIMOS: Record<string, string[]> = {
  cachorro: ["animal", "animais", "estimacao"],
  cao: ["animal", "animais", "estimacao"],
  gato: ["animal", "animais", "estimacao"],
  pet: ["animal", "animais", "estimacao"],
  carro: ["vaga", "vagas", "garagem"],
  moto: ["vaga", "vagas", "garagem"],
  festa: ["salao", "festas"],
  aniversario: ["salao", "festas"],
  barulho: ["silencio", "ruido", "ruidos"],
  som: ["silencio", "ruido"],
  musica: ["silencio", "ruido"],
  reforma: ["obra", "obras", "reformas"],
  obra: ["reforma", "reformas", "obras"],
  mudanca: ["mudancas"],
  mudar: ["mudancas"],
  bike: ["bicicleta", "bicicletas", "bicicletario"],
  lixo: ["lixeira", "reciclavel", "organico"],
  sabado: ["sabados"],
  domingo: ["domingos", "feriados"],
};

export function termos(texto: string): string[] {
  return normalizar(texto)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(" ")
    .filter((t) => t.length >= 3 && !PARADAS.has(t));
}

/** Busca com OU entre os termos (e sinônimos), por prefixo de 5 letras; devolve os N melhores. */
export function buscarTrechos<T extends { texto: string; rotulo: string }>(pergunta: string, lista: T[], n = 8): T[] {
  const base = termos(pergunta);
  const busca = [...new Set([...base, ...base.flatMap((t) => SINONIMOS[t] ?? [])])];
  const raiz = (t: string) => t.slice(0, 5);
  const pontos = lista.map((tr) => {
    const palavras = new Set(termos(`${tr.rotulo} ${tr.texto}`).map(raiz));
    const s = busca.reduce((acc, t) => acc + (palavras.has(raiz(t)) ? 1 : 0), 0);
    return { tr, s };
  });
  return pontos
    .filter((p) => p.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, n)
    .map((p) => p.tr);
}
