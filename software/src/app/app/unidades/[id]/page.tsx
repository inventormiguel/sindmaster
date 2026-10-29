import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mudancas, pessoas, unidades } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { maisUmMoradorAcao, registrarEntradaAcao, registrarSaidaAcao, revogarVinculoAcao } from "@/features/unidades/acoes";
import { dataBR } from "@/lib/negocio/datas";
import { AreaTexto, Botao, CabecalhoPagina, Campo, Cartao, Selecao, Selo, TituloCartao } from "@/components/ui";
import { Mensagens, Ocultos, Tabela, Td } from "@/components/negocio";

export const metadata: Metadata = { title: "Unidade" };
const REL = { proprietario: "proprietário(a)", inquilino: "inquilino(a)", dependente: "dependente", outro: "outro" } as const;

export default async function Unidade({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { lista, usuario } = await contextoDaPagina(sp);
  const [u] = await db.select().from(unidades).where(eq(unidades.id, id)).limit(1);
  const cond = u ? lista.find((x) => x.id === u.condominioId && x.papel !== "conselho") : null;
  if (!u || !cond || u.organizacaoId !== usuario.organizacao.id) notFound();
  const c = cond.id;
  const [ps, ms] = await Promise.all([
    db.select().from(pessoas).where(and(eq(pessoas.unidadeId, u.id), eq(pessoas.condominioId, c))),
    db.select().from(mudancas).where(eq(mudancas.unidadeId, u.id)).orderBy(desc(mudancas.criadoEm)),
  ]);
  const atuais = ps.filter((p) => !p.saiuEm && !p.removidaEm);
  const voltar = `/app/unidades/${u.id}`;
  return (
    <>
      <CabecalhoPagina titulo={`Unidade ${u.bloco ? `${u.bloco}-` : ""}${u.numero}`} descricao={cond.nome} />
      <Mensagens sp={sp} />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Cartao>
            <TituloCartao descricao="Quem saiu fica só no histórico do síndico; quem entra não vê nada do anterior.">Pessoas da unidade</TituloCartao>
            <Tabela cabecalho={["Nome", "Relação", "Telegram", ""]} vazio={atuais.length === 0}>
              {atuais.map((p) => (
                <tr key={p.id}>
                  <Td>
                    {p.nome} {p.provisoria ? <Selo tom="amarelo">provisório</Selo> : null}
                  </Td>
                  <Td>{p.relacaoUnidade ? REL[p.relacaoUnidade] : "—"}</Td>
                  <Td>{p.telegramChatId ? <Selo tom="verde">vinculado</Selo> : <Selo>sem Telegram</Selo>}</Td>
                  <Td>
                    <div className="flex flex-wrap gap-2">
                      <form action="/app/unidades/convites/imprimir" method="post" target="_blank" className="flex items-center gap-1">
                        <input type="hidden" name="c" value={c} />
                        <input type="hidden" name="pessoaId" value={p.id} />
                        <input type="hidden" name="dias" value="30" />
                        <button type="submit" className="text-xs underline">
                          {p.telegramChatId ? "Reemitir convite" : "Gerar convite"}
                        </button>
                      </form>
                      {p.telegramChatId ? (
                        <form action={revogarVinculoAcao}>
                          <Ocultos c={c} voltar={voltar} extra={{ pessoaId: p.id }} />
                          <button type="submit" className="text-xs text-perigo underline">
                            Revogar
                          </button>
                        </form>
                      ) : null}
                    </div>
                  </Td>
                </tr>
              ))}
            </Tabela>
          </Cartao>
          <Cartao>
            <TituloCartao>Histórico de mudanças</TituloCartao>
            <ul className="space-y-1 text-sm">
              {ms.length === 0 ? <li className="text-suave">Nenhuma mudança registrada.</li> : null}
              {ms.map((m) => (
                <li key={m.id}>
                  {dataBR(m.data)} · {m.tipo === "saida" ? "saída" : "entrada"} de {m.pessoaIds.length} pessoa(s) · {m.estado === "pedida" ? <Selo tom="amarelo">pedida pelo morador no bot</Selo> : `registrada por ${m.registradaPorRotulo}`}
                </li>
              ))}
            </ul>
            {ps.some((p) => p.saiuEm) ? <p className="mt-2 text-xs text-suave">Ex-moradores: {ps.filter((p) => p.saiuEm).map((p) => `${p.nome} (saiu em ${dataBR(p.saiuEm)})`).join("; ")}</p> : null}
          </Cartao>
        </div>
        <div className="space-y-6">
          <Cartao>
            <TituloCartao>+1 morador</TituloCartao>
            <form action={maisUmMoradorAcao} className="space-y-2">
              <Ocultos c={c} voltar={voltar} extra={{ unidadeId: u.id }} />
              <Campo name="nome" placeholder="Nome (opcional: vem do Telegram ao vincular)" />
              <Selecao name="relacao" defaultValue="inquilino">
                <option value="proprietario">Proprietário(a)</option>
                <option value="inquilino">Inquilino(a)</option>
                <option value="dependente">Dependente</option>
                <option value="outro">Outro</option>
              </Selecao>
              <Botao type="submit" tamanho="sm" variante="secundario">
                Acrescentar
              </Botao>
            </form>
          </Cartao>
          <Cartao>
            <TituloCartao descricao="Desvincula, revoga os convites e para os avisos de quem sai.">Registrar mudança (saída)</TituloCartao>
            <form action={registrarSaidaAcao} className="space-y-2">
              <Ocultos c={c} voltar={voltar} extra={{ unidadeId: u.id }} />
              <Campo name="data" placeholder="Data da saída (dd/mm/aaaa)" />
              {atuais.map((p) => (
                <label key={p.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" name="pessoaId" value={p.id} defaultChecked /> {p.nome}
                </label>
              ))}
              <Botao type="submit" tamanho="sm" variante="perigo">
                Registrar saída
              </Botao>
            </form>
          </Cartao>
          <Cartao>
            <TituloCartao>Registrar entrada</TituloCartao>
            <form action={registrarEntradaAcao} className="space-y-2">
              <Ocultos c={c} voltar={voltar} extra={{ unidadeId: u.id }} />
              <AreaTexto name="nomes" rows={2} placeholder="Um nome por linha" required />
              <Selecao name="relacao" defaultValue="proprietario">
                <option value="proprietario">Proprietário(a)</option>
                <option value="inquilino">Inquilino(a)</option>
                <option value="dependente">Dependente</option>
                <option value="outro">Outro</option>
              </Selecao>
              <Botao type="submit" tamanho="sm" variante="secundario">
                Registrar entrada
              </Botao>
            </form>
          </Cartao>
        </div>
      </div>
    </>
  );
}
