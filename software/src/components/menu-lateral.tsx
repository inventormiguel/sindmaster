"use client";

import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { NAVEGACAO } from "@/config/navegacao";
import { cx } from "@/components/ui";

export function MenuLateral({ children }: { children?: ReactNode }) {
  const atual = usePathname();
  const [aberto, setAberto] = useState(false);
  return (
    <>
      <button type="button" className="flex w-full items-center justify-between rounded-lg border border-white/20 px-3 py-2 text-sm text-white md:hidden" aria-expanded={aberto} aria-controls="navegacao-painel" onClick={() => setAberto(!aberto)}>
        Navegar pelo painel {aberto ? <X className="h-4 w-4" aria-hidden /> : <Menu className="h-4 w-4" aria-hidden />}
      </button>
      <div id="navegacao-painel" className={cx("flex-1 flex-col md:flex", aberto ? "flex" : "hidden")}>
        <nav aria-label="Áreas do sistema" className="space-y-5">
          {NAVEGACAO.map((g) => (
            <div key={g.titulo}>
              <p className="menu-grupo px-3">{g.titulo}</p>
              <ul className="mt-2 space-y-0.5">
                {g.itens.map((i) => {
                  const ativo = i.rota === "/app" ? atual === "/app" : atual === i.rota || atual.startsWith(`${i.rota}/`);
                  return (
                    <li key={i.rota}>
                      <Link href={i.rota} aria-current={ativo ? "page" : undefined} className="menu-link" onClick={() => setAberto(false)}>
                        <i.icone className="h-4 w-4 shrink-0" strokeWidth={1.6} aria-hidden />
                        <span>{i.rotulo}</span>
                        {i.status === "em_construcao" ? <span className="ml-auto shrink-0 rounded bg-white/10 px-1.5 py-0.5 text-[10px]">em breve</span> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
        {children}
      </div>
    </>
  );
}
