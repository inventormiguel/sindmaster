import type { Metadata } from "next";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pessoas } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { alternarPlantao, cadastrarFuncionario } from "@/features/equipe/acoes";
import { fraseTarefaNaoJornada } from "@/lib/negocio/linguagem";
import { BRAND } from "@/lib/brand";
import { Aviso, Botao, CabecalhoPagina, Campo, Cartao, Rotulo, Selecao, Selo, TituloCartao } from "@/components/ui";
import { Mensagens, Ocultos, SemCondominio, Tabela, Td } from "@/components/negocio";

export const metadata: Metadata = { title: "Equipe" };

export default async function Equipe({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  if (!gestao) return <Aviso tom="amarelo">A equipe fica com o síndico.</Aviso>;
  const c = condominio.id;
  const lista = await db.select().from(pessoas).where(and(eq(pessoas.condominioId, c), inArray(pessoas.papel, ["funcionario", "sindico"]), isNull(pessoas.removidaEm)));
  return (
    <>
      <CabecalhoPagina titulo="Equipe" descricao="Funcionários do condomínio e de empresas contratadas. Contratada: as rotinas são do posto, combinadas com a empresa." />
      <Mensagens sp={sp} />
      <div className="mb-6">
        <Aviso tom="azul">{fraseTarefaNaoJornada(BRAND.nome)}</Aviso>
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <Cartao>
          <Tabela cabecalho={["Nome", "Função", "Empregador", "Plantão", "Telegram", ""]}>
            {lista.map((p) => (
              <tr key={p.id}>
                <Td>
                  {p.nome}
                  {p.celularDoPosto ? <span className="block text-xs text-suave">celular do posto</span> : null}
                </Td>
                <Td>{p.papel === "sindico" ? "Síndico(a)" : (p.funcao ?? "—")}</Td>
                <Td>{p.empregador === "contratada" ? `${p.empresaContratada} (posto ${p.posto ?? "—"})` : p.papel === "sindico" ? "—" : "condomínio"}</Td>
                <Td>
                  <form action={alternarPlantao}>
                    <Ocultos c={c} voltar="/app/equipe" extra={{ pessoaId: p.id }} />
                    <button type="submit" className="text-xs underline">
                      {p.contatoPlantao ? "sim (tirar)" : "não (pôr)"}
                    </button>
                  </form>
                </Td>
                <Td>{p.telegramChatId ? <Selo tom="verde">vinculado</Selo> : <Selo>sem Telegram</Selo>}</Td>
                <Td>
                  <form action="/app/unidades/convites/imprimir" method="post" target="_blank">
                    <input type="hidden" name="c" value={c} />
                    <input type="hidden" name="pessoaId" value={p.id} />
                    <input type="hidden" name="dias" value="7" />
                    <button type="submit" className="text-xs underline">
                      {p.telegramChatId ? "Reemitir convite" : "Gerar convite"}
                    </button>
                  </form>
                </Td>
              </tr>
            ))}
          </Tabela>
        </Cartao>
        <Cartao>
          <TituloCartao>Novo funcionário</TituloCartao>
          <form action={cadastrarFuncionario} className="space-y-3">
            <Ocultos c={c} voltar="/app/equipe" />
            <div>
              <Rotulo htmlFor="nome">Nome</Rotulo>
              <Campo id="nome" name="nome" required />
            </div>
            <div>
              <Rotulo htmlFor="funcao">Função</Rotulo>
              <Campo id="funcao" name="funcao" placeholder="Zelador, limpeza, porteiro…" />
            </div>
            <div>
              <Rotulo htmlFor="empregador">Empregador</Rotulo>
              <Selecao id="empregador" name="empregador" defaultValue="condominio">
                <option value="condominio">Condomínio</option>
                <option value="contratada">Empresa contratada</option>
              </Selecao>
            </div>
            <Campo name="empresaContratada" placeholder="Empresa contratada (se for)" />
            <Campo name="posto" placeholder="Posto (ex.: Portaria diurna)" />
            <Campo name="telefone" placeholder="Telefone (opcional)" />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="plantao" /> Contato de plantão (combinado com o empregador)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="celularDoPosto" /> Vinculado no celular do posto
            </label>
            <Botao type="submit">Cadastrar</Botao>
          </form>
        </Cartao>
      </div>
    </>
  );
}
