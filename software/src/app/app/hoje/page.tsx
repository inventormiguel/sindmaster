import type { Metadata } from "next";
import Link from "next/link";
import { and, eq, gte } from "drizzle-orm";
import { db } from "@/db";
import { duvidas } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { numerosHoje } from "@/features/carteira/consultas";
import { ROTULO_ESTADO, ROTULO_URGENCIA } from "@/features/chamados/servico";
import { ROTULO_DOC, textoAlertaPagamento } from "@/features/prestadores/servico";
import { confirmarPagamentoAcao } from "@/features/prestadores/acoes";
import { agora, dataBR } from "@/lib/negocio/datas";
import { Botao, CabecalhoPagina, Campo, Cartao, Selo, TituloCartao, Vazio } from "@/components/ui";
import { Mensagens, Numero, Ocultos, SemCondominio } from "@/components/negocio";

export const metadata: Metadata = { title: "Hoje" };

export default async function Hoje({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, usuario, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  const c = condominio.id;
  const n = await numerosHoje(usuario.organizacao.id, c);
  const ontem = new Date(agora().getTime() - 86400000);
  const dv24 = await db.select().from(duvidas).where(and(eq(duvidas.condominioId, c), gte(duvidas.criadoEm, ontem)));
  const iaRespondeu = dv24.filter((d) => d.origemResposta === "ia" || d.estado === "aguardando_envio").length;
  const encaminhou = dv24.filter((d) => d.estado === "encaminhada" || d.estado === "respondida_sindico").length;
  const q = (p: string) => `${p}${p.includes("?") ? "&" : "?"}c=${c}`;
  const parados = new Set(n.chamadosParados.map((x) => x.id));
  const conselho = !gestao;

  return (
    <>
      <CabecalhoPagina titulo={`Hoje · ${condominio.nome}`} descricao={conselho ? "Visão do conselho: números e vencimentos, sem dado pessoal." : "O que venceu, o que vence, o que a equipe fez e o que espera por você."} />
      <Mensagens sp={sp} />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Numero rotulo="Vencidos" valor={n.vencidos.length} tom={n.vencidos.length ? "vermelho" : "verde"} href={q("/app/vencimentos?f=vencidos")} detalhe="fora do prazo cadastrado" />
        <Numero rotulo="Vencendo em 30 dias" valor={n.vencendo.length} tom={n.vencendo.length ? "amarelo" : undefined} href={q("/app/vencimentos?f=30")} />
        <Numero rotulo="Rotinas de hoje" valor={`${n.rotinasHoje.feitos} de ${n.rotinasHoje.previstos}`} href={conselho ? undefined : q("/app/rotinas")} detalhe={n.rotinasHoje.naoFeitos ? `${n.rotinasHoje.naoFeitos} não deu` : "tarefas registradas"} />
        <Numero rotulo="Chamados abertos" valor={n.chamadosAbertos.length} tom={n.chamadosPorUrgencia.emergencia ? "vermelho" : undefined} href={conselho ? undefined : q("/app/chamados?estado=abertos")} detalhe={`${n.chamadosPorUrgencia.emergencia ?? 0} emergência · ${n.chamadosPorUrgencia.alta ?? 0} alta · ${n.chamadosParados.length} parado(s)`} />
        <Numero rotulo="Aguardando confirmação" valor={n.aguardandoConfirmacao} href={conselho ? undefined : q("/app/chamados?estado=aguardando_confirmacao")} detalhe={`${n.resolvidosSemMorador} resolvido(s) sem morador para confirmar`} />
        <Numero rotulo="Dúvidas esperando você" valor={n.duvidasEsperando.length} tom={n.duvidasEsperando.length ? "amarelo" : undefined} href={conselho ? undefined : q("/app/duvidas?f=encaminhadas")} detalhe={`24 h: a IA respondeu ${iaRespondeu} e encaminhou ${encaminhou}`} />
        <Numero rotulo="Para conferir e aprovar" valor={n.totalRascunhos} href={conselho ? undefined : q("/app/despesas?f=para_conferir")} detalhe={`${n.rascunhos.despesas} despesa(s) · ${n.rascunhos.respostas} resposta(s) · ${n.rascunhos.documentos} documento(s) · ${n.rascunhos.comunicados} comunicado(s)`} />
        <Numero rotulo="Alertas abertos" valor={n.alertasAbertos.length} tom={n.alertasAbertos.length ? "vermelho" : undefined} detalhe={`${n.prestadoresComDocVencido.length} prestador(es) com documento vencido`} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Cartao>
          <TituloCartao descricao="Só os ativos (conferidos pelo síndico). Referência informada, prazo cadastrado.">Vencimentos</TituloCartao>
          {n.vencidos.length + n.vencendo.length === 0 ? (
            <Vazio>Nada vencido nem vencendo em 30 dias.</Vazio>
          ) : (
            <ul className="divide-y divide-borda text-sm">
              {[...n.vencidos, ...n.vencendo].map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <span className="min-w-0">{v.nome}</span>
                  <Selo tom={v.situacao.vencido ? "vermelho" : "amarelo"}>{`${v.situacao.texto} · ${dataBR(v.proximo)}`}</Selo>
                </li>
              ))}
            </ul>
          )}
        </Cartao>

        {conselho ? null : (
          <Cartao>
            <TituloCartao descricao="Emergências primeiro; em vermelho os parados acima do prazo da categoria.">Chamados abertos</TituloCartao>
            {n.chamadosAbertos.length === 0 ? (
              <Vazio>Nenhum chamado aberto.</Vazio>
            ) : (
              <ul className="divide-y divide-borda text-sm">
                {n.chamadosAbertos.map((ch) => (
                  <li key={ch.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                    <Link href={q(`/app/chamados/${ch.id}`)} className={`min-w-0 hover:underline ${parados.has(ch.id) ? "text-red-700" : ""}`}>
                      Nº {ch.numero} · {ch.descricao.slice(0, 70)}
                    </Link>
                    <span className="flex flex-wrap gap-1">
                      <Selo tom={ch.urgencia === "emergencia" ? "vermelho" : ch.urgencia === "alta" ? "amarelo" : "cinza"}>{ROTULO_URGENCIA[ch.urgencia]}</Selo>
                      <Selo>{ROTULO_ESTADO[ch.estado]}</Selo>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        )}

        {conselho ? null : (
          <Cartao>
            <TituloCartao descricao="Documentos de prestador e dados de pagamento.">Alertas e prestadores</TituloCartao>
            {n.prestadoresComDocVencido.length === 0 && n.alertasAbertos.length === 0 ? <Vazio>Nenhum alerta aberto.</Vazio> : null}
            <ul className="space-y-3 text-sm">
              {n.prestadoresComDocVencido.map((p) => (
                <li key={p.id}>
                  <Link href={q(`/app/prestadores/${p.id}`)} className="font-medium hover:underline">
                    {p.razaoSocial}
                  </Link>
                  : {p.situacao.vencidos.map((d) => `${ROTULO_DOC[d.tipo]} vencida desde ${dataBR(d.validade)}`).join("; ")}
                </li>
              ))}
              {n.alertasAbertos
                .filter((a) => a.tipo === "dados_pagamento")
                .map((a) => (
                  <li key={a.id} className="rounded-lg border border-red-200 bg-red-50 p-3">
                    <p>{textoAlertaPagamento(a.fatos ?? {})}</p>
                    {gestao ? (
                      <form action={confirmarPagamentoAcao} className="mt-2 flex flex-wrap items-center gap-2">
                        <Ocultos c={c} voltar="/app/hoje" extra={{ alertaId: a.id }} />
                        <Campo name="comQuem" placeholder="Confirmei por telefone com (nome)" className="max-w-xs" required />
                        <Botao type="submit" tamanho="sm" variante="secundario">
                          Confirmei por telefone
                        </Botao>
                      </form>
                    ) : null}
                  </li>
                ))}
            </ul>
          </Cartao>
        )}

        {conselho ? null : (
          <Cartao>
            <TituloCartao descricao="Por item, sem horário nem ranking de pessoas.">Rotinas de hoje</TituloCartao>
            {n.rotinasHoje.itens.length === 0 ? (
              <Vazio>Nenhum item previsto hoje.</Vazio>
            ) : (
              <ul className="divide-y divide-borda text-sm">
                {n.rotinasHoje.itens.slice(0, 14).map(({ item, modelo }) => (
                  <li key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                    <span className="min-w-0">{modelo.item}</span>
                    <Selo tom={item.estado === "feito" ? "verde" : item.estado === "nao_feito" ? "vermelho" : "cinza"}>{item.estado === "feito" ? "feito" : item.estado === "nao_feito" ? "não deu" : "previsto"}</Selo>
                  </li>
                ))}
              </ul>
            )}
          </Cartao>
        )}
      </div>
    </>
  );
}
