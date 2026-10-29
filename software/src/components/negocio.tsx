import Link from "next/link";
import type { ReactNode } from "react";
import { Aviso, cx, Selo } from "@/components/ui";

/** Faixa de resultado das ações (?ok= / ?erro=). */
export function Mensagens({ sp }: { sp: { ok?: string | string[]; erro?: string | string[] } }) {
  const ok = typeof sp.ok === "string" ? sp.ok : null;
  const erro = typeof sp.erro === "string" ? sp.erro : null;
  if (!ok && !erro) return null;
  return <div className="mb-4">{erro ? <Aviso tom="vermelho">{erro}</Aviso> : <Aviso tom="verde">{ok}</Aviso>}</div>;
}

/** Número que abre a lista filtrada. */
export function Numero({ rotulo, valor, href, tom, detalhe }: { rotulo: string; valor: ReactNode; href?: string; tom?: "vermelho" | "amarelo" | "verde"; detalhe?: ReactNode }) {
  const cor = tom === "vermelho" ? "text-red-700" : tom === "amarelo" ? "text-amber-700" : tom === "verde" ? "text-emerald-700" : "text-tinta";
  const corpo = (
    <div className="ui-numero h-full min-w-0 rounded-2xl border border-borda bg-superficie p-5 transition-colors hover:border-primaria/40">
      <p className="text-sm text-suave">{rotulo}</p>
      <p className={cx("mt-3 text-3xl font-semibold tracking-tight tabular-nums", cor)}>{valor}</p>
      {detalhe ? <p className="mt-1 text-xs text-suave">{detalhe}</p> : null}
    </div>
  );
  return href ? (
    <Link href={href} className="block min-w-0">
      {corpo}
    </Link>
  ) : (
    corpo
  );
}

export function SeloExemplo({ exemplo }: { exemplo?: boolean | null }) {
  return exemplo ? <Selo tom="cinza">dado de exemplo</Selo> : null;
}

export function SeloIA({ conferidoPor, conferidoEm }: { conferidoPor?: string | null; conferidoEm?: Date | null }) {
  if (conferidoPor) return <Selo tom="verde">{`Conferido por ${conferidoPor}${conferidoEm ? ` em ${conferidoEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}` : ""}`}</Selo>;
  return <Selo tom="amarelo">Lido pela IA · não conferido</Selo>;
}

export function Tabela({ cabecalho, children, vazio }: { cabecalho: string[]; children: ReactNode; vazio?: boolean }) {
  return (
    <div className="tabela-negocio overflow-x-auto">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr className="border-b border-borda bg-fundo/80 text-xs tracking-wide text-suave">
            {cabecalho.map((c) => (
              <th key={c} className="px-3 py-3 font-semibold">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-borda">{children}</tbody>
      </table>
      {vazio ? <p className="py-6 text-center text-sm text-suave">Nada por aqui.</p> : null}
    </div>
  );
}

export function Td({ children, className }: { children?: ReactNode; className?: string }) {
  return <td className={cx("px-3 py-3 align-top", className)}>{children}</td>;
}

/** Campos escondidos comuns dos formulários de ação. */
export function Ocultos({ c, voltar, extra }: { c: string; voltar: string; extra?: Record<string, string> }) {
  return (
    <>
      <input type="hidden" name="c" value={c} />
      <input type="hidden" name="voltar" value={voltar} />
      {extra ? Object.entries(extra).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />) : null}
    </>
  );
}

export function SemCondominio() {
  return (
    <Aviso tom="amarelo">
      Nenhum condomínio disponível para você. <Link href="/app/condominios" className="underline">Cadastre um condomínio</Link> ou peça acesso ao administrador.
    </Aviso>
  );
}

export function Abas({ itens }: { itens: { href: string; rotulo: string; ativo: boolean }[] }) {
  return (
    <div className="mb-4 flex flex-wrap gap-2">
      {itens.map((i) => (
        <Link key={i.href} href={i.href} className={cx("rounded-lg px-3 py-1.5 text-sm", i.ativo ? "bg-primaria text-white" : "border border-borda bg-superficie hover:bg-fundo")}>
          {i.rotulo}
        </Link>
      ))}
    </div>
  );
}
