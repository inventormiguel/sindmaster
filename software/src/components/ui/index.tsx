import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";

/** Componentes de interface próprios (estilo shadcn, escritos à mão). */

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(" ");
}

type Variante = "primario" | "secundario" | "fantasma" | "perigo";
const VARIANTES: Record<Variante, string> = {
  primario: "bg-primaria text-white hover:bg-primaria-escura",
  secundario: "bg-superficie text-tinta border border-borda hover:bg-fundo",
  fantasma: "text-tinta hover:bg-black/5",
  perigo: "bg-superficie text-perigo border border-red-200 hover:bg-red-50",
};

export function classesBotao(variante: Variante = "primario", tamanho: "md" | "sm" = "md") {
  return cx(
    "inline-flex min-w-0 items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50 text-center",
    tamanho === "md" ? "min-h-11 px-4 py-2.5 text-sm" : "min-h-9 px-3 py-2 text-xs",
    VARIANTES[variante],
  );
}

export function Botao({
  variante = "primario",
  tamanho = "md",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; tamanho?: "md" | "sm" }) {
  return <button className={cx(classesBotao(variante, tamanho), className)} {...props} />;
}

export function Cartao({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx("ui-cartao min-w-0 rounded-2xl border border-borda bg-superficie p-5 sm:p-6", className)}>{children}</div>;
}

export function TituloCartao({ children, descricao, acao }: { children: ReactNode; descricao?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-base font-semibold text-tinta">{children}</h2>
        {descricao ? <p className="mt-1 text-sm text-suave">{descricao}</p> : null}
      </div>
      {acao}
    </div>
  );
}

type Tom = "verde" | "cinza" | "amarelo" | "vermelho" | "azul";
const TONS: Record<Tom, string> = {
  verde: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  cinza: "bg-slate-100 text-slate-700 ring-slate-200",
  amarelo: "bg-amber-50 text-amber-800 ring-amber-200",
  vermelho: "bg-red-50 text-red-800 ring-red-200",
  azul: "bg-sky-50 text-sky-800 ring-sky-200",
};

export function Selo({ tom = "cinza", children }: { tom?: Tom; children: ReactNode }) {
  return (
    <span className={cx("inline-flex max-w-full items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset", TONS[tom])}>
      {children}
    </span>
  );
}

export function Rotulo({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-tinta">
      {children}
    </label>
  );
}

const CAMPO = "min-h-11 w-full rounded-lg border border-borda bg-white px-3 py-2.5 text-sm text-tinta outline-none transition-colors focus:border-primaria focus:ring-2 focus:ring-primaria/20";

export function Campo(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx(CAMPO, props.className)} />;
}

export function Selecao(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx(CAMPO, props.className)} />;
}

export function AreaTexto(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea {...props} className={cx(CAMPO, props.className)} />;
}

export function Aviso({ tom = "azul", children }: { tom?: "azul" | "amarelo" | "vermelho" | "verde"; children: ReactNode }) {
  const t = {
    azul: "border-sky-200 bg-sky-50 text-sky-900",
    amarelo: "border-amber-200 bg-amber-50 text-amber-900",
    vermelho: "border-red-200 bg-red-50 text-red-900",
    verde: "border-emerald-200 bg-emerald-50 text-emerald-900",
  }[tom];
  return <div className={cx("rounded-lg border px-4 py-3 text-sm", t)}>{children}</div>;
}

export function Vazio({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-borda bg-fundo/60 px-4 py-8 text-center text-sm text-suave">{children}</p>;
}

export function CabecalhoPagina({ titulo, descricao, acao }: { titulo: string; descricao?: ReactNode; acao?: ReactNode }) {
  return (
    <div className="cabecalho-pagina mb-7 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-tinta md:text-3xl">{titulo}</h1>
        {descricao ? <p className="mt-2 max-w-3xl text-sm leading-relaxed text-suave">{descricao}</p> : null}
      </div>
      {acao}
    </div>
  );
}
