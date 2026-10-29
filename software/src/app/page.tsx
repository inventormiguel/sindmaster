import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Building2, CalendarClock, Check, ClipboardCheck, Layers3, MessageCircle, Receipt, ShieldCheck, Wrench } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Logotipo } from "@/components/logo";
import { classesBotao } from "@/components/ui";

const RECURSOS = [
  { icone: CalendarClock, numero: "01", titulo: "Os prazos, à vista.", texto: "Seguro, elevador e caixa d’água: acompanhe os prazos cadastrados, receba lembretes e confira os comprovantes." },
  { icone: Wrench, numero: "02", titulo: "Cada chamado tem um caminho.", texto: "Da foto enviada pelo morador até a confirmação do serviço, acompanhe o responsável e o andamento pelo painel." },
  { icone: ClipboardCheck, numero: "03", titulo: "Uma equipe bem orientada.", texto: "Tarefas do dia no Telegram, registros com foto e acompanhamento por item. Tudo organizado para a rotina acontecer." },
  { icone: MessageCircle, numero: "04", titulo: "Respostas com referência.", texto: "A IA consulta os documentos do condomínio e cita o trecho do regimento. Quando há dúvida, encaminha para você." },
  { icone: Receipt, numero: "05", titulo: "Despesas fáceis de conferir.", texto: "Recibos e comprovantes viram sugestões de lançamento. Você confere os dados antes de aprovar cada despesa." },
  { icone: ShieldCheck, numero: "06", titulo: "Um histórico em que confiar.", texto: "Documentos de prestadores, registros de alterações e acessos por condomínio. Informação organizada para a sua gestão." },
];
const PASSOS = [
  { numero: "01", titulo: "Organize a base", texto: "Cadastre o condomínio e as unidades. Reúna os documentos e configure os prazos que você quer acompanhar." },
  { numero: "02", titulo: "Conecte as pessoas", texto: "Configure o bot e convide moradores, equipe e prestadores pelo Telegram, cada um com seu acesso." },
  { numero: "03", titulo: "Cuide do que importa", texto: "Abra o painel Hoje para conferir pendências, acompanhar as tarefas e decidir os próximos passos." },
];

