import { somarDias, diferencaDias, hojeISO } from "./datas";

/**
 * Conferência da linha digitável (só o que a linha traz de verdade).
 *
 * Boleto bancário (47 dígitos): banco (3), moeda (1), campo livre (25), DV geral,
 * fator de vencimento (4) e valor (10). A linha NÃO traz beneficiário nem CNPJ:
 * o beneficiário lido da imagem é sugestão da IA e deve ser conferido no app do banco.
 *
 * Fator de vencimento: duas bases (07/10/1997 e, no ciclo novo, 22/02/2025 = 1000,
 * ou seja, 29/05/2022 + fator). Usa a data candidata mais próxima de hoje, dentro
 * de −3.000 / +5.500 dias. Fator 0000 = sem vencimento.
 *
 * Arrecadação/convênio (48 dígitos, começa com 8): DV por bloco (módulo 10 ou 11
 * conforme o 3º dígito) e valor quando o identificador indica valor efetivo.
 */

export const BANCOS: Record<string, string> = {
  "001": "Banco do Brasil",
  "033": "Santander",
  "041": "Banrisul",
  "070": "BRB",
  "077": "Banco Inter",
  "085": "Ailos",
  "104": "Caixa Econômica Federal",
  "133": "Cresol",
  "136": "Unicred",
  "237": "Bradesco",
  "260": "Nu Pagamentos",
  "290": "PagSeguro",
  "323": "Mercado Pago",
  "336": "C6 Bank",
  "341": "Itaú",
  "389": "Mercantil do Brasil",
  "422": "Safra",
  "633": "Rendimento",
  "745": "Citibank",
  "748": "Sicredi",
  "756": "Sicoob",
};

export const INSTRUCAO_BENEFICIARIO =
  "No app do banco, antes de confirmar o pagamento, confira se o beneficiário mostrado é o prestador certo (razão social e CNPJ). A linha digitável não traz o beneficiário.";

/** Instrução fixa em toda conferência de boleto, com o prestador do cadastro. */
export function instrucaoBeneficiario(razaoSocial: string | null, cnpj: string | null): string {
  if (!razaoSocial) return INSTRUCAO_BENEFICIARIO;
  return `No app do banco, antes de confirmar o pagamento, confira se o beneficiário mostrado é ${razaoSocial}${cnpj ? ` · CNPJ ${cnpj}` : ""}.`;
}

export function modulo10(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    let p = Number(numero[i]) * peso;
    if (p > 9) p = Math.floor(p / 10) + (p % 10);
    soma += p;
    peso = peso === 2 ? 1 : 2;
  }
  const r = soma % 10;
  return r === 0 ? 0 : 10 - r;
}

/** Módulo 11 do DV geral do boleto bancário (pesos 2 a 9; resultado 0, 10 ou 11 vira 1). */
export function modulo11Bancario(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = 11 - (soma % 11);
  return r === 0 || r === 10 || r === 11 ? 1 : r;
}

/** Módulo 11 da arrecadação (resto 0 ou 1 → 0; 10 → 0 conforme a regra mais comum). */
export function modulo11Arrecadacao(numero: string): number {
  let soma = 0;
  let peso = 2;
  for (let i = numero.length - 1; i >= 0; i--) {
    soma += Number(numero[i]) * peso;
    peso = peso === 9 ? 2 : peso + 1;
  }
  const r = soma % 11;
  if (r === 0 || r === 1) return 0;
  if (r === 10) return 1;
  return 11 - r;
}

const BASE_1997 = "1997-10-07";
const BASE_2022 = "2022-05-29";

/** Data do fator de vencimento (null para 0000). */
export function dataDoFator(fator: number, hoje = hojeISO()): string | null {
  if (!fator) return null;
  const candidatas = [somarDias(BASE_1997, fator)];
  if (fator >= 1000) candidatas.push(somarDias(BASE_2022, fator));
  const validas = candidatas.filter((c) => {
    const d = diferencaDias(hoje, c);
    return d >= -3000 && d <= 5500;
  });
  const lista = validas.length ? validas : candidatas;
  return lista.sort((a, b) => Math.abs(diferencaDias(hoje, a)) - Math.abs(diferencaDias(hoje, b)))[0];
}

