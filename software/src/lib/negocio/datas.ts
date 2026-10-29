/**
 * Datas de negócio em "AAAA-MM-DD" (dia civil em America/Sao_Paulo), sem fuso no banco.
 * Todas as contas de vencimento e rotina usam estas funções (testadas).
 */
const FUSO = "America/Sao_Paulo";

export function hojeISO(agora = new Date()): string {
  const p = new Intl.DateTimeFormat("en-CA", { timeZone: FUSO, year: "numeric", month: "2-digit", day: "2-digit" }).format(agora);
  return p; // en-CA já sai como AAAA-MM-DD
}

/** Hora local (0-23) em São Paulo. */
export function horaLocal(agora = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: FUSO, hour: "2-digit", hourCycle: "h23" }).format(agora));
}

export function partes(iso: string): { a: number; m: number; d: number } {
  const [a, m, d] = iso.split("-").map(Number);
  return { a, m, d };
}

function paraISO(a: number, m: number, d: number): string {
  return `${String(a).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export function ehDataISO(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const { a, m, d } = partes(v);
  return m >= 1 && m <= 12 && d >= 1 && d <= ultimoDiaDoMes(a, m);
}

export function ultimoDiaDoMes(a: number, m: number): number {
  return new Date(Date.UTC(a, m, 0)).getUTCDate();
}

export function somarDias(iso: string, dias: number): string {
  const { a, m, d } = partes(iso);
  const t = new Date(Date.UTC(a, m - 1, d + dias));
  return paraISO(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

/** Soma meses com fim de mês ajustado: 31/08 + 6 meses = 28/02 (ou 29/02). */
export function somarMeses(iso: string, meses: number): string {
  const { a, m, d } = partes(iso);
  const total = a * 12 + (m - 1) + meses;
  const na = Math.floor(total / 12);
  const nm = (total % 12) + 1;
  return paraISO(na, nm, Math.min(d, ultimoDiaDoMes(na, nm)));
}

/** Dias de `de` até `ate` (positivo se `ate` é depois). */
export function diferencaDias(de: string, ate: string): number {
  const a = partes(de);
  const b = partes(ate);
  return Math.round((Date.UTC(b.a, b.m - 1, b.d) - Date.UTC(a.a, a.m - 1, a.d)) / 86400000);
}

/** 0 = domingo … 6 = sábado. */
export function diaDaSemana(iso: string): number {
  const { a, m, d } = partes(iso);
  return new Date(Date.UTC(a, m - 1, d)).getUTCDay();
}

/** "AAAA-MM-DD" → "dd/mm/aaaa". */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const { a, m, d } = partes(iso);
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${a}`;
}

/** "dd/mm/aaaa" (ou "AAAA-MM-DD") → "AAAA-MM-DD"; null se inválida. */
export function lerDataBR(v: string | null | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  let iso: string | null = null;
  const br = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
  if (br) iso = paraISO(Number(br[3]), Number(br[2]), Number(br[1]));
  else if (/^\d{4}-\d{2}-\d{2}$/.test(s)) iso = s;
  return iso && ehDataISO(iso) ? iso : null;
}

/** Data/hora em São Paulo a partir de um dia ISO e uma hora local (para agendamentos). */
export function instanteLocal(iso: string, hora = 0, minuto = 0): Date {
  const { a, m, d } = partes(iso);
  // São Paulo sem horário de verão desde 2019: UTC-3.
  return new Date(Date.UTC(a, m - 1, d, hora + 3, minuto));
}

export function horaMinutoBR(d: Date | null | undefined): string {
  if (!d) return "—";
  return d.toLocaleTimeString("pt-BR", { timeZone: FUSO, hour: "2-digit", minute: "2-digit" });
}

/** "há 12 dias", "em 2 dias", "hoje". */
export function textoPrazo(dias: number): string {
  if (dias === 0) return "hoje";
  const n = Math.abs(dias);
  return `${n} dia${n === 1 ? "" : "s"}`;
}

/** Instante atual (usado nas páginas do servidor; um ponto só para trocar nos testes). */
export function agora(): Date {
  return new Date();
}
