import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { chamadoEventos, chamados, passosAutoajuda, pessoas, prestadorDocumentos, prestadores, unidades } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { arquivosDoChamado, ORDEM_URGENCIA, ROTULO_ESTADO, ROTULO_MOTIVO, ROTULO_URGENCIA } from "@/features/chamados/servico";
import { ROTULO_CATEGORIA } from "@/features/chamados/ia";
import { prestadoresDoCondominio, textoSituacaoDocs } from "@/features/prestadores/servico";
import { atribuirChamadoPainel, encerrarChamadoPainel, mudarUrgenciaPainel, resolverChamadoPainel, virarManutencao } from "@/features/chamados/acoes";
import { dataHora } from "@/lib/formato";
import { AreaTexto, Botao, CabecalhoPagina, Campo, Cartao, Rotulo, Selecao, Selo, TituloCartao } from "@/components/ui";
import { Mensagens, Ocultos, SeloExemplo } from "@/components/negocio";

export const metadata: Metadata = { title: "Chamado" };

export default async function DetalheChamado({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[]>> }) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [ch] = await db.select().from(chamados).where(eq(chamados.id, id)).limit(1);
  const { lista, usuario } = await contextoDaPagina(sp);
  const cond = ch ? lista.find((x) => x.id === ch.condominioId) : null;
  if (!ch || !cond || ch.organizacaoId !== usuario.organizacao.id) notFound();
  const gestao = cond.papel !== "conselho";
  const c = cond.id;
  const voltar = `/app/chamados/${ch.id}`;
  const [eventos, fotos, funcs, prests] = await Promise.all([
    db.select().from(chamadoEventos).where(eq(chamadoEventos.chamadoId, ch.id)).orderBy(asc(chamadoEventos.criadoEm)),
    arquivosDoChamado(ch),
    db.select().from(pessoas).where(and(eq(pessoas.condominioId, c), eq(pessoas.papel, "funcionario"), isNull(pessoas.removidaEm))),
    prestadoresDoCondominio(usuario.organizacao.id, c),
  ]);
  const [un] = ch.unidadeId ? await db.select().from(unidades).where(eq(unidades.id, ch.unidadeId)).limit(1) : [];
  const [passo] = ch.passoAutoajudaId ? await db.select().from(passosAutoajuda).where(eq(passosAutoajuda.id, ch.passoAutoajudaId)).limit(1) : [];
  const [prest] = ch.prestadorId ? await db.select().from(prestadores).where(eq(prestadores.id, ch.prestadorId)).limit(1) : [];
  const [resp] = ch.responsavelPessoaId ? await db.select().from(pessoas).where(eq(pessoas.id, ch.responsavelPessoaId)).limit(1) : [];
  void prestadorDocumentos;
  const aberto = ["novo", "com_responsavel", "aguardando_prestador", "agendado"].includes(ch.estado);
  return (
    <>
      <CabecalhoPagina titulo={`${ch.natureza === "ocorrencia" ? "Ocorrência" : "Chamado"} nº ${ch.numero}`} descricao={`${cond.nome}${un ? ` · unidade ${un.numero}` : " · área comum"}`} />
      <Mensagens sp={sp} />
      <div className="grid gap-6 xl:grid-cols-[1fr_400px]">
        <div className="space-y-6">
          <Cartao>
            <p className="text-base">{ch.descricao}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Selo tom={ch.urgencia === "emergencia" ? "vermelho" : ch.urgencia === "alta" ? "amarelo" : "cinza"}>{`Urgência ${ROTULO_URGENCIA[ch.urgencia].toLowerCase()}`}</Selo>
              <Selo>{ROTULO_CATEGORIA[ch.categoria] ?? ch.categoria}</Selo>
              {ch.categoriaOrigem === "ia" ? <Selo tom="amarelo">categoria sugerida pela IA</Selo> : null}
              <Selo tom="azul">{ch.natureza === "ocorrencia" ? "registrada" : ROTULO_ESTADO[ch.estado]}</Selo>
              {ch.motivoEncerramento ? <Selo tom="verde">{ROTULO_MOTIVO[ch.motivoEncerramento]}</Selo> : null}
              {ch.reaberturas ? <Selo tom="vermelho">{`${ch.reaberturas} reabertura(s)`}</Selo> : null}
              <SeloExemplo exemplo={ch.exemplo} />
            </div>
            <p className="mt-2 text-xs text-suave">Motivo da urgência: {ch.urgenciaMotivo ?? "—"}</p>
            <p className="mt-1 text-xs text-suave">
              Responsável: {resp?.nome ?? prest?.razaoSocial ?? "nenhum"}
              {ch.agendadoPara ? ` · agendado para ${dataHora(ch.agendadoPara)}` : ""}
            </p>
            {passo ? <p className="mt-2 text-sm text-suave">Autoajuda oferecida (biblioteca aprovada): {passo.titulo}</p> : null}
          </Cartao>
          <Cartao>
            <TituloCartao descricao="Só inserção: cada mudança é um evento novo.">Linha do tempo</TituloCartao>
            <ol className="space-y-3 text-sm">
              {eventos.map((e) => (
                <li key={e.id} className="border-l-2 border-borda pl-3">
                  <p className="text-xs text-suave">
                    {dataHora(e.criadoEm)} · {e.autorRotulo} · {e.tipo.replace(/_/g, " ")}
                  </p>
                  {e.texto ? <p className="whitespace-pre-line">{e.texto}</p> : null}
                </li>
              ))}
            </ol>
          </Cartao>
          {fotos.length ? (
            <Cartao>
              <TituloCartao>Fotos e arquivos</TituloCartao>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                {fotos.map((f) => (
                  <a key={f} href={`/api/arquivos/${f}`} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-borda">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={`/api/arquivos/${f}`} alt="Foto do chamado" className="h-32 w-full object-cover" />
                  </a>
                ))}
              </div>
            </Cartao>
          ) : null}
        </div>
        {gestao ? (
          <div className="space-y-6">
            {ch.natureza === "ocorrencia" ? (
              <Cartao>
                <TituloCartao>Ocorrência</TituloCartao>
                <form action={virarManutencao}>
                  <Ocultos c={c} voltar={voltar} extra={{ chamadoId: ch.id }} />
                  <Botao type="submit" variante="secundario">
                    Virar chamado de manutenção
                  </Botao>
                </form>
              </Cartao>
            ) : null}
            {aberto && ch.natureza === "manutencao" ? (
              <Cartao>
                <TituloCartao descricao="Prestador com documento vencido pede justificativa.">Responsável e agenda</TituloCartao>
                <form action={atribuirChamadoPainel} className="space-y-3">
                  <Ocultos c={c} voltar={voltar} extra={{ chamadoId: ch.id }} />
                  <Selecao name="alvo" required defaultValue="">
                    <option value="" disabled>
                      Escolha
                    </option>
                    <optgroup label="Funcionários">
                      {funcs.map((f) => (
                        <option key={f.id} value={`p:${f.id}`}>
                          {f.nome} ({f.funcao ?? "funcionário"})
                        </option>
                      ))}
                    </optgroup>
                    <optgroup label="Prestadores">
                      {prests.map((p) => (
                        <option key={p.id} value={`x:${p.id}`}>
                          {p.razaoSocial} · {p.situacao.emDia ? "documentos em dia" : textoSituacaoDocs(p.situacao)}
                        </option>
                      ))}
                    </optgroup>
                  </Selecao>
                  <div className="grid grid-cols-2 gap-2">
                    <Campo name="data" placeholder="Data (dd/mm/aaaa)" />
                    <Campo name="hora" placeholder="Hora (08:00)" />
                  </div>
                  <Campo name="justificativa" placeholder="Justificativa (se o prestador tiver documento vencido)" />
                  <Botao type="submit" variante="secundario">
                    Definir responsável
                  </Botao>
                </form>
              </Cartao>
            ) : null}
            {aberto && ch.natureza === "manutencao" ? (
              <Cartao>
                <TituloCartao descricao="Foto do serviço obrigatória. Com morador vinculado, ele confirma pelo Telegram.">Marcar como resolvido</TituloCartao>
                <form action={resolverChamadoPainel} className="space-y-3">
                  <Ocultos c={c} voltar={voltar} extra={{ chamadoId: ch.id }} />
                  <input type="file" name="foto" accept="image/*" required className="block w-full text-sm" />
                  <Campo name="texto" placeholder="Observação (opcional)" />
                  <Botao type="submit">Resolvido, com foto</Botao>
                </form>
              </Cartao>
            ) : null}
            {ch.estado === "resolvido" ? (
              <Cartao>
                <TituloCartao descricao="Sem morador vinculado para confirmar.">Encerrar</TituloCartao>
                <form action={encerrarChamadoPainel} className="space-y-3">
                  <Ocultos c={c} voltar={voltar} extra={{ chamadoId: ch.id }} />
                  <Campo name="motivo" placeholder="Motivo (ex.: conferi no local)" required />
                  <Botao type="submit" variante="secundario">
                    Encerrar pelo síndico
                  </Botao>
                </form>
              </Cartao>
            ) : null}
            {ch.estado !== "encerrado" ? (
              <Cartao>
                <TituloCartao descricao="Sempre com motivo (fica no histórico).">Mudar urgência</TituloCartao>
                <form action={mudarUrgenciaPainel} className="space-y-3">
                  <Ocultos c={c} voltar={voltar} extra={{ chamadoId: ch.id }} />
                  <Selecao name="urgencia" defaultValue={ch.urgencia}>
                    {ORDEM_URGENCIA.map((u) => (
                      <option key={u} value={u}>
                        {ROTULO_URGENCIA[u]}
                      </option>
                    ))}
                  </Selecao>
                  <Rotulo htmlFor="motivo-urg">Motivo</Rotulo>
                  <AreaTexto id="motivo-urg" name="motivo" rows={2} required />
                  <Botao type="submit" variante="secundario">
                    Mudar urgência
                  </Botao>
                </form>
              </Cartao>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}
