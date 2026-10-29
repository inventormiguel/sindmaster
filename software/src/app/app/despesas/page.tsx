import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { despesas } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { agruparDespesas, CATEGORIAS_DESPESA, ROTULO_CATEGORIA_DESPESA, type Conferencia } from "@/features/despesas/servico";
import { prestadoresDoCondominio } from "@/features/prestadores/servico";
import { aprovarAlcadaAcao, enviarReciboAcao, estornarAcao, lancarAcao, recusarAcao, salvarCamposAcao } from "@/features/despesas/acoes";
import { instrucaoBeneficiario } from "@/lib/negocio/boleto";
import { dataBR, hojeISO } from "@/lib/negocio/datas";
import { formatarReais } from "@/lib/negocio/dinheiro";
import { iaDisponivel } from "@/lib/ia/funcoes";
import { Aviso, Botao, CabecalhoPagina, Campo, Cartao, Rotulo, Selecao, Selo, TituloCartao, Vazio, classesBotao } from "@/components/ui";
import { Abas, Mensagens, Ocultos, SemCondominio, SeloExemplo, SeloIA, Tabela, Td } from "@/components/negocio";

export const metadata: Metadata = { title: "Despesas" };

export default async function Despesas({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, usuario, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  const c = condominio.id;
  const f = gestao ? (typeof sp.f === "string" ? sp.f : "para_conferir") : "lancada";
  const mes = typeof sp.mes === "string" && /^\d{4}-\d{2}$/.test(sp.mes) ? sp.mes : hojeISO().slice(0, 7);
  const todas = await db.select().from(despesas).where(and(eq(despesas.condominioId, c))).orderBy(desc(despesas.criadoEm));
  const filtroEstados: Record<string, string[]> = { para_conferir: ["para_conferir", "bloqueada", "aguardando_aprovacao"], lancada: ["lancada"], estornada: ["estornada"], recusada: ["recusada"] };
  const lista = todas.filter((d) => (filtroEstados[f] ?? filtroEstados.para_conferir).includes(d.estado) && (f === "para_conferir" || (d.dataEmissao ?? d.criadoEm.toISOString()).startsWith(mes)));
  const prests = gestao ? await prestadoresDoCondominio(usuario.organizacao.id, c) : [];
  const grupo = agruparDespesas(todas.filter((d) => (d.dataEmissao ?? "").startsWith(mes)));
  const voltar = `/app/despesas?f=${f}&mes=${mes}`;
  const aba = (k: string, r: string) => ({ href: `/app/despesas?c=${c}&f=${k}&mes=${mes}`, rotulo: r, ativo: f === k });
  return (
    <>
      <CabecalhoPagina
        titulo="Despesas"
        descricao="Recibos, notas e boletos lidos pela IA e conferidos por você. Nada se apaga: correção é estorno com motivo. Não é balancete contábil."
        acao={<a className={classesBotao("secundario", "sm")} href={`/api/despesas/csv?c=${c}&mes=${mes}`}>CSV do mês</a>}
      />
      <Mensagens sp={sp} />
      {gestao ? <Abas itens={[aba("para_conferir", "Para conferir"), aba("lancada", "Lançadas"), aba("estornada", "Estornadas"), aba("recusada", "Recusadas")]} /> : null}
      <div className="grid gap-6 2xl:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {lista.length === 0 ? <Vazio>Nada por aqui.</Vazio> : null}
          {f === "para_conferir"
            ? lista.map((d) => {
                const conf = d.conferencia as Conferencia | null;
                const prest = prests.find((p) => p.id === d.prestadorId);
                return (
                  <Cartao key={d.id}>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                      <Selo tom={d.estado === "bloqueada" ? "vermelho" : d.estado === "aguardando_aprovacao" ? "azul" : "amarelo"}>{d.estado === "bloqueada" ? "Bloqueada pela conferência do código" : d.estado === "aguardando_aprovacao" ? "Aguardando aprovação (acima da alçada)" : "Para conferir"}</Selo>
                      {d.origem === "ia" ? <SeloIA /> : null}
                      <Selo>{d.tipoDocumento.replace("_", " ")}</Selo>
                      <SeloExemplo exemplo={d.exemplo} />
                    </div>
                    <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
                      {d.arquivoId ? (
                        <a href={`/api/arquivos/${d.arquivoId}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-borda">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={`/api/arquivos/${d.arquivoId}`} alt="Documento da despesa" className="max-h-72 w-full object-contain" />
                        </a>
                      ) : (
                        <div className="rounded-lg border border-dashed border-borda p-4 text-xs text-suave">Sem arquivo</div>
                      )}
                      <div className="min-w-0 space-y-3">
                        {d.estado !== "aguardando_aprovacao" ? (
                          <form action={salvarCamposAcao} className="grid gap-2 md:grid-cols-2">
                            <Ocultos c={c} voltar={voltar} extra={{ despesaId: d.id }} />
                            <Campo name="fornecedorNome" defaultValue={d.fornecedorNome ?? ""} placeholder="Fornecedor" />
                            <Campo name="cnpj" defaultValue={d.cnpj ?? ""} placeholder="CNPJ" />
                            <Campo name="valor" defaultValue={d.valorCentavos != null ? formatarReais(d.valorCentavos).replace("R$ ", "") : ""} placeholder="Valor (1.380,00)" />
                            <Campo name="vencimento" defaultValue={d.vencimento ? dataBR(d.vencimento) : ""} placeholder="Vencimento" />
                            <Campo name="dataEmissao" defaultValue={d.dataEmissao ? dataBR(d.dataEmissao) : ""} placeholder="Emissão" />
                            <Selecao name="categoria" defaultValue={d.categoria}>
                              {CATEGORIAS_DESPESA.map((k) => (
                                <option key={k} value={k}>
                                  {ROTULO_CATEGORIA_DESPESA[k]}
                                </option>
                              ))}
                            </Selecao>
                            <Selecao name="prestadorId" defaultValue={d.prestadorId ?? ""}>
                              <option value="">Sem prestador ligado</option>
                              {prests.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.razaoSocial}
                                </option>
                              ))}
                            </Selecao>
                            <Campo name="descricao" defaultValue={d.descricao ?? ""} placeholder="Descrição" />
                            <div className="md:col-span-2">
                              <Botao type="submit" tamanho="sm" variante="secundario">
                                Salvar campos
                              </Botao>
                            </div>
                          </form>
                        ) : (
                          <p className="text-sm">
                            {d.fornecedorNome} · {formatarReais(d.valorCentavos)} · conferida por {d.conferidoPorNome}
                          </p>
                        )}
                        {conf?.linha ? (
                          <div className="rounded-lg bg-fundo p-3 text-sm">
                            <p>
                              Linha digitável: {conf.linha.valida ? <Selo tom="verde">DVs conferidos</Selo> : <Selo tom="vermelho">inválida</Selo>} {conf.linha.banco ? `· emitido pelo ${conf.linha.banco}` : ""}
                            </p>
                            {conf.linha.valida ? <p className="text-xs text-suave">Recalculado da linha digitável: {conf.linha.valor} · vencimento {dataBR(conf.linha.vencimento)}</p> : null}
                          </div>
                        ) : null}
                        {(d.divergencias ?? []).map((x) => (
                          <Aviso key={x} tom={x.startsWith("Beneficiário") ? "amarelo" : "vermelho"}>
                            {x}
                          </Aviso>
                        ))}
                        {d.linhaDigitavel ? <Aviso tom="azul">{instrucaoBeneficiario(prest?.razaoSocial ?? d.fornecedorNome, prest?.cnpj ?? d.cnpj)}</Aviso> : null}
                        {d.estado === "aguardando_aprovacao" ? (
                          <form action={aprovarAlcadaAcao}>
                            <Ocultos c={c} voltar={voltar} extra={{ despesaId: d.id }} />
                            <Botao type="submit" tamanho="sm">
                              Aprovar e lançar
                            </Botao>
                          </form>
                        ) : (
                          <form action={lancarAcao} className="space-y-2">
                            <Ocultos c={c} voltar={voltar} extra={{ despesaId: d.id }} />
                            {d.linhaDigitavel ? (
                              <label className="flex items-center gap-2 text-sm font-medium">
                                <input type="checkbox" name="beneficiario" required /> Conferi o beneficiário no app do banco
                              </label>
                            ) : null}
                            {d.estado === "bloqueada" ? <Campo name="motivo" placeholder="Motivo da decisão (obrigatório para seguir)" required /> : null}
                            <Botao type="submit" tamanho="sm">
                              Conferi e lançar
                            </Botao>
                          </form>
                        )}
                        <form action={recusarAcao} className="flex flex-wrap gap-2">
                          <Ocultos c={c} voltar={voltar} extra={{ despesaId: d.id }} />
                          <Campo name="motivo" placeholder="Motivo da recusa" className="max-w-sm" required />
                          <Botao type="submit" tamanho="sm" variante="perigo">
                            Recusar
                          </Botao>
                        </form>
                      </div>
                    </div>
                  </Cartao>
                );
              })
            : (
              <Cartao>
                <TituloCartao acao={<form className="flex items-center gap-2"><input type="hidden" name="c" value={c} /><input type="hidden" name="f" value={f} /><Campo type="month" name="mes" defaultValue={mes} className="w-40" /><Botao type="submit" tamanho="sm" variante="secundario">Ver mês</Botao></form>}>
                  {f === "lancada" ? "Lançadas" : f === "estornada" ? "Estornadas" : "Recusadas"}
                </TituloCartao>
                <Tabela cabecalho={["Data", "Fornecedor", "Categoria", "Valor", f === "lancada" ? "Conferida por" : "Motivo", ""]}>
                  {lista.map((d) => (
                    <tr key={d.id}>
                      <Td className="whitespace-nowrap">{dataBR(d.dataEmissao)}</Td>
                      <Td>
                        {d.fornecedorNome} <SeloExemplo exemplo={d.exemplo} />
                        {d.arquivoId ? (
                          <a className="block text-xs underline" href={`/api/arquivos/${d.arquivoId}`} target="_blank" rel="noreferrer">
                            comprovante
                          </a>
                        ) : null}
                      </Td>
                      <Td>{ROTULO_CATEGORIA_DESPESA[d.categoria] ?? d.categoria}</Td>
                      <Td className="whitespace-nowrap">{formatarReais(d.valorCentavos)}</Td>
                      <Td>{f === "lancada" ? d.conferidoPorNome : f === "estornada" ? `${d.estornoMotivo} (${d.estornadoPorNome})` : d.decisaoMotivo}</Td>
                      <Td>
                        {f === "lancada" && gestao ? (
                          <form action={estornarAcao} className="flex gap-1">
                            <Ocultos c={c} voltar={voltar} extra={{ despesaId: d.id }} />
                            <Campo name="motivo" placeholder="Motivo do estorno" className="w-40" required />
                            <Botao type="submit" tamanho="sm" variante="perigo">
                              Estornar
                            </Botao>
                          </form>
                        ) : null}
                      </Td>
                    </tr>
                  ))}
                </Tabela>
              </Cartao>
            )}
        </div>
        <div className="space-y-6">
          {gestao ? (
            <Cartao>
              <TituloCartao descricao={iaDisponivel() ? "A IA lê os campos; você confere." : "IA não conectada: você preenche os campos."}>Enviar recibo, nota ou boleto</TituloCartao>
              <form action={enviarReciboAcao} className="space-y-3">
                <Ocultos c={c} voltar="/app/despesas?f=para_conferir" />
                <Rotulo htmlFor="arquivo">Foto ou PDF (até 4 MB)</Rotulo>
                <input id="arquivo" type="file" name="arquivo" accept="image/*,application/pdf" required className="block w-full text-sm" />
                <Botao type="submit">Enviar</Botao>
              </form>
            </Cartao>
          ) : null}
          <Cartao>
            <TituloCartao descricao="Despesas lançadas do mês. Não é balancete contábil.">{`Mês ${mes.split("-").reverse().join("/")}`}</TituloCartao>
            <p className="text-lg font-semibold">{formatarReais(grupo.total)}</p>
            <ul className="mt-2 space-y-1 text-sm">
              {grupo.porCategoria.map(([k, v]) => (
                <li key={k} className="flex justify-between gap-2">
                  <span>{ROTULO_CATEGORIA_DESPESA[k] ?? k}</span>
                  <span>{formatarReais(v)}</span>
                </li>
              ))}
            </ul>
          </Cartao>
        </div>
      </div>
    </>
  );
}
