import type { Metadata } from "next";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pessoas, rotinaModelos } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { gerarItensDoDia, itensDoPeriodo, ROTULO_PERIODO } from "@/features/rotinas/servico";
import { CamposPeriodicidade } from "@/features/rotinas/campos-periodicidade";
import { descreverPeriodicidade } from "@/features/rotinas/periodicidade";
import { alternarModeloRotina, criarModeloRotina } from "@/features/rotinas/acoes";
import { dataBR, hojeISO, horaMinutoBR, somarDias } from "@/lib/negocio/datas";
import { fraseTarefaNaoJornada } from "@/lib/negocio/linguagem";
import { BRAND } from "@/lib/brand";
import { Aviso, Botao, CabecalhoPagina, Campo, Cartao, Rotulo, Selecao, Selo, TituloCartao, classesBotao } from "@/components/ui";
import { Mensagens, Ocultos, SemCondominio, Tabela, Td } from "@/components/negocio";

export const metadata: Metadata = { title: "Rotinas" };

export default async function Rotinas({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, usuario, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  if (!gestao) return <Aviso tom="amarelo">Rotinas ficam com o síndico.</Aviso>;
  const c = condominio.id;
  const hoje = hojeISO();
  await gerarItensDoDia(usuario.organizacao.id, c, hoje);
  const [modelos, funcs, periodo] = await Promise.all([
    db.select().from(rotinaModelos).where(and(eq(rotinaModelos.organizacaoId, usuario.organizacao.id), eq(rotinaModelos.condominioId, c))).orderBy(asc(rotinaModelos.periodoRotulo), asc(rotinaModelos.item)),
    db.select().from(pessoas).where(and(eq(pessoas.organizacaoId, usuario.organizacao.id), eq(pessoas.condominioId, c), eq(pessoas.papel, "funcionario"), isNull(pessoas.removidaEm))),
    itensDoPeriodo(usuario.organizacao.id, c, somarDias(hoje, -30), hoje),
  ]);
  const nomeDe = new Map(funcs.map((f) => [f.id, f.nome]));
  const postos = [...new Set(funcs.map((f) => f.posto).filter(Boolean))] as string[];
  const deHoje = periodo.filter((x) => x.item.data === hoje);
  const hist = periodo.filter((x) => x.item.data < hoje);
  const porModelo = modelos.map((m) => {
    const l = hist.filter((x) => x.item.modeloId === m.id);
    return { m, previstos: l.length, feitos: l.filter((x) => x.item.estado === "feito").length };
  });
  const porPessoa = funcs.map((f) => {
    const l = hist.filter((x) => x.item.marcadoPorPessoaId === f.id);
    return { f, feitos: l.filter((x) => x.item.estado === "feito").length, naoDeu: l.filter((x) => x.item.estado === "nao_feito").length };
  });
  const itemDetalhe = typeof sp.item === "string" ? periodo.find((x) => x.item.id === sp.item) : null;
  return (
    <>
      <CabecalhoPagina titulo="Rotinas dos funcionários" descricao="Tarefas feitas, com foto quando pedida. Sem aprovação do síndico." acao={<a className={classesBotao("secundario", "sm")} href={`/api/rotinas/csv?c=${c}`}>Exportar CSV (30 dias)</a>} />
      <Mensagens sp={sp} />
      <div className="mb-6">
        <Aviso tom="azul">{fraseTarefaNaoJornada(BRAND.nome)} Envio ao funcionário só dentro da janela do condomínio ({condominio.janelaInicio}h às {condominio.janelaFim}h).</Aviso>
      </div>
      {itemDetalhe ? (
        <Cartao className="mb-6">
          <TituloCartao>Detalhe do item</TituloCartao>
          <p className="text-sm">
            {itemDetalhe.modelo.item} · {dataBR(itemDetalhe.item.data)} · {itemDetalhe.item.estado === "feito" ? "feito" : itemDetalhe.item.estado === "nao_feito" ? `não deu (${itemDetalhe.item.motivo ?? ""})` : "previsto"}
          </p>
          {itemDetalhe.item.fotoRecebidaEm ? <p className="mt-1 text-sm text-suave">Foto recebida às {horaMinutoBR(itemDetalhe.item.fotoRecebidaEm)}</p> : null}
          {itemDetalhe.item.arquivoId ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={`/api/arquivos/${itemDetalhe.item.arquivoId}`} alt="Foto da tarefa" className="mt-3 h-48 rounded-lg border border-borda object-cover" />
          ) : null}
        </Cartao>
      ) : null}
      <div className="grid gap-6 2xl:grid-cols-2">
        <Cartao>
          <TituloCartao descricao="Por item: feito, não deu ou previsto.">{`Hoje (${dataBR(hoje)})`}</TituloCartao>
          <Tabela cabecalho={["Item", "Período", "De quem", "Estado"]} vazio={deHoje.length === 0}>
            {deHoje.map(({ item, modelo }) => (
              <tr key={item.id}>
                <Td>
                  <a className="hover:underline" href={`/app/rotinas?c=${c}&item=${item.id}`}>
                    {modelo.item}
                  </a>
                  {modelo.fotoObrigatoria ? " (foto)" : ""}
                </Td>
                <Td>{ROTULO_PERIODO[modelo.periodoRotulo]}</Td>
                <Td>{item.posto ? `posto ${item.posto}` : (nomeDe.get(item.pessoaId ?? "") ?? "—")}</Td>
                <Td>
                  <Selo tom={item.estado === "feito" ? "verde" : item.estado === "nao_feito" ? "vermelho" : "cinza"}>{item.estado === "feito" ? "feito" : item.estado === "nao_feito" ? "não deu" : "previsto"}</Selo>
                </Td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="Últimos 30 dias, por item (sem horário).">Histórico por item</TituloCartao>
          <Tabela cabecalho={["Item", "Feitos", "Previstos", "Ativo", ""]}>
            {porModelo.map(({ m, feitos, previstos }) => (
              <tr key={m.id}>
                <Td>
                  {m.item}
                  <span className="block text-xs text-suave">
                    {descreverPeriodicidade(m)} · {ROTULO_PERIODO[m.periodoRotulo]}
                    {m.horaLimite ? ` · até ${m.horaLimite}` : ""} · {m.rotinaDoPosto ? `rotina do posto ${m.posto}` : (nomeDe.get(m.pessoaId ?? "") ?? "—")}
                  </span>
                </Td>
                <Td>{feitos}</Td>
                <Td>{previstos}</Td>
                <Td>{m.ativo ? "sim" : "não"}</Td>
                <Td>
                  <form action={alternarModeloRotina}>
                    <Ocultos c={c} voltar="/app/rotinas" extra={{ modeloId: m.id }} />
                    <button className="text-xs underline" type="submit">
                      {m.ativo ? "Desativar" : "Ativar"}
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="Só contagem de itens, sem horário nem ranking.">Por pessoa (30 dias)</TituloCartao>
          <Tabela cabecalho={["Pessoa", "Itens feitos", "Itens não deu"]}>
            {porPessoa.map(({ f, feitos, naoDeu }) => (
              <tr key={f.id}>
                <Td>
                  {f.nome}
                  {f.empregador === "contratada" ? <span className="block text-xs text-suave">contratada: {f.empresaContratada}</span> : null}
                </Td>
                <Td>{feitos}</Td>
                <Td>{naoDeu}</Td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="Contratada: a rotina é do posto, combinada com a empresa.">Novo item de rotina</TituloCartao>
          <form action={criarModeloRotina} className="grid gap-3 md:grid-cols-2">
            <Ocultos c={c} voltar="/app/rotinas" />
            <div className="md:col-span-2">
              <Rotulo htmlFor="item">Item</Rotulo>
              <Campo id="item" name="item" required placeholder="Ex.: Conferir nível da caixa d'água e boia" />
            </div>
            <div className="md:col-span-2">
              <Rotulo htmlFor="instrucao">Instrução (opcional)</Rotulo>
              <Campo id="instrucao" name="instrucao" />
            </div>
            <div>
              <Rotulo htmlFor="dono">De quem</Rotulo>
              <Selecao id="dono" name="dono" required defaultValue="">
                <option value="" disabled>
                  Escolha
                </option>
                {funcs
                  .filter((f) => f.empregador !== "contratada")
                  .map((f) => (
                    <option key={f.id} value={`p:${f.id}`}>
                      {f.nome}
                    </option>
                  ))}
                {postos.map((p) => (
                  <option key={p} value={`posto:${p}`}>
                    Posto: {p}
                  </option>
                ))}
              </Selecao>
            </div>
            <CamposPeriodicidade />
            <div>
              <Rotulo htmlFor="periodo">Período (rótulo)</Rotulo>
              <Selecao id="periodo" name="periodo" defaultValue="manha">
                <option value="manha">Manhã</option>
                <option value="tarde">Tarde</option>
                <option value="noite">Noite</option>
              </Selecao>
            </div>
            <div>
              <Rotulo htmlFor="horaLimite">Hora-limite do item (opcional)</Rotulo>
              <Campo id="horaLimite" name="horaLimite" placeholder="10:00" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="foto" /> Foto obrigatória
            </label>
            <div className="md:col-span-2">
              <Botao type="submit">Criar item</Botao>
            </div>
          </form>
        </Cartao>
      </div>
    </>
  );
}
