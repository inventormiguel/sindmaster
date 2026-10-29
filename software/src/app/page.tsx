import Link from "next/link";
import { CalendarClock, ClipboardCheck, MessageCircle, Receipt, ShieldCheck, Wrench } from "lucide-react";
import { BRAND } from "@/lib/brand";
import { Logotipo } from "@/components/logo";
import { classesBotao } from "@/components/ui";

const RECURSOS = [
  { icone: CalendarClock, titulo: "Vencimentos sob controle", texto: "Caixa d'água, extintores, seguro, elevador: cada prazo cadastrado e conferido por você, com aviso no resumo das 8h e o comprovante lido pela IA." },
  { icone: Wrench, titulo: "Chamados que fecham de verdade", texto: "O morador abre pelo Telegram com foto; emergência avisa na hora; o serviço só fecha com foto e a confirmação do morador." },
  { icone: ClipboardCheck, titulo: "Rotina da equipe com foto", texto: "O zelador recebe as tarefas do dia e manda a foto de cada uma. Tarefa feita, nunca controle de ponto." },
  { icone: MessageCircle, titulo: "Dúvidas respondidas pelo regimento", texto: "A IA responde só com o texto literal da convenção e do regimento, citando o artigo. Quando não encontra, passa para você." },
  { icone: Receipt, titulo: "Recibos e boletos conferidos", texto: "Foto do recibo vira despesa para conferir; no boleto, o código confere a linha digitável e você confere o beneficiário no app do banco." },
  { icone: ShieldCheck, titulo: "Prestadores e privacidade", texto: "Certidões vigiadas, alerta quando os dados de pagamento mudam, nada se apaga, e nenhum morador vê dado de outro." },
];

const PASSOS = [
  { n: "1", titulo: "Cadastre o condomínio", texto: "Unidades em um minuto, vencimentos a partir de modelos, regimento e convenção divididos por artigo." },
  { n: "2", titulo: "Convide pelo Telegram", texto: "QR de uso único por unidade, impresso para a portaria entregar; funcionários e prestadores um a um." },
  { n: "3", titulo: "Acompanhe pelo Hoje", texto: "Às 8h, o resumo do que venceu, do que vence e do que ficou para trás; no painel, o que espera por você." },
];

export default function Inicio() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b border-borda bg-superficie">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Logotipo />
          <nav className="flex items-center gap-2">
            <Link href="/login" className={classesBotao("fantasma")}>
              Entrar
            </Link>
            <Link href="/cadastro" className={classesBotao("primario")}>
              Criar conta
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        <section className="bg-gradient-to-b from-primaria-clara/60 to-fundo">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-16 md:grid-cols-2 md:items-center">
            <div>
              <p className="text-sm font-semibold uppercase tracking-wide text-primaria">{BRAND.descricao}</p>
              <h1 className="mt-3 text-4xl font-bold leading-tight tracking-tight text-tinta md:text-5xl">{BRAND.slogan}</h1>
              <p className="mt-4 text-lg text-suave">
                Um painel por condomínio e da carteira inteira, e o Telegram para funcionários, moradores e prestadores. A IA lê, separa e redige; nada sai em nome do condomínio sem a sua conferência.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/cadastro" className={classesBotao("primario")}>
                  Criar conta
                </Link>
                <Link href="/login" className={classesBotao("secundario")}>
                  Entrar
                </Link>
              </div>
            </div>
            <div className="rounded-2xl border border-borda bg-superficie p-5 shadow-sm">
              <p className="text-xs font-medium uppercase tracking-wide text-suave">Conversa no Telegram</p>
              <div className="mt-4 space-y-3 text-sm">
                <div className="ml-auto w-fit max-w-[85%] rounded-2xl rounded-br-sm bg-primaria px-4 py-2 text-white">Posso fazer minha mudança no sábado à tarde?</div>
                <div className="w-fit max-w-[85%] rounded-2xl rounded-bl-sm bg-fundo px-4 py-2">
                  Resposta automática da IA, a partir dos documentos do condomínio: pode, de segunda a sábado, das 8h às 18h, com agendamento na portaria 48 horas antes.
                  <br />
                  <span className="text-suave">Regimento Interno, art. 15: &ldquo;Mudanças podem ser feitas de segunda a sábado, das 8h às 18h…&rdquo;</span>
                </div>
                <div className="w-fit max-w-[85%] rounded-xl border border-borda px-3 py-1.5 text-xs">Falar com o síndico</div>
              </div>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16">
          <h2 className="text-2xl font-semibold tracking-tight">O que o síndico ganha</h2>
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {RECURSOS.map((r) => (
              <div key={r.titulo} className="rounded-xl border border-borda bg-superficie p-5">
                <r.icone className="h-6 w-6 text-primaria" aria-hidden />
                <h3 className="mt-3 font-semibold">{r.titulo}</h3>
                <p className="mt-1 text-sm text-suave">{r.texto}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="border-y border-borda bg-superficie">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-2xl font-semibold tracking-tight">Como funciona</h2>
            <ol className="mt-8 grid gap-6 md:grid-cols-3">
              {PASSOS.map((p) => (
                <li key={p.n} className="flex gap-4">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primaria text-sm font-bold text-white">{p.n}</span>
                  <div>
                    <h3 className="font-semibold">{p.titulo}</h3>
                    <p className="mt-1 text-sm text-suave">{p.texto}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 py-16 text-center">
          <h2 className="text-2xl font-semibold tracking-tight">Comece pelo seu condomínio</h2>
          <p className="mt-2 text-suave">Crie a conta, cadastre o condomínio e mande o primeiro convite hoje.</p>
          <div className="mt-6 flex justify-center gap-3">
            <Link href="/cadastro" className={classesBotao("primario")}>
              Criar conta
            </Link>
            <Link href="/login" className={classesBotao("secundario")}>
              Entrar
            </Link>
          </div>
        </section>
      </main>

      <footer className="border-t border-borda bg-superficie">
        <div className="mx-auto max-w-6xl px-4 py-6 text-sm text-suave">
          {BRAND.nome} · {BRAND.descricao}
        </div>
      </footer>
    </div>
  );
}
