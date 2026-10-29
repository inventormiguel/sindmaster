import type { Metadata } from "next";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { palavrasEmergenciaExtra, passosAutoajuda, pessoas, regrasCategoria } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { CATEGORIAS_CHAMADO, ROTULO_CATEGORIA } from "@/features/chamados/ia";
import { ROTULO_URGENCIA } from "@/features/chamados/servico";
import { prestadoresDoCondominio } from "@/features/prestadores/servico";
import { alternarPasso, novaPalavraEmergencia, novoPassoAutoajuda, salvarConfiguracoes, salvarRegraCategoria } from "@/features/regras/acoes";
import { GRUPOS_EMERGENCIA } from "@/lib/negocio/linguagem";
import { formatarReais } from "@/lib/negocio/dinheiro";
import { Aviso, AreaTexto, Botao, CabecalhoPagina, Campo, Cartao, Rotulo, Selecao, Selo, TituloCartao } from "@/components/ui";
import { Mensagens, Ocultos, SemCondominio } from "@/components/negocio";

export const metadata: Metadata = { title: "Regras" };

export default async function Regras({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, usuario, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  if (!gestao) return <Aviso tom="amarelo">Regras ficam com o síndico.</Aviso>;
  const c = condominio.id;
  const [regras, passos, extras, funcs, prests] = await Promise.all([
    db.select().from(regrasCategoria).where(eq(regrasCategoria.condominioId, c)),
    db.select().from(passosAutoajuda).where(eq(passosAutoajuda.condominioId, c)).orderBy(asc(passosAutoajuda.categoria)),
    db.select().from(palavrasEmergenciaExtra).where(eq(palavrasEmergenciaExtra.condominioId, c)),
    db.select().from(pessoas).where(and(eq(pessoas.condominioId, c), eq(pessoas.papel, "funcionario"), isNull(pessoas.removidaEm))),
    prestadoresDoCondominio(usuario.organizacao.id, c),
  ]);
  const voltar = "/app/regras";
  return (
    <>
      <CabecalhoPagina titulo="Regras do condomínio" descricao="Urgência por categoria (a IA só sobe, nunca baixa), responsável padrão, autoajuda aprovada, emergência e configurações." />
      <Mensagens sp={sp} />
      <div className="grid gap-6 2xl:grid-cols-2">
        <Cartao>
          <TituloCartao descricao="O chamado vai direto ao responsável padrão; parado acima do prazo fica em vermelho.">Categorias</TituloCartao>
          <div className="space-y-2">
            {CATEGORIAS_CHAMADO.map((k) => {
              const r = regras.find((x) => x.categoria === k);
              return (
                <form key={k} action={salvarRegraCategoria} className="flex flex-wrap items-center gap-2 border-b border-borda pb-2 text-sm">
                  <Ocultos c={c} voltar={voltar} extra={{ categoria: k }} />
                  <span className="w-28 font-medium">{ROTULO_CATEGORIA[k]}</span>
                  <Selecao name="urgencia" defaultValue={r?.urgenciaPadrao ?? "media"} className="w-32">
                    {(["baixa", "media", "alta", "emergencia"] as const).map((u) => (
                      <option key={u} value={u}>
                        {ROTULO_URGENCIA[u]}
                      </option>
                    ))}
                  </Selecao>
                  <Campo name="prazo" type="number" defaultValue={r?.prazoHoras ?? 72} className="w-20" aria-label="Prazo em horas" />
                  <span className="text-xs text-suave">h</span>
                  <Selecao name="responsavel" defaultValue={r?.responsavelPessoaId ? `p:${r.responsavelPessoaId}` : r?.responsavelPrestadorId ? `x:${r.responsavelPrestadorId}` : ""} className="w-56">
                    <option value="">Sem responsável (síndico atribui)</option>
                    {funcs.map((f) => (
                      <option key={f.id} value={`p:${f.id}`}>
                        {f.nome}
                      </option>
                    ))}
                    {prests.map((p) => (
                      <option key={p.id} value={`x:${p.id}`}>
                        {p.razaoSocial}
                      </option>
                    ))}
                  </Selecao>
                  <label className="flex items-center gap-1 text-xs">
                    <input type="checkbox" name="ativa" defaultChecked={r?.ativa ?? true} /> ativa
                  </label>
                  <Botao type="submit" tamanho="sm" variante="secundario">
                    Salvar
                  </Botao>
                </form>
              );
            })}
          </div>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="A IA só oferece passos desta lista (nunca escreve instrução de reparo). Até 300 caracteres.">Biblioteca de autoajuda</TituloCartao>
          <ul className="mb-4 space-y-2 text-sm">
            {passos.map((p) => (
              <li key={p.id} className="flex flex-wrap items-start justify-between gap-2">
                <span className="min-w-0">
                  <span className="font-medium">{p.titulo}</span> ({ROTULO_CATEGORIA[p.categoria] ?? p.categoria}) {p.ativo ? null : <Selo>desativado</Selo>}
                  <span className="block text-xs text-suave">{p.texto} · aprovado por {p.aprovadoPorNome}</span>
                </span>
                <form action={alternarPasso}>
                  <Ocultos c={c} voltar={voltar} extra={{ passoId: p.id }} />
                  <button className="text-xs underline" type="submit">
                    {p.ativo ? "Desativar" : "Ativar"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
          <form action={novoPassoAutoajuda} className="space-y-2">
            <Ocultos c={c} voltar={voltar} />
            <div className="grid grid-cols-2 gap-2">
              <Selecao name="categoria" defaultValue="hidraulica">
                {CATEGORIAS_CHAMADO.map((k) => (
                  <option key={k} value={k}>
                    {ROTULO_CATEGORIA[k]}
                  </option>
                ))}
              </Selecao>
              <Campo name="titulo" placeholder="Título" />
            </div>
            <AreaTexto name="texto" rows={2} maxLength={300} placeholder="Passo seguro para um morador leigo" required />
            <Botao type="submit" tamanho="sm" variante="secundario">
              Aprovar passo
            </Botao>
          </form>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="Mensagem fixa (sem IA) enviada na hora a quem relatou; o 193 e o plantão são obrigatórios.">Emergência</TituloCartao>
          <form action={salvarConfiguracoes} className="space-y-3">
            <Ocultos c={c} voltar={voltar} />
            {Object.entries(GRUPOS_EMERGENCIA).map(([g, x]) => (
              <div key={g}>
                <Rotulo htmlFor={`msg_${g}`}>{`${x.rotulo}: ${x.palavras.slice(0, 4).join(", ")}…`}</Rotulo>
                <AreaTexto id={`msg_${g}`} name={`msg_${g}`} rows={2} defaultValue={condominio.mensagensSeguranca?.[g] ?? x.mensagem} />
              </div>
            ))}
            <div className="grid gap-2 md:grid-cols-2">
              <Campo name="contatoNome" defaultValue={condominio.contatoEmergenciaNome ?? ""} placeholder="Contato de plantão (nome)" />
              <Campo name="contatoTelefone" defaultValue={condominio.contatoEmergenciaTelefone ?? ""} placeholder="Telefone do plantão" />
            </div>
            <TituloCartao>Configurações</TituloCartao>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Rotulo htmlFor="janelaInicio">Janela de envio aos funcionários (sem horário por pessoa)</Rotulo>
                <div className="flex items-center gap-2">
                  <Campo id="janelaInicio" name="janelaInicio" type="number" min={0} max={23} defaultValue={condominio.janelaInicio} className="w-20" />
                  <span>às</span>
                  <Campo name="janelaFim" type="number" min={1} max={24} defaultValue={condominio.janelaFim} className="w-20" aria-label="Fim da janela" />
                </div>
              </div>
              <div>
                <Rotulo htmlFor="modo">Respostas da IA aos moradores</Rotulo>
                <Selecao id="modo" name="modo" defaultValue={condominio.modoRespostaDuvida}>
                  <option value="conferencia">Conferência prévia (padrão)</option>
                  <option value="automatico_com_citacao">Enviar sozinha quando a citação passa na conferência</option>
                </Selecao>
              </div>
              <div>
                <Rotulo htmlFor="alcada">Alçada de despesa (vazio = sem alçada)</Rotulo>
                <Campo id="alcada" name="alcada" defaultValue={condominio.alcadaDespesaCentavos != null ? formatarReais(condominio.alcadaDespesaCentavos).replace("R$ ", "") : ""} placeholder="5.000,00" />
              </div>
              <div>
                <Rotulo htmlFor="horasConfirmacao">Horas para o morador confirmar o chamado</Rotulo>
                <Campo id="horasConfirmacao" name="horasConfirmacao" type="number" min={24} max={240} defaultValue={condominio.horasConfirmacaoChamado} />
              </div>
            </div>
            <Botao type="submit">Salvar emergência e configurações</Botao>
          </form>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="As palavras do sistema não podem ser removidas; você pode acrescentar.">Palavras de emergência extras</TituloCartao>
          <ul className="mb-3 space-y-1 text-sm">
            {extras.length === 0 ? <li className="text-suave">Nenhuma.</li> : null}
            {extras.map((e) => (
              <li key={e.id}>
                {GRUPOS_EMERGENCIA[e.grupo].rotulo}: &ldquo;{e.expressao}&rdquo;
              </li>
            ))}
          </ul>
          <form action={novaPalavraEmergencia} className="flex flex-wrap gap-2">
            <Ocultos c={c} voltar={voltar} />
            <Selecao name="grupo" defaultValue="fogo_gas" className="w-44">
              {Object.entries(GRUPOS_EMERGENCIA).map(([g, x]) => (
                <option key={g} value={g}>
                  {x.rotulo}
                </option>
              ))}
            </Selecao>
            <Campo name="expressao" placeholder="Expressão" className="max-w-xs" required />
            <Botao type="submit" tamanho="sm" variante="secundario">
              Acrescentar
            </Botao>
          </form>
        </Cartao>
      </div>
    </>
  );
}
