import { BRAND } from "@/lib/brand";

/** Símbolo arquitetônico: duas fachadas conectadas e um ponto de encontro. */
export function Marca({ tamanho = 32 }: { tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="9" fill={BRAND.cores.primaria} />
      <path d="M8 24V11l8-4v17M16 13l8-4v15M5 25h22" fill="none" stroke="#fff" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M11 13v2m0 3v2m8-5v2m0 3v2" stroke="#fff" strokeWidth="1.6" />
      <circle cx="26" cy="6" r="3" fill={BRAND.cores.destaque} />
    </svg>
  );
}

export function Logotipo({ claro = false }: { claro?: boolean }) {
  return (
    <span className="inline-flex items-center gap-2.5">
      <Marca />
      <span className={`text-xl font-semibold tracking-tight ${claro ? "text-white" : "text-tinta"}`}>{BRAND.nome}</span>
    </span>
  );
}
