/** CSV simples (separador ";", padrão do Excel em português), sem biblioteca externa. */
export function celulaCsv(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function linhaCsv(valores: unknown[]): string {
  return valores.map(celulaCsv).join(";");
}
