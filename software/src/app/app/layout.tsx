import { Building2, LogOut } from "lucide-react";
import { exigirUsuario } from "@/lib/auth/sessao";
import { Logotipo } from "@/components/logo";
import { MenuLateral } from "@/components/menu-lateral";
import { sair } from "@/features/auth/acoes";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { SeletorCondominio } from "@/components/seletor-condominio";
import { condominiosDoUsuario } from "@/lib/negocio/acesso";
import { COOKIE_CONDOMINIO } from "@/lib/negocio/condominio-atual";
import { hojeISO, dataBR } from "@/lib/negocio/datas";

const ROTULO_TIPO = { administradora: "Administradora", sindico_profissional: "Síndico(a) profissional", sindico_morador: "Síndico(a) morador(a)" } as const;
const ROTULO_PAPEL = { admin: "Administrador(a)", sindico: "Síndico(a)", conselho: "Conselho", equipe: "Equipe" } as const;

export default async function LayoutPainel({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario();
  const lista = await condominiosDoUsuario(usuario);
  const salvo = (await cookies()).get(COOKIE_CONDOMINIO)?.value ?? null;
  const atual = lista.find((c) => c.id === salvo)?.id ?? lista[0]?.id ?? null;
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#conteudo-painel" className="pular-conteudo">Pular para o conteúdo</a>
      {usuario.organizacao.isDemo ? <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-center text-xs text-amber-900 print:hidden">Você está na demonstração · Os dados desta conta são fictícios.</div> : null}
      <div className="flex flex-1 flex-col md:flex-row">
        <aside className="painel-lateral border-b border-white/10 md:sticky md:top-0 md:h-dvh md:w-60 md:shrink-0 md:overflow-y-auto md:border-b-0 print:hidden">
          <div className="flex min-h-full flex-col gap-5 p-4 md:px-4 md:py-6">
            <div className="px-2"><Logotipo claro /><p className="mt-1.5 pl-10 text-[10px] tracking-[.12em] text-[#a7becb]">GESTÃO DE CONDOMÍNIOS</p></div>
            <div className="hidden rounded-xl border border-white/10 bg-white/5 px-3 py-3 md:block"><p className="menu-grupo mb-1">Seu espaço</p><p className="break-words text-sm font-semibold text-white">{usuario.organizacao.nome}</p><p className="mt-1 text-xs text-[#a7becb]">{ROTULO_TIPO[usuario.organizacao.tipo]}</p></div>
            <MenuLateral>
              <div className="mt-auto pt-6">
                <div className="border-t border-white/15 pt-4">
                  <div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#294f65] text-sm font-semibold text-white" aria-hidden>{usuario.nome.slice(0, 1).toUpperCase()}</span><div className="min-w-0"><p className="break-words text-sm font-medium text-white">{usuario.nome}</p><p className="text-xs text-[#a7becb]">{ROTULO_PAPEL[usuario.papel]}</p></div></div>
                  <p className="mt-3 break-all text-[11px] text-[#a7becb]">{usuario.email}</p>
                  <form action={sair} className="mt-3"><button type="submit" className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-xs hover:bg-white/10 hover:text-white"><LogOut className="h-4 w-4" aria-hidden /> Sair da conta</button></form>
                </div>
              </div>
            </MenuLateral>
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex min-h-20 flex-wrap items-center justify-between gap-3 border-b border-borda bg-superficie px-4 py-4 md:px-8 print:hidden">
            <div className="flex min-w-0 items-center gap-3"><span className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-borda bg-fundo text-primaria lg:flex"><Building2 className="h-5 w-5" aria-hidden /></span>{lista.length > 0 ? <Suspense fallback={null}><SeletorCondominio lista={lista.map((c) => ({ id: c.id, nome: c.nome }))} atual={atual} /></Suspense> : <p className="text-sm font-medium">Seu painel de gestão</p>}</div>
            <div className="text-right"><p className="text-xs font-medium text-tinta">{dataBR(hojeISO())}</p><p className="mt-1 text-xs text-suave">{lista.length} {lista.length === 1 ? "condomínio na carteira" : "condomínios na carteira"}</p></div>
          </header>
          <main id="conteudo-painel" className="painel-conteudo min-w-0 flex-1 px-4 py-6 md:p-8">{children}</main>
          <footer className="px-4 pb-5 text-xs text-suave md:px-8 print:hidden">Organização para a gestão. Cuidado com as pessoas.</footer>
        </div>
      </div>
    </div>
  );
}
