import type { Metadata } from "next";
import Link from "next/link";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { prestadoresDoCondominio, textoSituacaoDocs } from "@/features/prestadores/servico";
import { cadastrarPrestador } from "@/features/prestadores/acoes";
import { Aviso, Botao, CabecalhoPagina, Campo, Cartao, Rotulo, Selo, TituloCartao } from "@/components/ui";
import { Mensagens, Ocultos, SemCondominio, Tabela, Td } from "@/components/negocio";

export const metadata: Metadata = { title: "Prestadores" };

export default async function Prestadores({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, usuario, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  if (!gestao) return <Aviso tom="amarelo">Prestadores ficam com o síndico.</Aviso>;
  const c = condominio.id;
  const lista = await prestadoresDoCondominio(usuario.organizacao.id, c);
  return (
    <>
      <CabecalhoPagina titulo="Prestadores" descricao="Documentos vigiados (conferidos por você), dados de pagamento cifrados e alerta quando mudam." />
      <Mensagens sp={sp} />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Cartao>
          <Tabela cabecalho={["Prestador", "CNPJ", "Categorias", "Documentos"]}>
            {lista.map((p) => (
              <tr key={p.id}>
                <Td>
                  <Link className="font-medium hover:underline" href={`/app/prestadores/${p.id}?c=${c}`}>
                    {p.razaoSocial}
                  </Link>
                </Td>
                <Td className="whitespace-nowrap">{p.cnpj ?? "—"}</Td>
                <Td>{p.categorias.join(", ")}</Td>
                <Td>
                  <Selo tom={p.situacao.emDia ? (p.situacao.vencendo.length ? "amarelo" : "verde") : "vermelho"}>{p.situacao.emDia ? (p.situacao.vencendo.length ? `${p.situacao.vencendo.length} vencendo` : "documentos em dia") : `${p.situacao.vencidos.length} vencido(s)`}</Selo>
                  <span className="block text-xs text-suave">{textoSituacaoDocs(p.situacao)}</span>
                </Td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="Com o CNPJ, a BrasilAPI mostra a razão social e a situação cadastral.">Novo prestador</TituloCartao>
          <form action={cadastrarPrestador} className="space-y-3">
            <Ocultos c={c} voltar="/app/prestadores" />
            <div>
              <Rotulo htmlFor="cnpj">CNPJ</Rotulo>
              <Campo id="cnpj" name="cnpj" placeholder="00.000.000/0000-00" />
            </div>
            <div>
              <Rotulo htmlFor="razaoSocial">Razão social (se a BrasilAPI não achar)</Rotulo>
              <Campo id="razaoSocial" name="razaoSocial" />
            </div>
            <Campo name="categorias" placeholder="Categorias, separadas por vírgula" />
            <Campo name="contato" placeholder="Contato" />
            <Campo name="telefone" placeholder="Telefone (opcional)" />
            <Botao type="submit">Cadastrar</Botao>
          </form>
        </Cartao>
      </div>
    </>
  );
}
