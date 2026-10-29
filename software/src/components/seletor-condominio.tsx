"use client";

import { usePathname, useSearchParams } from "next/navigation";

/** Seletor de condomínio no topo do painel (para quem tem acesso a mais de um). */
export function SeletorCondominio({ lista, atual }: { lista: { id: string; nome: string }[]; atual: string | null }) {
  const caminho = usePathname();
  const sp = useSearchParams();
  const selecionado = sp.get("c") ?? atual ?? "";
  if (lista.length === 0) return null;
  return (
    <form action="/api/condominio-atual" method="get" className="flex min-w-0 items-center gap-2">
      <input type="hidden" name="voltar" value={caminho} />
      <label htmlFor="seletor-condominio" className="shrink-0 text-xs font-medium text-suave">
        Condomínio
      </label>
      <select
        id="seletor-condominio"
        name="c"
        defaultValue={selecionado}
        key={selecionado}
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
        className="min-w-0 max-w-xs rounded-lg border border-borda bg-white px-2 py-1.5 text-sm text-tinta"
      >
        {lista.map((c) => (
          <option key={c.id} value={c.id}>
            {c.nome}
          </option>
        ))}
      </select>
      <noscript>
        <button type="submit" className="rounded-lg border border-borda px-2 py-1 text-xs">
          Trocar
        </button>
      </noscript>
    </form>
  );
}
