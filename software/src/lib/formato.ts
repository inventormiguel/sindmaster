const FUSO = "America/Sao_Paulo";

export function dataHora(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const v = typeof d === "string" ? new Date(d) : d;
  return v.toLocaleString("pt-BR", { timeZone: FUSO, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function data(d: Date | string | null | undefined): string {
  if (!d) return "—";
  const v = typeof d === "string" ? new Date(d) : d;
  return v.toLocaleDateString("pt-BR", { timeZone: FUSO });
}

export function numero(n: number): string {
  return n.toLocaleString("pt-BR");
}

/** CNPJ só com dígitos → 00.000.000/0000-00 (aceita já formatado). */
export function formatarCnpj(v: string | null | undefined): string | null {
  if (!v) return null;
  const d = v.replace(/\D/g, "");
  if (d.length !== 14) return v;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}

/** Data de N dias atrás (início de janelas como "últimos 7 dias"). */
export function diasAtras(dias: number, agora = new Date()): Date {
  return new Date(agora.getTime() - dias * 86400000);
}
