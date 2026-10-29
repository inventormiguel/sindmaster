import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { comunicados } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { estatisticas } from "@/features/comunicados/servico";
import { aprovarComunicadoAcao, rascunhoComunicadoAcao } from "@/features/comunicados/acoes";
import { iaDisponivel } from "@/lib/ia/funcoes";
import { dataHora } from "@/lib/formato";
import { Aviso, AreaTexto, Botao, CabecalhoPagina, Campo, Cartao, Rotulo, Selecao, Selo, TituloCartao, Vazio } from "@/components/ui";
import { Mensagens, Ocultos, SemCondominio, SeloExemplo } from "@/components/negocio";

export const metadata: Metadata = { title: "Comunicados" };

export default async function Comunicados({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  if (!gestao) return <Aviso tom="amarelo">Comunicados ficam com o síndico.</Aviso>;
  const c = condominio.id;
  const lista = await db.select().from(comunicados).where(eq(comunicados.condominioId, c)).orderBy(desc(comunicados.criadoEm));
  const stats = await Promise.all(lista.filter((x) => x.estado === "enviado").map(async (x) => [x.id, await estatisticas(x.id)] as const));
  const mapa = new Map(stats);
  const voltar = "/app/comunicados";
  return (
    <>
      <CabecalhoPagina titulo="Comunicados" descricao='Aprovação obrigatória: nada entra na fila antes. Cada morador recebe uma mensagem individual com o botão "Li o aviso".' />
      <Mensagens sp={sp} />
      <div className="grid gap-6 2xl:grid-cols-[420px_1fr]">
        <Cartao>
          <TituloCartao descricao="A IA usa só as datas e horas dos tópicos (conferido pelo código).">Novo comunicado</TituloCartao>
          <form action={rascunhoComunicadoAcao} className="space-y-3">
            <Ocultos c={c} voltar={voltar} />
            <div>
              <Rotulo htmlFor="topicos">Tópicos</Rotulo>
              <AreaTexto id="topicos" name="topicos" rows={4} required placeholder="falta de água dia 31/10 das 8h às 14h para limpeza da caixa; deixem registros fechados" />
            </div>
            <div>
              <Rotulo htmlFor="titulo">Título (se você escrever)</Rotulo>
              <Campo id="titulo" name="titulo" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <Selecao name="publico" defaultValue="moradores">
                <option value="moradores">Moradores</option>
                <option value="todos">Moradores e funcionários</option>
                <option value="bloco">Um bloco</option>
              </Selecao>
              <Campo name="bloco" placeholder="Bloco (se for um)" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="usarIa" defaultChecked={iaDisponivel()} disabled={!iaDisponivel()} /> Rascunho pela IA {iaDisponivel() ? "" : "(conecte sua chave de IA em Integrações)"}
            </label>
            <Botao type="submit">Criar rascunho</Botao>
          </form>
        </Cartao>
        <div className="space-y-4">
          {lista.length === 0 ? <Vazio>Nenhum comunicado ainda.</Vazio> : null}
          {lista.map((x) => {
            const s = mapa.get(x.id);
            return (
              <Cartao key={x.id}>
                <div className="flex flex-wrap items-center gap-2">
                  <Selo tom={x.estado === "enviado" ? "verde" : "amarelo"}>{x.estado === "enviado" ? `Enviado em ${dataHora(x.enviadoEm)}` : "Rascunho"}</Selo>
                  {x.origemTexto === "ia" ? <Selo tom="azul">texto da IA</Selo> : null}
                  <SeloExemplo exemplo={x.exemplo} />
                </div>
                {x.estado === "rascunho" ? (
                  <form action={aprovarComunicadoAcao} className="mt-3 space-y-2">
                    <Ocultos c={c} voltar={voltar} extra={{ comunicadoId: x.id }} />
                    <Campo name="titulo" defaultValue={x.titulo} />
                    <AreaTexto name="texto" defaultValue={x.texto} rows={5} />
                    <Botao type="submit" tamanho="sm">
                      Aprovar e enviar
                    </Botao>
                  </form>
                ) : (
                  <>
                    <h3 className="mt-2 font-semibold">{x.titulo}</h3>
                    <p className="mt-1 whitespace-pre-line text-sm">{x.texto}</p>
                    {s ? (
                      <p className="mt-2 text-sm text-suave">
                        {s.destinatarios} destinatário(s) · {s.entregues} entregue(s) · {s.lidos} leram ({s.entregues ? ((s.lidos / s.entregues) * 100).toFixed(1).replace(".", ",") : "0"}%) · {s.falhas} sem entrega (sem Telegram ou bot bloqueado) · {s.pendentes} na fila
                      </p>
                    ) : null}
                  </>
                )}
              </Cartao>
            );
          })}
        </div>
      </div>
    </>
  );
}
