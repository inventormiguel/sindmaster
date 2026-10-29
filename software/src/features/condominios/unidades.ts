export type TipoUnidade = "apartamentos" | "casas";
export type UnidadeGerada = { bloco: string; numero: string; andar: number | null };
export type ConfiguracaoUnidades = {
  lista?: string;
  bloco?: string;
  tipo?: TipoUnidade;
  andares?: string;
  porAndar?: string;
};

const LIMITE_UNIDADES = 2400;

/** Mesma interpretação na prévia do formulário e na validação do servidor. */
export function gerarUnidades(config: ConfiguracaoUnidades): UnidadeGerada[] {
  const lista = config.lista?.trim() ?? "";
  const casas = config.tipo === "casas" || /\bcasas?\b/i.test(lista) || /\bsem andar(?:es)?\b/i.test(lista);
  const blocoPadrao = config.bloco?.trim() ?? "";
  const unidades = new Map<string, UnidadeGerada>();
  const adicionar = (bloco: string, numero: string, andar: number | null) => {
    const chave = `${bloco.toLocaleUpperCase()}\0${numero.toLocaleUpperCase()}`;
    unidades.set(chave, { bloco, numero: numero.toLocaleUpperCase(), andar: casas ? null : andar });
    if (unidades.size > LIMITE_UNIDADES) throw new Error(`Informe no máximo ${LIMITE_UNIDADES} unidades por cadastro.`);
  };

  if (lista) {
    if (lista.length > 40000) throw new Error("A lista de unidades é muito longa.");
    const itens = lista
      .replace(/[,;]?\s*\bsem andar(?:es)?\b[.!]?/gi, "")
      .split(/[\n,;]+|\s+e\s+/i)
      .map((item) => item.trim().replace(/^[•*]\s*/, ""))
      .filter(Boolean);
    if (!itens.length) throw new Error("Informe a numeração das unidades.");

    for (const original of itens) {
      let item = original.replace(/^(?:casas?|unidades?|apartamentos?|aptos?|lotes?)\b\.?\s*:?\s*/i, "").trim();
      let bloco = blocoPadrao;
      const intervalo = /^(?:de\s+)?(\d{1,5})\s*(?:a|at[eé]|[-–—])\s*(\d{1,5})$/i;
      // Primeiro identifica um intervalo puro: "1-14" não é bloco "1", unidade "14".
      if (!intervalo.test(item)) {
        const comBloco = item.match(/^(.+?)\s*[-–]\s*(.+)$/);
        if (comBloco) {
          bloco = comBloco[1].trim();
          item = comBloco[2].trim().replace(/^(?:casas?|unidades?|apartamentos?|aptos?\.?)\s+/i, "");
        }
      }
      const faixa = item.match(intervalo);
      if (faixa) {
        const inicio = Number(faixa[1]);
        const fim = Number(faixa[2]);
        if (fim < inicio) throw new Error(`O intervalo "${original}" deve começar pelo menor número.`);
        if (fim - inicio + 1 > LIMITE_UNIDADES) throw new Error(`Informe no máximo ${LIMITE_UNIDADES} unidades por cadastro.`);
        const largura = /^0\d/.test(faixa[1]) ? Math.max(faixa[1].length, faixa[2].length) : 0;
        for (let n = inicio; n <= fim; n++) adicionar(bloco, String(n).padStart(largura, "0"), Math.floor(n / 100) || null);
      } else if (/^\d{1,5}[A-Za-z]?$/.test(item)) {
        adicionar(bloco, item, Math.floor(Number.parseInt(item, 10) / 100) || null);
      } else {
        throw new Error(`Não entendi "${original.slice(0, 80)}". Use, por exemplo, "Casas de 1 a 14", "1, 2, 3" ou "A - 101".`);
      }
    }
  } else if (!casas) {
    const andares = Number(config.andares ?? "");
    const porAndar = Number(config.porAndar ?? "");
    if (!andares && !porAndar) return [];
    if (!Number.isInteger(andares) || andares < 1 || andares > 80 || !Number.isInteger(porAndar) || porAndar < 1 || porAndar > 30) {
      throw new Error("Informe de 1 a 80 andares e de 1 a 30 unidades por andar, ou use a lista de unidades.");
    }
    for (let andar = 1; andar <= andares; andar++) {
      for (let n = 1; n <= porAndar; n++) adicionar(blocoPadrao, `${andar}${String(n).padStart(2, "0")}`, andar);
    }
  }
  return [...unidades.values()].sort(compararUnidades);
}

export function compararUnidades(a: UnidadeGerada, b: UnidadeGerada): number {
  return a.bloco.localeCompare(b.bloco, "pt-BR", { numeric: true })
    || (a.andar ?? 0) - (b.andar ?? 0)
    || a.numero.localeCompare(b.numero, "pt-BR", { numeric: true });
}
