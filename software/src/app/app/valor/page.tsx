import type { Metadata } from "next";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { painelDeValor, pct, type PainelValor } from "@/features/valor/servico";
import { formatarReais } from "@/lib/negocio/dinheiro";
import { Aviso, CabecalhoPagina, Cartao, TituloCartao, classesBotao } from "@/components/ui";
import { SemCondominio, SeloExemplo } from "@/components/negocio";
import { BotaoImprimir } from "@/components/imprimir";

export const metadata: Metadata = { title: "Valor" };

function Linha({ rotulo, valor, como, exemplo }: { rotulo: string; valor: string; como: string; exemplo?: boolean }) {
  return (
    <div className="grid gap-1 border-b border-borda py-3 md:grid-cols-[1fr_200px]">
      <div className="min-w-0">
        <p className="font-medium">
          {rotulo} <SeloExemplo exemplo={exemplo} />
        </p>
        <p className="text-xs text-suave">Como calculamos: {como}</p>
      </div>
      <p className="text-lg font-semibold md:text-right">{valor}</p>
    </div>
  );
}

export default async function Valor({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, usuario, gestao, lista } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  const v: PainelValor = await painelDeValor(usuario.organizacao.id, condominio.id);
  const m = v.medido;
  const e = v.estimado;
  const temExemplo = usuario.organizacao.isDemo;
  return (
    <>
      <CabecalhoPagina
        titulo={`Valor · ${condominio.nome}`}
        descricao="Medido (contagens do banco) e estimado (parâmetros declarados) em blocos separados: nunca se somam."
        acao={
          <div className="flex flex-wrap gap-2 print:hidden">
            <BotaoImprimir />
            <a className={classesBotao("secundario", "sm")} href={`/api/valor/csv?c=${condominio.id}`}>
              CSV
            </a>
          </div>
        }
      />
      {temExemplo ? (
        <div className="mb-4">
          <Aviso tom="amarelo">Na conta de demonstração, o histórico dos últimos 30 dias é dado de exemplo do seed (marcado com o selo).</Aviso>
        </div>
      ) : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Cartao>
          <TituloCartao descricao="Últimos 30 dias (serviços: 12 meses).">Medido</TituloCartao>
          <Linha rotulo="Serviços dentro do prazo cadastrado" valor={`${m.servicosDentro.dentro} de ${m.servicosDentro.total} (${pct(m.servicosDentro.dentro, m.servicosDentro.total)})`} como="serviços conferidos com data do serviço até o vencimento anterior ÷ serviços conferidos com prazo, 12 meses" exemplo={temExemplo} />
          <Linha rotulo="Vencidos agora / vencendo em 30 dias" valor={`${m.vencidos} / ${m.vencendo}`} como="vencimentos ativos (conferidos) pela data cadastrada" />
          <Linha rotulo="Itens de rotina feitos" valor={`${m.rotinas.feitos} de ${m.rotinas.previstos} (${pct(m.rotinas.feitos, m.rotinas.previstos)})`} como="itens feitos ÷ itens previstos nos 30 dias anteriores a hoje" exemplo={temExemplo} />
          <Linha rotulo="Chamados resolvidos e mediana até resolver" valor={`${m.chamados.resolvidos} de ${m.chamados.abertos}; ${m.chamados.medianaHoras != null ? `${m.chamados.medianaHoras.toFixed(1).replace(".", ",")} h` : "—"}`} como="chamados de manutenção abertos no período com data de resolução; mediana de (resolvido − aberto)" exemplo={temExemplo} />
          <Linha rotulo="Resolvidos na entrada (autoajuda)" valor={`${m.autoajuda.resolvidos} de ${m.autoajuda.abertos} (${pct(m.autoajuda.resolvidos, m.autoajuda.abertos)})`} como="chamados encerrados pelo passo de autoajuda ÷ chamados abertos" exemplo={temExemplo} />
          <Linha rotulo="Dúvidas respondidas pelos documentos" valor={`${m.duvidas.respondidasDocs} de ${m.duvidas.total} (${pct(m.duvidas.respondidasDocs, m.duvidas.total)})`} como="dúvidas respondidas com citação conferida ÷ dúvidas recebidas" exemplo={temExemplo} />
          <Linha rotulo="Prestadores com documentos em dia" valor={`${m.prestadores.emDia} de ${m.prestadores.total}`} como="prestadores sem documento conferido vencido" />
          <Linha rotulo="Boletos com beneficiário impresso divergente" valor={String(m.boletosBeneficiarioDivergente)} como="boletos em que o beneficiário impresso (lido pela IA, sugestão) é diferente do prestador cadastrado" exemplo={temExemplo} />
          <Linha rotulo="Comunicados lidos" valor={`${m.comunicados.lidos} de ${m.comunicados.entregues} (${pct(m.comunicados.lidos, m.comunicados.entregues)})`} como='toques em "Li o aviso" ÷ entregas' exemplo={m.comunicados.exemplo} />
        </Cartao>
        {gestao ? (
          <Cartao>
            <TituloCartao descricao="Parâmetros declarados, editáveis. Não é economia comprovada.">Estimado</TituloCartao>
            <Linha rotulo="Tempo do síndico poupado" valor={`${e.minutos} min (${(e.minutos / 60).toFixed(1).replace(".", ",")} h)`} como={`(${e.respondidasDocs} dúvidas respondidas pelos documentos × ${e.minutosPorDuvida} min) + (${e.recibosIa} documentos lidos pela IA × ${e.minutosPorDocumentoLido} min)`} exemplo={temExemplo} />
            <Linha rotulo="Em reais (valor-hora declarado)" valor={formatarReais(e.valorCentavos)} como={`${(e.minutos / 60).toFixed(2).replace(".", ",")} h × ${formatarReais(e.valorHoraCentavos)}/h`} exemplo={temExemplo} />
            <p className="mt-3 text-xs text-suave">O resumo diário não entra no estimado (o síndico não fazia o resumo antes). Esta conta não se soma ao bloco medido.</p>
          </Cartao>
        ) : null}
      </div>
      {lista.length > 1 ? <p className="mt-4 text-xs text-suave">Use o seletor no topo para ver outro condomínio da carteira.</p> : null}
    </>
  );
}
