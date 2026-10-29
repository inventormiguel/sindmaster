import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { chamados, unidades } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { ROTULO_ESTADO, ROTULO_MOTIVO, ROTULO_URGENCIA } from "@/features/chamados/servico";
import { CATEGORIAS_CHAMADO, ROTULO_CATEGORIA } from "@/features/chamados/ia";
import { abrirChamadoPainel } from "@/features/chamados/acoes";
import { dataHora } from "@/lib/formato";
import { AreaTexto, Botao, CabecalhoPagina, Cartao, Rotulo, Selecao, Selo, TituloCartao } from "@/components/ui";
import { Abas, Mensagens, Ocultos, SemCondominio, SeloExemplo, Tabela, Td } from "@/components/negocio";

export const metadata: Metadata = { title: "Chamados" };

const FILTROS: Record<string, string[] | null> = {
  abertos: ["novo", "com_responsavel", "aguardando_prestador", "agendado"],
  aguardando_confirmacao: ["aguardando_confirmacao", "resolvido"],
  encerrados: ["encerrado"],
  todos: null,
};

export default async function PaginaChamados({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  const c = condominio.id;
  const natureza = sp.aba === "ocorrencias" ? "ocorrencia" : "manutencao";
  const filtro = typeof sp.estado === "string" && sp.estado in FILTROS ? sp.estado : "todos";
  const estados = FILTROS[filtro];
  const lista = await db
    .select()
    .from(chamados)
    .where(and(eq(chamados.condominioId, c), eq(chamados.natureza, natureza), estados ? inArray(chamados.estado, estados as never[]) : undefined))
    .orderBy(desc(chamados.abertoEm))
    .limit(200);
  const us = await db.select().from(unidades).where(eq(unidades.condominioId, c)).orderBy(asc(unidades.andar), asc(unidades.numero));
  const numeroUnidade = new Map(us.map((u) => [u.id, u.numero]));
  const base = `/app/chamados?c=${c}${natureza === "ocorrencia" ? "&aba=ocorrencias" : ""}`;
  const voltar = `/app/chamados${natureza === "ocorrencia" ? "?aba=ocorrencias" : ""}`;
  return (
    <>
      <CabecalhoPagina titulo="Chamados" descricao="Abertos pelo Telegram (morador, portaria pela unidade, funcionário) ou pelo painel. Nada se apaga: cada mudança é um evento." />
      <Mensagens sp={sp} />
      <Abas
        itens={[
          { href: `/app/chamados?c=${c}`, rotulo: "Manutenção", ativo: natureza === "manutencao" },
          { href: `/app/chamados?c=${c}&aba=ocorrencias`, rotulo: "Ocorrências", ativo: natureza === "ocorrencia" },
        ]}
      />
      <div className="grid gap-6 2xl:grid-cols-[1fr_380px]">
        <Cartao>
          <TituloCartao
            acao={
              <div className="flex flex-wrap gap-2">
                {Object.keys(FILTROS).map((f) => (
                  <Link key={f} href={`${base}&estado=${f}`} className={`rounded px-2 py-1 text-xs ${filtro === f ? "bg-primaria text-white" : "bg-fundo"}`}>
                    {f === "abertos" ? "Abertos" : f === "aguardando_confirmacao" ? "Resolvidos" : f === "encerrados" ? "Encerrados" : "Todos"}
                  </Link>
                ))}
              </div>
            }
          >
            {natureza === "ocorrencia" ? "Livro de ocorrências" : "Lista"}
          </TituloCartao>
          <Tabela cabecalho={["Nº", "Descrição", "Unidade", "Categoria", "Urgência", "Estado", "Aberto em"]} vazio={lista.length === 0}>
            {lista.map((ch) => (
              <tr key={ch.id}>
                <Td>{ch.numero}</Td>
                <Td className="max-w-xs">
                  <Link href={`/app/chamados/${ch.id}?c=${c}`} className="hover:underline">
                    {ch.descricao.slice(0, 80)}
                  </Link>{" "}
                  <SeloExemplo exemplo={ch.exemplo} />
                </Td>
                <Td>{ch.unidadeId ? numeroUnidade.get(ch.unidadeId) : "—"}</Td>
                <Td>{ROTULO_CATEGORIA[ch.categoria] ?? ch.categoria}</Td>
                <Td>
                  <Selo tom={ch.urgencia === "emergencia" ? "vermelho" : ch.urgencia === "alta" ? "amarelo" : "cinza"}>{ROTULO_URGENCIA[ch.urgencia]}</Selo>
                </Td>
                <Td>
                  {natureza === "ocorrencia" ? "registrada" : ROTULO_ESTADO[ch.estado]}
                  {ch.motivoEncerramento && natureza !== "ocorrencia" ? <span className="block text-xs text-suave">{ROTULO_MOTIVO[ch.motivoEncerramento]}</span> : null}
                </Td>
                <Td className="whitespace-nowrap">{dataHora(ch.abertoEm)}</Td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
        {gestao ? (
          <Cartao>
            <TituloCartao descricao="Sem categoria escolhida, a IA sugere (se conectada). Palavras de emergência avisam na hora.">{natureza === "ocorrencia" ? "Registrar ocorrência" : "Abrir chamado"}</TituloCartao>
            <form action={abrirChamadoPainel} className="space-y-3">
              <Ocultos c={c} voltar={voltar} extra={{ natureza }} />
              <div>
                <Rotulo htmlFor="descricao">Descrição</Rotulo>
                <AreaTexto id="descricao" name="descricao" rows={3} required />
              </div>
              <div>
                <Rotulo htmlFor="unidadeId">Unidade (opcional)</Rotulo>
                <Selecao id="unidadeId" name="unidadeId" defaultValue="">
                  <option value="">Área comum</option>
                  {us.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.bloco ? `${u.bloco}-` : ""}
                      {u.numero}
                    </option>
                  ))}
                </Selecao>
              </div>
              <div>
                <Rotulo htmlFor="categoria">Categoria</Rotulo>
                <Selecao id="categoria" name="categoria" defaultValue="">
                  <option value="">Deixar a IA sugerir (ou &ldquo;outra&rdquo; sem IA)</option>
                  {CATEGORIAS_CHAMADO.map((k) => (
                    <option key={k} value={k}>
                      {ROTULO_CATEGORIA[k]}
                    </option>
                  ))}
                </Selecao>
              </div>
              <Botao type="submit">{natureza === "ocorrencia" ? "Registrar" : "Abrir chamado"}</Botao>
            </form>
          </Cartao>
        ) : null}
      </div>
    </>
  );
}
