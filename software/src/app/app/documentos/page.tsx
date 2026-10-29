import type { Metadata } from "next";
import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { documentos, trechos } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { ROTULO_TIPO_DOC } from "@/features/documentos/servico";
import { alternarChaveDocumento, enviarDocumentoAcao } from "@/features/documentos/acoes";
import { UploadDocumento } from "@/features/documentos/upload-documento";
import { Aviso, CabecalhoPagina, Cartao, Selo, TituloCartao, classesBotao } from "@/components/ui";
import { Mensagens, Ocultos, SemCondominio, Tabela, Td } from "@/components/negocio";

export const metadata: Metadata = { title: "Documentos" };

export default async function Documentos({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  if (!gestao) return <Aviso tom="amarelo">Documentos ficam com o síndico.</Aviso>;
  const c = condominio.id;
  const lista = await db
    .select({ d: documentos, n: sql<number>`(select count(*)::int from ${trechos} where ${trechos.documentoId} = "documentos"."id")`, revisar: sql<number>`(select count(*)::int from ${trechos} where ${trechos.documentoId} = "documentos"."id" and ${trechos.revisarDadoPessoal})` })
    .from(documentos)
    .where(eq(documentos.condominioId, c))
    .orderBy(desc(documentos.criadoEm));
  return (
    <>
      <CabecalhoPagina
        titulo="Documentos do condomínio"
        descricao="Base das respostas aos moradores: o código divide por artigo e a IA só cita o texto literal. Publicado, vale na hora (sem aprovação)."
        acao={<Link href={`/app/diagnostico?c=${c}`} className={classesBotao("secundario", "sm")}>Diagnóstico em 5 minutos</Link>}
      />
      <Mensagens sp={sp} />
      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Cartao>
          <Tabela cabecalho={["Documento", "Trechos", "Visível aos moradores", "Usar nas respostas"]} vazio={lista.length === 0}>
            {lista.map(({ d, n, revisar }) => (
              <tr key={d.id}>
                <Td>
                  <Link href={`/app/documentos/${d.id}?c=${c}`} className="font-medium hover:underline">
                    {d.titulo}
                  </Link>
                  <span className="block text-xs text-suave">
                    {ROTULO_TIPO_DOC[d.tipo]} · {d.divisaoConferidaPorNome ? `divisão conferida por ${d.divisaoConferidaPorNome}` : "divisão não conferida"}
                  </span>
                </Td>
                <Td>
                  {n} {revisar ? <Selo tom="amarelo">{`${revisar} para revisar`}</Selo> : null}
                </Td>
                {(["visivel", "respostas"] as const).map((k) => (
                  <Td key={k}>
                    <form action={alternarChaveDocumento}>
                      <Ocultos c={c} voltar="/app/documentos" extra={{ documentoId: d.id, chave: k }} />
                      <button type="submit" className="text-xs underline">
                        {(k === "visivel" ? d.visivelMoradores : d.usarNasRespostas) ? "Ligado (desligar)" : "Desligado (ligar)"}
                      </button>
                    </form>
                  </Td>
                ))}
              </tr>
            ))}
          </Tabela>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="O texto é extraído no seu navegador; o arquivo fica guardado no armazenamento.">Novo documento</TituloCartao>
          <UploadDocumento acao={enviarDocumentoAcao} c={c} />
        </Cartao>
      </div>
    </>
  );
}
