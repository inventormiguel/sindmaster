import type { Metadata } from "next";
import Link from "next/link";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pessoas, unidades } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { Aviso, Botao, CabecalhoPagina, Campo, Cartao, TituloCartao } from "@/components/ui";
import { Mensagens, SemCondominio, Tabela, Td } from "@/components/negocio";
import { compararUnidades } from "@/features/condominios/unidades";

export const metadata: Metadata = { title: "Unidades e moradores" };

export default async function Unidades({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  if (!gestao) return <Aviso tom="amarelo">Cadastro de moradores fica com o síndico.</Aviso>;
  const c = condominio.id;
  const [us, mor] = await Promise.all([
    db.select().from(unidades).where(eq(unidades.condominioId, c)).orderBy(asc(unidades.andar), asc(unidades.numero)),
    db.select().from(pessoas).where(and(eq(pessoas.condominioId, c), eq(pessoas.papel, "morador"), isNull(pessoas.saiuEm), isNull(pessoas.removidaEm))),
  ]);
  us.sort(compararUnidades);
  const temAndar = us.some((u) => u.andar !== null);
  const semVinculo = us.filter((u) => !mor.some((m) => m.unidadeId === u.id && m.telegramChatId)).length;
  return (
    <>
      <CabecalhoPagina titulo="Unidades e moradores" descricao="Cada unidade pode ter várias pessoas (proprietário, inquilino, dependente), cada uma com o seu vínculo no Telegram. Identidade pelo Telegram, sem e-mail nem senha." />
      <Mensagens sp={sp} />
      <Cartao className="mb-6">
        <TituloCartao descricao={`Gera um QR de uso único para cada unidade sem morador vinculado (${semVinculo}), numa página para imprimir (6 por folha). Os códigos só aparecem nessa página; gerar de novo revoga os anteriores.`}>Convites das unidades</TituloCartao>
        <form action="/app/unidades/convites/imprimir" method="post" target="_blank" className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="c" value={c} />
          <div>
            <label htmlFor="dias" className="mb-1 block text-sm font-medium">
              Validade (1 a 30 dias)
            </label>
            <Campo id="dias" name="dias" type="number" min={1} max={30} defaultValue={30} className="w-28" />
          </div>
          <Botao type="submit">Gerar e abrir a página para imprimir</Botao>
        </form>
      </Cartao>
      <Cartao>
        <TituloCartao>{us.length} unidade(s) cadastrada(s)</TituloCartao>
        <Tabela cabecalho={["Unidade", ...(temAndar ? ["Andar"] : []), "Pessoas", "No Telegram", ""]}>
          {us.map((u) => {
            const m = mor.filter((x) => x.unidadeId === u.id);
            return (
              <tr key={u.id}>
                <Td>
                  {u.bloco ? `${u.bloco}-` : ""}
                  {u.numero}
                </Td>
                {temAndar ? <Td>{u.andar ?? "—"}</Td> : null}
                <Td>{m.length ? m.map((x) => x.nome).join(", ") : <span className="text-suave">sem morador cadastrado</span>}</Td>
                <Td>{m.filter((x) => x.telegramChatId).length}</Td>
                <Td>
                  <Link href={`/app/unidades/${u.id}?c=${c}`} className="text-sm underline">
                    Abrir
                  </Link>
                </Td>
              </tr>
            );
          })}
        </Tabela>
      </Cartao>
    </>
  );
}
