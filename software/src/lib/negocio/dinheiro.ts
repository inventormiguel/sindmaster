/** Dinheiro em centavos inteiros (sem ponto flutuante). Formato "R$ 1.380,00". */

export function formatarReais(centavos: number | null | undefined): string {
  if (centavos == null) return "—";
  const negativo = centavos < 0;
  const abs = Math.abs(Math.round(centavos));
  const reais = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const cent = String(abs % 100).padStart(2, "0");
  return `${negativo ? "-" : ""}R$ ${reais},${cent}`;
}

/** "1.380,00", "1380,00", "1380.00", "R$ 1.380" → 138000. Null se não der para ler. */
export function lerReais(v: string | number | null | undefined): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? Math.round(v * 100) : null;
  let s = v.replace(/R\$\s?/i, "").replace(/\s/g, "").trim();
  if (!s) return null;
  if (/,\d{1,2}$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
  else if (/\.\d{1,2}$/.test(s) && (s.match(/\./g) ?? []).length === 1) s = s.replace(/,/g, "");
  else s = s.replace(/[.,]/g, "");
  if (!/^-?\d+(\.\d{1,2})?$/.test(s)) return null;
  const [int, dec = ""] = s.split(".");
  const sinal = int.startsWith("-") ? -1 : 1;
  return sinal * (Math.abs(Number(int)) * 100 + Number(dec.padEnd(2, "0")));
}
