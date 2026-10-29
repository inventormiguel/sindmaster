import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { alertas, emissoresCertidao, prestadorCondominios, prestadorDocumentos, prestadores, prestadorPagamentos } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { ROTULO_DOC, situacaoDocumentos, textoAlertaPagamento, textoSituacaoDocs, titularConfere } from "@/features/prestadores/servico";
import { alterarPagamentoAcao, conferirDocumentoAcao, confirmarPagamentoAcao, enviarDocumentoPrestador, pedirDocumentoAcao, recusarDocumentoAcao } from "@/features/prestadores/acoes";
import { dataBR } from "@/lib/negocio/datas";
import { dataHora } from "@/lib/formato";
import { Botao, CabecalhoPagina, Campo, Cartao, Selecao, Selo, TituloCartao } from "@/components/ui";
import { Mensagens, Ocultos, SeloIA } from "@/components/negocio";

export const metadata: Metadata = { title: "Prestador" };

export default async function Prestador({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { condominio, usuario, gestao } = await contextoDaPagina(sp);
  if (!condominio || !gestao) notFound();
  const c = condominio.id;
  const [p] = await db
    .select({ p: prestadores })
    .from(prestadores)
    .innerJoin(prestadorCondominios, and(eq(prestadorCondominios.prestadorId, prestadores.id), eq(prestadorCondominios.condominioId, c)))
    .where(and(eq(prestadores.id, id), eq(prestadores.organizacaoId, usuario.organizacao.id)))
    .limit(1);
  if (!p) notFound();
  const pr = p.p;
  const [docs, pags, abertos, emissores] = await Promise.all([
    db.select().from(prestadorDocumentos).where(eq(prestadorDocumentos.prestadorId, pr.id)).orderBy(desc(prestadorDocumentos.criadoEm)),
    db.select().from(prestadorPagamentos).where(eq(prestadorPagamentos.prestadorId, pr.id)).orderBy(desc(prestadorPagamentos.criadoEm)),
    db.select().from(alertas).where(and(eq(alertas.refId, pr.id), eq(alertas.condominioId, c), isNull(alertas.fechadoEm))),
    db.select().from(emissoresCertidao),
  ]);
  const sit = situacaoDocumentos(docs);
  const voltar = `/app/prestadores/${pr.id}`;
  return (
    <>
      <CabecalhoPagina titulo={pr.razaoSocial} descricao={`${pr.cnpj ?? "sem CNPJ"} · ${pr.categorias.join(", ")}${pr.consultadoEm ? ` · consultado na BrasilAPI em ${pr.consultadoEm.toLocaleDateString("pt-BR")}: ${pr.situacaoCadastral ?? "—"}` : ""}`} />
      <Mensagens sp={sp} />
      {abertos.map((a) => (
        <Cartao key={a.id} className="mb-4 border-red-200 bg-red-50">
          <p className="text-sm">{textoAlertaPagamento(a.fatos ?? {})}</p>
          <form action={confirmarPagamentoAcao} className="mt-2 flex flex-wrap gap-2">
            <Ocultos c={c} voltar={voltar} extra={{ alertaId: a.id }} />
            <Campo name="comQuem" placeholder="Confirmei por telefone com (nome)" className="max-w-xs" required />
            <Botao type="submit" tamanho="sm" variante="secundario">
              Confirmei por telefone
            </Botao>
          </form>
        </Cartao>
      ))}
      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <Cartao>
          <TituloCartao descricao={textoSituacaoDocs(sit)} acao={<form action={pedirDocumentoAcao}><Ocultos c={c} voltar={voltar} extra={{ prestadorId: pr.id }} /><Botao type="submit" tamanho="sm" variante="secundario">Pedir documento pelo Telegram</Botao></form>}>
            Documentos
          </TituloCartao>
          <ul className="space-y-3">
            {docs.map((d) => {
              const em = emissores.find((e) => e.tipo === d.tipo);
              const tit = titularConfere(d.tipo, d.titularCnpj, pr.cnpj);
              return (
                <li key={d.id} className="rounded-lg border border-borda p-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{ROTULO_DOC[d.tipo]}</span>
                    {d.estado === "conferido" ? <SeloIA conferidoPor={d.conferidoPorNome} conferidoEm={d.conferidoEm} /> : d.estado === "recusado" ? <Selo tom="vermelho">recusado</Selo> : d.origemLeitura === "ia" ? <SeloIA /> : <Selo tom="amarelo">para conferir</Selo>}
                    <Selo>{`validade impressa: ${dataBR(d.validade)}`}</Selo>
                    {tit === false ? <Selo tom="vermelho">titular não confere com o CNPJ</Selo> : null}
                    {d.enviadoPor === "telegram" ? <Selo tom="azul">pelo Telegram</Selo> : null}
                  </div>
                  <p className="mt-1 text-xs text-suave">
                    Emitido em {dataBR(d.emitidoEm)} · titular {d.titularCnpj ?? "—"} · {dataHora(d.criadoEm)}
                    {d.arquivoId ? (
                      <>
                        {" · "}
                        <a className="underline" href={`/api/arquivos/${d.arquivoId}`} target="_blank" rel="noreferrer">
                          arquivo
                        </a>
                      </>
                    ) : null}
                    {em ? (
                      <>
                        {" · "}
                        <a className="underline" href={em.url} target="_blank" rel="noreferrer">
                          Confira a autenticidade no emissor ({em.nome}; link conferido em {em.conferidoEm})
                        </a>
                      </>
                    ) : null}
                  </p>
                  {d.estado === "para_conferir" ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <form action={conferirDocumentoAcao} className="flex flex-wrap gap-2">
                        <Ocultos c={c} voltar={voltar} extra={{ documentoId: d.id }} />
                        <Campo name="emitidoEm" defaultValue={d.emitidoEm ? dataBR(d.emitidoEm) : ""} placeholder="Emissão" className="w-32" />
                        <Campo name="validade" defaultValue={d.validade ? dataBR(d.validade) : ""} placeholder="Validade impressa" className="w-36" />
                        <Botao type="submit" tamanho="sm">
                          Conferi
                        </Botao>
                      </form>
                      <form action={recusarDocumentoAcao}>
                        <Ocultos c={c} voltar={voltar} extra={{ documentoId: d.id }} />
                        <Botao type="submit" tamanho="sm" variante="perigo">
                          Recusar
                        </Botao>
                      </form>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Cartao>
        <div className="space-y-6">
          <Cartao>
            <TituloCartao descricao="A IA lê tipo, titular, emissão e validade (3 primeiras páginas); você confere.">Enviar documento</TituloCartao>
            <form action={enviarDocumentoPrestador} className="space-y-2">
              <Ocultos c={c} voltar={voltar} extra={{ prestadorId: pr.id }} />
              <Selecao name="tipo" defaultValue="cnd_federal">
                {Object.entries(ROTULO_DOC).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </Selecao>
              <input type="file" name="arquivo" accept="image/*,application/pdf" className="block w-full text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <Campo name="emitidoEm" placeholder="Emissão" />
                <Campo name="validade" placeholder="Validade" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="lerComIa" defaultChecked /> Ler com a IA
              </label>
              <Botao type="submit" tamanho="sm">
                Enviar
              </Botao>
            </form>
          </Cartao>
          <Cartao>
            <TituloCartao descricao="Cifrados; só o síndico vê o resumo. Mudança abre alerta de confirmação por telefone.">Dados de pagamento</TituloCartao>
            <ul className="mb-3 space-y-1 text-sm">
              {pags.map((x, i) => (
                <li key={x.id} className={i ? "text-suave" : ""}>
                  {x.resumo} · {dataHora(x.criadoEm)} · por {x.alteradoPorRotulo}
                  {i === 0 ? " (vigente)" : ""}
                </li>
              ))}
            </ul>
            <form action={alterarPagamentoAcao} className="space-y-2">
              <Ocultos c={c} voltar={voltar} extra={{ prestadorId: pr.id }} />
              <Selecao name="tipo" defaultValue="pix">
                <option value="pix">Chave Pix</option>
                <option value="conta">Banco / agência / conta</option>
              </Selecao>
              <Campo name="dados" placeholder="Novos dados" required />
              <Botao type="submit" tamanho="sm" variante="secundario">
                Alterar dados de pagamento
              </Botao>
            </form>
          </Cartao>
        </div>
      </div>
    </>
  );
}
