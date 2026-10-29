import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { documentos, trechos } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { atualizarTextoAcao, conferirDivisaoAcao } from "@/features/documentos/acoes";
import { AreaTexto, Botao, CabecalhoPagina, Cartao, Selo, TituloCartao } from "@/components/ui";
import { Mensagens, Ocultos } from "@/components/negocio";

export const metadata: Metadata = { title: "Documento" };

export default async function Documento({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const { condominio, gestao } = await contextoDaPagina(sp);
  if (!condominio || !gestao) notFound();
  const [d] = await db.select().from(documentos).where(and(eq(documentos.id, id), eq(documentos.condominioId, condominio.id))).limit(1);
  if (!d) notFound();
  const ts = await db.select().from(trechos).where(eq(trechos.documentoId, d.id)).orderBy(asc(trechos.ordem));
  const c = condominio.id;
  const voltar = `/app/documentos/${d.id}`;
  return (
    <>
      <CabecalhoPagina
        titulo={d.titulo}
        descricao={d.divisaoConferidaPorNome ? `Divisão conferida por ${d.divisaoConferidaPorNome}` : "Divisão ainda não conferida"}
        acao={
          <form action={conferirDivisaoAcao}>
            <Ocultos c={c} voltar={voltar} extra={{ documentoId: d.id }} />
            <Botao type="submit" variante="secundario" tamanho="sm">
              Conferi a divisão
            </Botao>
          </form>
        }
      />
      <Mensagens sp={sp} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Cartao>
          <TituloCartao descricao="Trechos com unidade + débito/inadimplente/atraso/devedor ficam fora das respostas.">{`${ts.length} trecho(s)`}</TituloCartao>
          <ol className="space-y-3 text-sm">
            {ts.map((t) => (
              <li key={t.id} className="rounded-lg border border-borda p-3">
                <p className="font-medium">
                  {t.rotulo} {t.revisarDadoPessoal ? <Selo tom="amarelo">revisar: pode ter dado pessoal</Selo> : null}
                </p>
                <p className="mt-1 text-suave">{t.texto}</p>
              </li>
            ))}
          </ol>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="Corrigir o texto refaz a divisão por artigo.">Texto</TituloCartao>
          <form action={atualizarTextoAcao} className="space-y-2">
            <Ocultos c={c} voltar={voltar} extra={{ documentoId: d.id }} />
            <AreaTexto name="texto" defaultValue={d.texto ?? ""} rows={18} />
            <Botao type="submit" tamanho="sm" variante="secundario">
              Salvar e dividir de novo
            </Botao>
          </form>
        </Cartao>
      </div>
    </>
  );
}
