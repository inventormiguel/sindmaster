import Link from "next/link";
import Image from "next/image";
import { ArrowLeft, Check } from "lucide-react";
import type { ReactNode } from "react";
import { Logotipo } from "@/components/logo";

export function LayoutAcesso({ titulo, descricao, children }: { titulo: string; descricao: string; children: ReactNode }) {
  return (
    <main className="auth-layout">
      <section className="auth-marca">
        <Link href="/" className="w-fit" aria-label="Página inicial"><Logotipo claro /></Link>
        <div className="auth-marca-editorial my-10 max-w-lg">
          <p className="sobretitulo mb-5 text-[#c6ae7e]">Gestão que aproxima</p>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">Tudo no seu lugar.<br /><span className="text-[#b7d3cb]">Você no controle.</span></h2>
          <Image src="/brand/residencial.svg" alt="Edifícios residenciais com áreas verdes" width={640} height={570} className="mx-auto my-3 h-auto w-full max-w-sm rounded-2xl bg-[#e3eceb]" />
          <p className="flex items-center gap-3 text-sm text-[#c2d3dc]"><Check className="h-4 w-4 text-[#c6ae7e]" aria-hidden /> Do seu condomínio à carteira inteira.</p>
        </div>
        <p className="auth-marca-editorial text-xs text-[#a7becb]">Organização para a gestão. Cuidado com as pessoas.</p>
      </section>
      <section className="auth-conteudo">
        <div className="auth-form">
          <Link href="/" className="mb-8 inline-flex items-center gap-2 text-sm text-suave hover:text-primaria"><ArrowLeft className="h-4 w-4" aria-hidden /> Voltar ao início</Link>
          <div className="mb-7"><span className="linha-dourada mb-5 block" /><h1 className="text-3xl font-semibold tracking-tight">{titulo}</h1><p className="mt-2 text-sm leading-relaxed text-suave">{descricao}</p></div>
          {children}
        </div>
      </section>
    </main>
  );
}
