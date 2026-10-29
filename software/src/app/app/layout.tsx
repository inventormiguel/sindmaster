import { LogOut } from "lucide-react";
import { exigirUsuario } from "@/lib/auth/sessao";
import { Logotipo } from "@/components/logo";
import { MenuLateral } from "@/components/menu-lateral";
import { sair } from "@/features/auth/acoes";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { SeletorCondominio } from "@/components/seletor-condominio";
import { condominiosDoUsuario } from "@/lib/negocio/acesso";
import { COOKIE_CONDOMINIO } from "@/lib/negocio/condominio-atual";

const ROTULO_TIPO = {
  administradora: "Administradora",
  sindico_profissional: "Síndico(a) profissional",
  sindico_morador: "Síndico(a) morador(a)",
} as const;

const ROTULO_PAPEL = { admin: "Administrador(a)", sindico: "Síndico(a)", conselho: "Conselho", equipe: "Equipe" } as const;

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const lista = await condominiosDoUsuario(usuario);
  const salvo = (await cookies()).get(COOKIE_CONDOMINIO)?.value ?? null;
  const atual = lista.find((c) => c.id === salvo)?.id ?? lista[0]?.id ?? null;
  return (
    <div className="flex min-h-screen flex-col">
      {usuario.organizacao.isDemo ? (
        <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">Conta de demonstração: os dados são fictícios.</div>
      ) : null}
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="print:hidden border-b border-borda bg-superficie md:sticky md:top-0 md:h-screen md:w-64 md:shrink-0 md:overflow-y-auto md:border-r md:border-b-0">
          <div className="flex h-full flex-col gap-6 p-4">
            <Logotipo />
            <div className="rounded-lg bg-fundo px-3 py-2">
              <p className="truncate text-sm font-medium">{usuario.organizacao.nome}</p>
              <p className="text-xs text-suave">{ROTULO_TIPO[usuario.organizacao.tipo]}</p>
            </div>
            <MenuLateral />
            <div className="mt-auto border-t border-borda pt-4">
              <p className="truncate text-sm font-medium">{usuario.nome}</p>
              <p className="truncate text-xs text-suave">
                {usuario.email} · {ROTULO_PAPEL[usuario.papel]}
              </p>
              {/* Sair é sempre POST (formulário), nunca link: pré-carregamento de link não desloga ninguém. */}
              <form action={sair} className="mt-3">
                <button type="submit" className="inline-flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-suave hover:bg-black/5 hover:text-tinta">
                  <LogOut className="h-4 w-4" aria-hidden /> Sair
                </button>
              </form>
            </div>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          {lista.length > 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-borda bg-superficie px-4 py-2 md:px-8 print:hidden">
              <Suspense fallback={null}>
                <SeletorCondominio lista={lista.map((c) => ({ id: c.id, nome: c.nome }))} atual={atual} />
              </Suspense>
              <span className="text-xs text-suave">{lista.length} condomínio(s) na sua carteira</span>
            </div>
          ) : null}
          <main className="min-w-0 flex-1 px-4 py-6 md:px-8 md:py-8">{children}</main>
        </div>
      </div>
    </div>
  );
}
