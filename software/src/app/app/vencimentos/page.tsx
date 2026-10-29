import type { Metadata } from "next";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { servicosRegistrados } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { historicoServicos, listarVencimentos, situacaoVencimento } from "@/features/vencimentos/servico";
import { prestadoresDoCondominio, textoSituacaoDocs } from "@/features/prestadores/servico";
import { agendarServicoAcao, conferirEAtivarAcao, conferirServicoAcao, criarDosModelosAcao, desativarAcao, recusarServicoAcao, registrarServicoAcao } from "@/features/vencimentos/acoes";
import { dataBR } from "@/lib/negocio/datas";
import { Aviso, Botao, CabecalhoPagina, Campo, Cartao, Selecao, Selo, TituloCartao } from "@/components/ui";
import { Mensagens, Ocultos, SemCondominio, SeloExemplo, SeloIA } from "@/components/negocio";

export const metadata: Metadata = { title: "Vencimentos" };

export default async function Vencimentos({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, usuario, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  const c = condominio.id;
  const todos = (await listarVencimentos(usuario.organizacao.id, c)).map((v) => ({ ...v, s: situacaoVencimento(v.proximo) }));
  const filtro = typeof sp.f === "string" ? sp.f : "";
  const lista = todos
    .filter((v) => (filtro === "vencidos" ? v.estadoConferencia === "ativo" && v.s.vencido : filtro === "30" ? v.estadoConferencia === "ativo" && v.s.vencendo30 : true))
    .sort((a, b) => (a.estadoConferencia === "ativo" ? 0 : 1) - (b.estadoConferencia === "ativo" ? 0 : 1) || (a.proximo ?? "9").localeCompare(b.proximo ?? "9"));
  const paraConferir = await db.select().from(servicosRegistrados).where(and(eq(servicosRegistrados.condominioId, c), eq(servicosRegistrados.estado, "para_conferir")));
  const hist = await historicoServicos(usuario.organizacao.id, todos.map((v) => v.id));
  const prests = gestao ? await prestadoresDoCondominio(usuario.organizacao.id, c) : [];
  const nomeV = new Map(todos.map((v) => [v.id, v.nome]));
  const voltar = "/app/vencimentos";
  return (
    <>
      <CabecalhoPagina titulo="Vencimentos" descricao="Referências informadas e prazos cadastrados e conferidos por você. Nada aqui é afirmação de que algo está de acordo com a legislação." />
      <Mensagens sp={sp} />
      {todos.length === 0 && gestao ? (
        <Cartao className="mb-6">
          <p className="mb-3 text-sm">Este condomínio ainda não tem vencimentos. Crie a partir dos modelos (todos nascem &ldquo;não conferidos&rdquo;).</p>
          <form action={criarDosModelosAcao}>
            <Ocultos c={c} voltar={voltar} />
            <Botao type="submit">Criar a partir dos modelos</Botao>
          </form>
        </Cartao>
      ) : null}
      {paraConferir.length && gestao ? (
        <Cartao className="mb-6">
          <TituloCartao descricao="Comprovantes lidos pela IA: só depois do Conferi o vencimento é recalculado.">Comprovantes para conferir</TituloCartao>
          <ul className="space-y-3">
            {paraConferir.map((r) => (
              <li key={r.id} className="rounded-lg border border-borda p-3 text-sm">
                <p className="font-medium">
                  {nomeV.get(r.vencimentoId)} <SeloIA />
                </p>
                {r.arquivoId ? (
                  <a className="text-xs underline" href={`/api/arquivos/${r.arquivoId}`} target="_blank" rel="noreferrer">
                    Abrir comprovante
                  </a>
                ) : null}
                <form action={conferirServicoAcao} className="mt-2 flex flex-wrap items-center gap-2">
                  <Ocultos c={c} voltar={voltar} extra={{ registroId: r.id }} />
                  <Campo name="dataServico" defaultValue={r.dataServico ? dataBR(r.dataServico) : ""} placeholder="Data do serviço" className="max-w-[160px]" />
                  <Campo name="validade" defaultValue={r.validadeImpressa ? dataBR(r.validadeImpressa) : ""} placeholder="Validade impressa" className="max-w-[160px]" />
                  <Botao type="submit" tamanho="sm">
                    Conferi
                  </Botao>
                </form>
                <form action={recusarServicoAcao} className="mt-1">
                  <Ocultos c={c} voltar={voltar} extra={{ registroId: r.id }} />
                  <button type="submit" className="text-xs text-perigo underline">
                    Recusar leitura
                  </button>
                </form>
              </li>
            ))}
          </ul>
        </Cartao>
      ) : null}
      <div className="space-y-4">
        {lista.map((v) => (
          <Cartao key={v.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-semibold">{v.nome}</h2>
                <p className="text-xs text-suave">
                  Referência informada: {v.referenciaInformada} · {v.usaValidadeImpressa ? "validade impressa no documento" : `periodicidade cadastrada: ${v.periodicidadeMeses} ${v.periodicidadeMeses === 1 ? "mês" : "meses"}`}
                </p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {v.variaPorLocal ? <Selo tom="amarelo">confira para o seu município</Selo> : null}
                  {v.estadoConferencia === "ativo" ? <Selo tom="verde">{`Conferido por ${v.conferidoPorNome} em ${v.conferidoEm?.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`}</Selo> : <Selo tom="cinza">{v.estadoConferencia === "desativado" ? "desativado" : "não conferido (sem avisos)"}</Selo>}
                </div>
                {v.notaConfira ? <p className="mt-1 text-xs text-amber-800">{v.notaConfira}</p> : null}
              </div>
              <Selo tom={v.estadoConferencia !== "ativo" ? "cinza" : v.s.tom === "cinza" ? "cinza" : v.s.tom}>{`${v.s.texto}${v.proximo ? ` · ${dataBR(v.proximo)}` : ""}`}</Selo>
            </div>
            {gestao ? (
              <div className="mt-3 grid gap-3 lg:grid-cols-3">
                <form action={conferirEAtivarAcao} className="flex flex-wrap items-end gap-2">
                  <Ocultos c={c} voltar={voltar} extra={{ vencimentoId: v.id }} />
                  <Campo name="proximo" defaultValue={v.proximo ? dataBR(v.proximo) : ""} placeholder="Próximo (dd/mm/aaaa)" className="max-w-[170px]" />
                  {!v.usaValidadeImpressa ? <Campo name="periodicidade" defaultValue={v.periodicidadeMeses ?? ""} placeholder="Meses" className="max-w-[80px]" /> : null}
                  <Botao type="submit" tamanho="sm" variante={v.estadoConferencia === "ativo" ? "secundario" : "primario"}>
                    Conferi e ativo
                  </Botao>
                </form>
                <form action={registrarServicoAcao} className="flex flex-wrap items-end gap-2">
                  <Ocultos c={c} voltar={voltar} extra={{ vencimentoId: v.id }} />
                  <Campo name="dataServico" placeholder="Serviço feito em" className="max-w-[150px]" />
                  <Campo name="validade" placeholder="Validade impressa" className="max-w-[150px]" />
                  <input type="file" name="comprovante" accept="image/*,application/pdf" className="max-w-[200px] text-xs" />
                  <Botao type="submit" tamanho="sm" variante="secundario">
                    Registrar serviço feito
                  </Botao>
                </form>
                <form action={agendarServicoAcao} className="flex flex-wrap items-end gap-2">
                  <Ocultos c={c} voltar={voltar} extra={{ vencimentoId: v.id }} />
                  <Selecao name="prestadorId" defaultValue="" className="max-w-[220px]">
                    <option value="">Sem prestador</option>
                    {prests.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.razaoSocial} ({p.situacao.emDia ? "em dia" : textoSituacaoDocs(p.situacao)})
                      </option>
                    ))}
                  </Selecao>
                  <Campo name="data" placeholder="Data (dd/mm/aaaa)" className="max-w-[150px]" />
                  <Campo name="justificativa" placeholder="Justificativa (doc. vencido)" className="max-w-[200px]" />
                  <Botao type="submit" tamanho="sm" variante="secundario">
                    Agendar serviço
                  </Botao>
                </form>
                {v.estadoConferencia === "ativo" ? (
                  <form action={desativarAcao}>
                    <Ocultos c={c} voltar={voltar} extra={{ vencimentoId: v.id }} />
                    <button type="submit" className="text-xs text-suave underline">
                      Desativar
                    </button>
                  </form>
                ) : null}
              </div>
            ) : null}
            {hist.filter((h) => h.vencimentoId === v.id && h.estado === "conferido").length ? (
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer text-suave">Histórico de serviços</summary>
                <ul className="mt-2 space-y-1">
                  {hist
                    .filter((h) => h.vencimentoId === v.id && h.estado === "conferido")
                    .map((h) => (
                      <li key={h.id} className="flex flex-wrap items-center gap-2">
                        <span>{dataBR(h.dataServico)}</span>
                        <Selo tom={h.dentroDoPrazo === false ? "vermelho" : "verde"}>{h.dentroDoPrazo === false ? "fora do prazo cadastrado" : "dentro do prazo cadastrado"}</Selo>
                        <span className="text-xs text-suave">conferido por {h.conferidoPorNome}</span>
                        <SeloExemplo exemplo={h.exemplo} />
                        {h.arquivoId ? (
                          <a className="text-xs underline" href={`/api/arquivos/${h.arquivoId}`} target="_blank" rel="noreferrer">
                            comprovante
                          </a>
                        ) : null}
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </Cartao>
        ))}
        {lista.length === 0 && todos.length > 0 ? <Aviso>Nenhum vencimento neste filtro.</Aviso> : null}
      </div>
    </>
  );
}
