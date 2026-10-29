"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAVEGACAO } from "@/config/navegacao";
import { cx } from "@/components/ui";

export function MenuLateral() {
  const atual = usePathname();
  return (
    <nav className="space-y-5">
      {NAVEGACAO.map((g) => (
        <div key={g.titulo}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wide text-suave">{g.titulo}</p>
          <ul className="mt-1 space-y-0.5">
            {g.itens.map((i) => {
              const ativo = i.rota === "/app" ? atual === "/app" : atual === i.rota || atual.startsWith(`${i.rota}/`);
              return (
                <li key={i.rota}>
                  <Link
                    href={i.rota}
                    className={cx(
                      "flex min-w-0 items-center gap-2.5 rounded-lg px-3 py-2 text-sm",
                      ativo ? "bg-primaria-clara font-medium text-primaria-escura" : "text-tinta hover:bg-black/5",
                    )}
                  >
                    <i.icone className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{i.rotulo}</span>
                    {i.status === "em_construcao" ? (
                      <span className="ml-auto shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium text-slate-600">em breve</span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
