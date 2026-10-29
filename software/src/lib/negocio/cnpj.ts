/** CNPJ: dígitos verificadores e raiz (8 primeiros dígitos, usada na CND, que vale para matriz e filiais). */

export function soDigitos(v: string | null | undefined): string {
  return (v ?? "").replace(/\D/g, "");
}

export function cnpjValido(v: string | null | undefined): boolean {
  const d = soDigitos(v);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((s, c, i) => s + Number(c) * pesos[i], 0);
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const p2 = [6, ...p1];
  const d1 = calc(d.slice(0, 12), p1);
  const d2 = calc(d.slice(0, 12) + d1, p2);
  return d.endsWith(`${d1}${d2}`);
}

export function raizCnpj(v: string | null | undefined): string {
  return soDigitos(v).slice(0, 8);
}

export function mesmoCnpj(a: string | null | undefined, b: string | null | undefined): boolean {
  const x = soDigitos(a);
  return x.length === 14 && x === soDigitos(b);
}

export function formatarCnpjDigitos(v: string | null | undefined): string | null {
  const d = soDigitos(v);
  if (d.length !== 14) return v ?? null;
  return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
}
