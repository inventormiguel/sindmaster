export const PERIODICIDADES = {
  diaria: "Diária",
  semanal: "Semanal",
  mensal: "Mensal",
  trimestral: "Trimestral",
  anual: "Anual",
} as const;

export type Periodicidade = keyof typeof PERIODICIDADES;
export const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const MESES = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

function inteiro(form: FormData, campo: string, max: number) {
  const n = Number(form.get(campo));
  if (!Number.isInteger(n) || n < 1 || n > max) throw new Error(campo === "diaMes" ? "Escolha o dia do mês (1 a 31)." : "Escolha o mês de referência.");
  return n;
}

export function lerPeriodicidadeRotina(form: FormData) {
  const valor = form.get("periodicidade");
  const periodicidade = (Object.keys(PERIODICIDADES) as Periodicidade[]).find((p) => p === valor);
  if (!periodicidade) throw new Error("Escolha a periodicidade da rotina.");
  const porSemana = periodicidade === "diaria" || periodicidade === "semanal";
  const dias = form.getAll("dias").map(Number).filter((n) => Number.isInteger(n) && n >= 0 && n <= 6);
  return {
    periodicidade,
    diasSemana: porSemana ? (dias.length ? [...new Set(dias)] : periodicidade === "semanal" ? [1] : [1, 2, 3, 4, 5, 6]) : null,
    diaMes: porSemana ? null : inteiro(form, "diaMes", 31),
    mesReferencia: periodicidade === "trimestral" || periodicidade === "anual" ? inteiro(form, "mesReferencia", 12) : null,
  };
}

export function descreverPeriodicidade(m: { periodicidade: Periodicidade; diasSemana: number[] | null; diaMes: number | null; mesReferencia: number | null }) {
  const rotulo = PERIODICIDADES[m.periodicidade];
  if (m.periodicidade === "diaria" || m.periodicidade === "semanal") return `${rotulo}: ${(m.diasSemana ?? []).map((d) => DIAS[d]).join(", ")}`;
  if (m.periodicidade === "mensal") return `${rotulo}, dia ${m.diaMes}`;
  const mes = m.mesReferencia ?? 1;
  const meses = m.periodicidade === "anual" ? [mes] : Array.from({ length: 12 }, (_, i) => i + 1).filter((n) => (n - mes + 12) % 3 === 0);
  return `${rotulo}, dia ${m.diaMes}: ${meses.map((n) => MESES[n - 1]).join(", ")}`;
}