export type ConferenciaLinha = {
  tipo: "bancario" | "arrecadacao" | "invalida";
  valida: boolean;
  erros: string[];
  bancoCodigo?: string;
  bancoNome?: string;
  valorCentavos?: number | null;
  vencimento?: string | null;
};

export function conferirLinhaDigitavel(linha: string, hoje = hojeISO()): ConferenciaLinha {
  const d = linha.replace(/\D/g, "");
  if (d.length === 47) {
    const erros: string[] = [];
    const c1 = d.slice(0, 9), dv1 = Number(d[9]);
    const c2 = d.slice(10, 20), dv2 = Number(d[20]);
    const c3 = d.slice(21, 31), dv3 = Number(d[31]);
    if (modulo10(c1) !== dv1) erros.push("DV do campo 1 não confere");
    if (modulo10(c2) !== dv2) erros.push("DV do campo 2 não confere");
    if (modulo10(c3) !== dv3) erros.push("DV do campo 3 não confere");
    const dvGeral = Number(d[32]);
    const fator = Number(d.slice(33, 37));
    const valor = Number(d.slice(37, 47));
    // Código de barras (44): banco+moeda (4) + DV + fator + valor + campo livre (25).
    const campoLivre = d.slice(4, 9) + d.slice(10, 20) + d.slice(21, 31);
    const semDv = d.slice(0, 4) + d.slice(33, 37) + d.slice(37, 47) + campoLivre;
    if (modulo11Bancario(semDv) !== dvGeral) erros.push("DV geral não confere");
    const bancoCodigo = d.slice(0, 3);
    return {
      tipo: "bancario",
      valida: erros.length === 0,
      erros,
      bancoCodigo,
      bancoNome: BANCOS[bancoCodigo] ?? `banco ${bancoCodigo}`,
      valorCentavos: valor,
      vencimento: dataDoFator(fator, hoje),
    };
  }
  if (d.length === 48 && d[0] === "8") {
    const erros: string[] = [];
    const ref = d[2];
    const usa10 = ref === "6" || ref === "7";
    const blocos = [0, 1, 2, 3].map((i) => d.slice(i * 12, i * 12 + 12));
    blocos.forEach((b, i) => {
      const corpo = b.slice(0, 11);
      const dv = Number(b[11]);
      const calc = usa10 ? modulo10(corpo) : modulo11Arrecadacao(corpo);
      if (calc !== dv) erros.push(`DV do bloco ${i + 1} não confere`);
    });
    const barras = blocos.map((b) => b.slice(0, 11)).join("");
    const valorEfetivo = ref === "6" || ref === "8";
    return {
      tipo: "arrecadacao",
      valida: erros.length === 0,
      erros,
      valorCentavos: valorEfetivo ? Number(barras.slice(4, 15)) : null,
      vencimento: null,
    };
  }
  return { tipo: "invalida", valida: false, erros: ["A linha digitável deve ter 47 dígitos (boleto) ou 48 (convênio)."] };
}

/** Monta uma linha digitável bancária válida (usado nos testes e no seed). */
export function montarLinhaBancaria(p: { banco: string; fator: number; valorCentavos: number; campoLivre: string }): string {
  const bm = p.banco.padStart(3, "0") + "9";
  const fator = String(p.fator).padStart(4, "0");
  const valor = String(p.valorCentavos).padStart(10, "0");
  const livre = p.campoLivre.padStart(25, "0").slice(0, 25);
  const dvGeral = modulo11Bancario(bm + fator + valor + livre);
  const c1 = bm + livre.slice(0, 5);
  const c2 = livre.slice(5, 15);
  const c3 = livre.slice(15, 25);
  return `${c1}${modulo10(c1)}${c2}${modulo10(c2)}${c3}${modulo10(c3)}${dvGeral}${fator}${valor}`;
}
