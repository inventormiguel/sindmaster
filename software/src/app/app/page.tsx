import Link from "next/link";
import { desc, eq, inArray } from "drizzle-orm";
import { CheckCircle2, Circle } from "lucide-react";
import { db } from "@/db";
import { cronExecucoes, documentos, pessoas, telegramUpdates } from "@/db/schema";
import { statusIntegracoes } from "@/lib/integracoes";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { numerosHoje } from "@/features/carteira/consultas";
import { CabecalhoPagina, Cartao, Selo, TituloCartao, classesBotao } from "@/components/ui";
import { dataHora } from "@/lib/formato";

export default async function Carteira({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { usuario, lista } = await contextoDaPagina(sp);
  const org = usuario.organizacao.id;
  const cartoes = await Promise.all(lista.map(async (c) => ({ c, n: await numerosHoje(org, c.id) })));
  const [ultimoWebhook] = await db.select({ em: telegramUpdates.recebidoEm }).from(telegramUpdates).orderBy(desc(telegramUpdates.recebidoEm)).limit(1);
  const [ultimoDiario] = await db.select().from(cronExecucoes).where(eq(cronExecucoes.job, "diario")).orderBy(desc(cronExecucoes.iniciadoEm)).limit(1);
  const ids = lista.map((c) => c.id);
  const [integracoes, nDocs, nVinc] = await Promise.all([
    statusIntegracoes(),
    ids.length ? db.select({ id: documentos.id }).from(documentos).where(inArray(documentos.condominioId, ids)) : Promise.resolve([]),
    ids.length ? db.select({ id: pessoas.id, chat: pessoas.telegramChatId, papel: pessoas.papel }).from(pessoas).where(inArray(pessoas.condominioId, ids)) : Promise.resolve([]),
  ]);
  const passos = [
    { feito: lista.length > 0, texto: "Cadastrar o primeiro condomínio", href: "/app/condominios" },
    { feito: integracoes.telegram.status === "conectada", texto: "Criar o bot no @BotFather, colar o token e testar", href: "/app/integracoes" },
    { feito: nVinc.some((p) => p.papel === "sindico" && p.chat), texto: "Vincular o seu Telegram como síndico", href: "/app/telegram" },
    { feito: nDocs.length > 0, texto: "Subir o regimento e a convenção", href: "/app/documentos" },
    { feito: integracoes.anthropic.status === "conectada", texto: "Colar a chave da Anthropic e testar (ou seguir sem IA)", href: "/app/integracoes" },
  ];
  return (
    <>
      <CabecalhoPagina titulo="Carteira" descricao={`${usuario.organizacao.nome} · ${lista.length} condomínio(s)`} />
      {typeof sp["boas-vindas"] === "string" ? (
        <div className="mb-6 rounded-xl border border-primaria/30 bg-primaria-clara/40 p-4 text-sm">
          <p className="font-semibold">Conta criada. Bem-vindo(a)!</p>
          <p className="mt-1 text-suave">A conta começa vazia. Siga os primeiros passos abaixo.</p>
        </div>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {cartoes.map(({ c, n }) => {
          const emerg = n.chamadosAbertos.filter((x) => x.urgencia === "emergencia").length;
          return (
            <Cartao key={c.id}>
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate text-base font-semibold">{c.nome}</h2>
                  <p className="text-xs text-suave">{[c.cidade, c.uf].filter(Boolean).join("-")} · {c.papel === "conselho" ? "conselho (leitura)" : c.papel === "admin" ? "administração" : "síndico"}</p>
                </div>
                <Link href={`/app/hoje?c=${c.id}`} className={classesBotao("secundario", "sm")}>
                  Abrir Hoje
                </Link>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <dt className="text-suave">Vencidos</dt>
                <dd className={n.vencidos.length ? "font-semibold text-red-700" : ""}>{n.vencidos.length}</dd>
                <dt className="text-suave">Vencendo em 30 dias</dt>
                <dd>{n.vencendo.length}</dd>
                <dt className="text-suave">Chamados abertos</dt>
                <dd>
                  {n.chamadosAbertos.length}
                  {emerg ? <span className="ml-1 text-red-700">({emerg} emergência)</span> : null}
                </dd>
                <dt className="text-suave">Dúvidas esperando</dt>
                <dd>{n.duvidasEsperando.length}</dd>
                <dt className="text-suave">Itens para conferir</dt>
                <dd>{n.totalRascunhos}</dd>
              </dl>
            </Cartao>
          );
        })}
      </div>
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Cartao>
          <TituloCartao descricao="O básico para o condomínio funcionar pelo Telegram.">Primeiros passos</TituloCartao>
          <ul className="space-y-3">
            {passos.map((p) => (
              <li key={p.texto} className="flex flex-wrap items-center gap-3">
                {p.feito ? <CheckCircle2 className="h-5 w-5 text-primaria" aria-hidden /> : <Circle className="h-5 w-5 text-slate-300" aria-hidden />}
                <span className={p.feito ? "text-suave line-through" : ""}>{p.texto}</span>
                {!p.feito ? (
                  <Link href={p.href} className={`${classesBotao("secundario", "sm")} ml-auto`}>
                    Abrir
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="Detalhes em Integrações.">Saúde</TituloCartao>
          <p className="text-sm">Último webhook ou mensagem recebida: {ultimoWebhook ? dataHora(ultimoWebhook.em) : "nenhum ainda"}</p>
          <p className="mt-1 text-sm">
            Último diário: {ultimoDiario ? dataHora(ultimoDiario.iniciadoEm) : "ainda não rodou"} {ultimoDiario ? <Selo tom={ultimoDiario.status === "ok" ? "verde" : "vermelho"}>{ultimoDiario.status}</Selo> : null}
          </p>
        </Cartao>
      </div>
    </>
  );
}