export default function Inicio() {
  return (
    <div className="flex min-h-screen flex-col">
      <a href="#conteudo" className="pular-conteudo">Pular para o conteúdo</a>
      <header className="site-cabecalho">
        <div className="site-container flex min-h-22 flex-wrap items-center justify-between gap-3 py-4">
          <Link href="/" aria-label="Página inicial"><Logotipo /></Link>
          <nav aria-label="Menu principal" className="hidden items-center gap-8 text-sm font-medium text-suave lg:flex">
            <a href="#recursos" className="hover:text-primaria">O que você organiza</a>
            <a href="#como-funciona" className="hover:text-primaria">Como funciona</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className={classesBotao("fantasma")}>Entrar</Link>
            <Link href="/cadastro" className={classesBotao()}>Criar conta <ArrowRight className="h-4 w-4" aria-hidden /></Link>
          </div>
        </div>
      </header>
      <main id="conteudo">
        <section className="hero-inicio">
          <div className="site-container hero-grade">
            <div className="relative z-10">
              <p className="sobretitulo mb-6 flex items-center gap-3 text-primaria"><span className="linha-dourada" /> Gestão condominial com inteligência</p>
              <h1 className="hero-titulo">Mais clareza<br />para gerir.<br /><em>Mais cuidado<br className="hidden xl:block" /> com o seu condomínio.</em></h1>
              <p className="mt-6 max-w-lg text-base leading-relaxed text-suave md:text-lg">Prazos, chamados, despesas e pessoas no mesmo lugar. A IA ajuda a organizar. Você acompanha e decide.</p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/cadastro" className={classesBotao()}>Organizar meu condomínio <ArrowRight className="h-4 w-4" aria-hidden /></Link>
                <Link href="/login" className={classesBotao("secundario")}>Conhecer a demonstração</Link>
              </div>
              <p className="mt-5 flex items-center gap-2 text-xs text-suave"><Check className="h-4 w-4 text-verde" aria-hidden /> Para síndicos e administradoras. Do seu jeito.</p>
            </div>
            <div className="hero-visual">
              <div className="mb-2 flex items-center justify-between px-5 text-[10px] font-semibold tracking-[.18em] text-primaria"><span>PESSOAS. ESPAÇOS. CONEXÕES.</span><span aria-hidden>RESIDENCIAL</span></div>
              <Image src="/brand/residencial.svg" alt="Ilustração arquitetônica de edifícios residenciais conectados por áreas verdes" width={640} height={570} priority className="h-auto w-full" />
              <div className="hero-etiqueta relative -mt-9 ml-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primaria-clara text-primaria"><Building2 className="h-5 w-5" aria-hidden /></span>
                <div><p className="text-sm font-semibold">Um lugar para a sua gestão.</p><p className="mt-0.5 text-xs text-suave">Do primeiro condomínio à carteira inteira.</p></div>
              </div>
            </div>
          </div>
        </section>
        <div className="publico-faixa">
          <div className="site-container grid gap-5 py-7 text-sm sm:grid-cols-3">
            {[{ icone: Building2, texto: "Síndicos profissionais" }, { icone: Layers3, texto: "Administradoras de condomínios" }, { icone: ShieldCheck, texto: "Síndicos moradores" }].map(({ icone: Icone, texto }) => <div key={texto} className="flex items-center gap-3 sm:justify-center"><Icone className="h-5 w-5 text-primaria" aria-hidden /><span className="font-medium">{texto}</span></div>)}
          </div>
        </div>
        <section id="recursos" className="site-container py-16 md:py-22">
          <div className="mb-10 grid gap-5 md:grid-cols-2 md:items-end">
            <div><p className="sobretitulo mb-4 text-primaria">A gestão encontra seu lugar</p><h2 className="max-w-xl text-3xl font-semibold leading-tight tracking-tight md:text-4xl">Menos pontas soltas.<br />Mais visão do todo.</h2></div>
            <p className="max-w-md text-base leading-relaxed text-suave md:justify-self-end">Uma rotina de condomínio tem muitas frentes. Reúna cada uma delas em um painel que ajuda você a enxergar o próximo passo.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map(({ icone: Icone, numero, titulo, texto }) => <article key={numero} className="recurso-cartao"><div className="flex items-center justify-between"><span className="recurso-icone"><Icone className="h-5 w-5" aria-hidden /></span><span className="text-xs tabular-nums text-suave">{numero}</span></div><h3 className="mt-6 text-lg font-semibold tracking-tight">{titulo}</h3><p className="mt-3 text-sm leading-relaxed text-suave">{texto}</p></article>)}
          </div>
        </section>
        <section className="bloco-escuro">
          <div className="site-container grid gap-10 py-16 md:grid-cols-2 md:items-center md:py-20">
            <div><p className="sobretitulo mb-5 text-[#c6ae7e]">Tecnologia com responsabilidade</p><h2 className="text-3xl font-semibold leading-tight tracking-tight md:text-4xl">A inteligência é artificial.<br />O cuidado é seu.</h2><p className="mt-5 max-w-md leading-relaxed text-[#c2d3dc]">A IA lê documentos, separa informações e prepara sugestões. A conferência e as decisões continuam com quem conhece o condomínio.</p></div>
            <div className="space-y-5 rounded-2xl border border-white/15 bg-white/5 p-7">
              {[{ titulo: "Você confere antes de aprovar", texto: "Despesas e documentos passam pela sua revisão." }, { titulo: "A resposta vem com a fonte", texto: "As dúvidas usam trechos conferidos do regimento." }, { titulo: "Cada pessoa tem o seu acesso", texto: "Moradores, equipe e gestão com papéis definidos." }].map((x) => <div key={x.titulo} className="flex gap-4"><Check className="mt-1 h-5 w-5 shrink-0 text-[#c6ae7e]" aria-hidden /><div><h3 className="font-semibold">{x.titulo}</h3><p className="mt-1 text-sm text-[#c2d3dc]">{x.texto}</p></div></div>)}
            </div>
          </div>
        </section>
        <section id="como-funciona" className="site-container py-16 md:py-22">
          <p className="sobretitulo mb-4 text-primaria">Simples para começar</p><h2 className="text-3xl font-semibold tracking-tight md:text-4xl">Da organização à rotina.</h2>
          <ol className="mt-10 grid gap-8 md:grid-cols-3">{PASSOS.map((p) => <li key={p.numero} className="border-t border-borda pt-6"><span className="text-sm font-semibold text-primaria">{p.numero} <span className="ml-3 text-destaque" aria-hidden>—</span></span><h3 className="mt-5 text-xl font-semibold">{p.titulo}</h3><p className="mt-3 text-sm leading-relaxed text-suave">{p.texto}</p></li>)}</ol>
        </section>
        <section className="site-container pb-16"><div className="flex flex-wrap items-center justify-between gap-7 rounded-2xl border border-borda bg-[#e5edeb] p-8 md:p-12"><div><p className="sobretitulo mb-3 text-verde">Seu próximo passo</p><h2 className="text-2xl font-semibold tracking-tight md:text-3xl">Seu condomínio merece essa clareza.</h2><p className="mt-3 text-sm text-suave">Comece organizando a base. Construa uma rotina melhor.</p></div><Link href="/cadastro" className={classesBotao()}>Criar minha conta <ArrowRight className="h-4 w-4" aria-hidden /></Link></div></section>
      </main>
      <footer className="border-t border-borda bg-white"><div className="site-container flex flex-wrap items-center justify-between gap-5 py-8"><Logotipo /><p className="text-xs text-suave">Gestão mais clara. Condomínios mais bem cuidados.</p><Link href="/login" className="text-sm font-medium text-primaria">Acessar o painel <span aria-hidden>↗</span></Link></div><p className="site-container pb-6 text-xs text-suave">{BRAND.descricao}</p></footer>
    </div>
  );
}
