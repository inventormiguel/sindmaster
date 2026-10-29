import type { Metadata } from "next";
import Link from "next/link";
import { asc, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { arquivos, condominios, envios, pessoas, telegramConvites, telegramMensagens } from "@/db/schema";
import { exigirUsuario, pode } from "@/lib/auth/sessao";
import { statusDoBot, ROTULO_PAPEL } from "@/lib/telegram";
import { dataHora } from "@/lib/formato";
import { Aviso, CabecalhoPagina, Cartao, Selo, TituloCartao, Vazio, classesBotao } from "@/components/ui";
import { BotaoAcao, FormularioAviso, FormularioPessoa, GerarConvite } from "@/features/telegram/componentes";
import { ativarWebhook, criarPessoaDemonstracao, desvincular, enviarFilaAgora, removerWebhook, revogar } from "@/features/telegram/acoes";

export const metadata: Metadata = { title: "Telegram" };

const ROTULO_STATUS_ENVIO = {
  pendente: { texto: "na fila", tom: "amarelo" },
  enviando: { texto: "enviando", tom: "azul" },
  enviado: { texto: "entregue ao Telegram", tom: "verde" },
  erro: { texto: "erro", tom: "vermelho" },
  nao_enviado: { texto: "não enviado", tom: "cinza" },
  cancelado: { texto: "cancelado", tom: "cinza" },
} as const;

const ROTULO_TIPO_MSG = { texto: "texto", comando: "comando", foto: "foto", documento: "documento", botao: "botão", outro: "outro" } as const;

export default async function PaginaTelegram() {
  const usuario = await exigirUsuario();
  const org = usuario.organizacao.id;
  const agora = new Date();

  const [status, listaCondominios, listaPessoas, convites, conversas, filaEnvios] = await Promise.all([
    statusDoBot(),
    db.select({ id: condominios.id, nome: condominios.nome }).from(condominios).where(eq(condominios.organizacaoId, org)).orderBy(asc(condominios.nome)),
    db
      .select({ p: pessoas, condominio: condominios.nome })
      .from(pessoas)
      .innerJoin(condominios, eq(condominios.id, pessoas.condominioId))
      .where(eq(pessoas.organizacaoId, org))
      .orderBy(asc(condominios.nome), asc(pessoas.nome)),
    db
      .select({ c: telegramConvites, pessoa: pessoas.nome })
      .from(telegramConvites)
      .innerJoin(pessoas, eq(pessoas.id, telegramConvites.pessoaId))
      .where(eq(telegramConvites.organizacaoId, org))
      .orderBy(desc(telegramConvites.criadoEm))
      .limit(20),
    db
      .select({ m: telegramMensagens, pessoa: pessoas.nome, arquivoNome: arquivos.nomeOriginal })
      .from(telegramMensagens)
      .leftJoin(pessoas, eq(pessoas.id, telegramMensagens.pessoaId))
      .leftJoin(arquivos, eq(arquivos.id, telegramMensagens.arquivoId))
      .where(eq(telegramMensagens.organizacaoId, org))
      .orderBy(desc(telegramMensagens.criadoEm))
      .limit(30),
    db
      .select({ e: envios, pessoa: pessoas.nome })
      .from(envios)
      .leftJoin(pessoas, eq(pessoas.id, envios.pessoaId))
      .where(eq(envios.organizacaoId, org))
      .orderBy(desc(envios.criadoEm))
      .limit(20),
  ]);

  const conectado = status.modo === "webhook" || status.modo === "polling";
  const semTelegram = conectado ? undefined : "Conecte o Telegram na página Integrações";
  const vinculadas = listaPessoas.filter((x) => x.p.telegramChatId);
  const podeGerenciar = pode(usuario, "gerenciar_telegram");
  const podeIntegrar = pode(usuario, "gerenciar_integracoes");
  const ativos = convites.filter((x) => !x.c.usadoEm && !x.c.revogadoEm && x.c.expiraEm > agora);

  return (
    <>
      <CabecalhoPagina
        titulo="Telegram"
        descricao="O bot do condomínio: quem está conectado, os convites, as conversas e os avisos enviados."
      />

      {/* Status do bot */}
      <Cartao>
        <TituloCartao descricao="Consulta feita agora ao Telegram (getMe e getWebhookInfo).">Status do bot</TituloCartao>
        {!status.configurado ? (
          <Aviso tom="amarelo">
            O bot ainda não está conectado.{" "}
            <Link href="/app/integracoes" className="font-medium underline">
              Conectar Telegram
            </Link>
          </Aviso>
        ) : status.modo === "erro" ? (
          <Aviso tom="vermelho">O Telegram não respondeu: {status.erro}</Aviso>
        ) : (
          <div className="grid gap-4 md:grid-cols-3">
            <div>
              <p className="text-xs text-suave">Bot</p>
              <p className="font-medium">
                <a href={`https://t.me/${status.bot?.username}`} target="_blank" rel="noopener noreferrer" className="text-primaria hover:underline">
                  @{status.bot?.username}
                </a>
              </p>
              <p className="text-xs text-suave">
                {status.bot?.nome} · token {status.tokenMascarado}
              </p>
            </div>
            <div>
              <p className="text-xs text-suave">Modo de recebimento</p>
              {status.modo === "webhook" ? (
                <>
                  <Selo tom="verde">Webhook</Selo>
                  <p className="mt-1 break-all text-xs text-suave">{status.webhook?.url}</p>
                  <p className="text-xs text-suave">Pendentes no Telegram: {status.webhook?.pending_update_count ?? 0}</p>
                  {status.webhook?.last_error_message ? (
                    <p className="mt-1 text-xs text-perigo">
                      Último erro: {status.webhook.last_error_message} ({dataHora(new Date((status.webhook.last_error_date ?? 0) * 1000))})
                    </p>
                  ) : null}
                </>
              ) : (
                <>
                  <Selo tom="azul">Escuta local (polling)</Selo>
                  <p className="mt-1 text-xs text-suave">
                    Sem endereço público: as mensagens chegam enquanto o comando de escuta local (<code>telegram:polling</code>) estiver rodando.
                  </p>
                  <p className="text-xs text-suave">Pendentes no Telegram: {status.webhook?.pending_update_count ?? 0}</p>
                </>
              )}
            </div>
            <div>
              <p className="text-xs text-suave">Última mensagem recebida</p>
              <p className="font-medium">{status.ultimoUpdate ? dataHora(status.ultimoUpdate.em) : "nenhuma ainda"}</p>
              {status.ultimoUpdate ? <p className="text-xs text-suave">via {status.ultimoUpdate.origem === "webhook" ? "webhook" : "escuta local"}</p> : null}
            </div>
          </div>
        )}
        {status.configurado && status.modo !== "erro" && podeIntegrar ? (
          <div className="mt-4 flex flex-wrap gap-3 border-t border-borda pt-4">
            {status.modo === "webhook" ? (
              <BotaoAcao acao={removerWebhook} rotulo="Remover webhook (voltar à escuta local)" pendenteRotulo="Removendo…" variante="perigo" />
            ) : (
              <BotaoAcao acao={ativarWebhook} rotulo="Ativar webhook neste endereço" pendenteRotulo="Ativando…" />
            )}
          </div>
        ) : null}
      </Cartao>

      {/* Pessoas */}
      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_380px]">
        <Cartao>
          <TituloCartao
            descricao={`${vinculadas.length} de ${listaPessoas.length} pessoas com o Telegram conectado. Cada convite vale uma vez e tem prazo.`}
            acao={usuario.organizacao.isDemo && podeGerenciar ? <BotaoAcao acao={criarPessoaDemonstracao} rotulo="Criar pessoa de demonstração" /> : null}
          >
            Pessoas
          </TituloCartao>
          {listaPessoas.length === 0 ? (
            <Vazio>Nenhuma pessoa cadastrada. Use o formulário “Adicionar pessoa”.</Vazio>
          ) : (
            <ul className="divide-y divide-borda">
              {listaPessoas.map(({ p, condominio }) => (
                <li key={p.id} className="flex flex-wrap items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.nome}</p>
                    <p className="text-xs text-suave">
                      {ROTULO_PAPEL[p.papel]}
                      {p.unidade ? ` · ${p.unidade}` : ""} · {condominio}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {p.telegramChatId ? (
                        <Selo tom="verde">Telegram conectado{p.telegramUsername ? ` (@${p.telegramUsername})` : ""}</Selo>
                      ) : (
                        <Selo>Sem Telegram</Selo>
                      )}
                      {p.botBloqueadoEm ? <Selo tom="vermelho">Bot bloqueado desde {dataHora(p.botBloqueadoEm)}</Selo> : null}
                      {p.vinculadoEm ? <span className="text-xs text-suave">desde {dataHora(p.vinculadoEm)}</span> : null}
                    </div>
                  </div>
                  {podeGerenciar ? (
                    <div className="min-w-0 max-w-full">
                      {p.telegramChatId ? (
                        <form action={desvincular}>
                          <input type="hidden" name="pessoaId" value={p.id} />
                          <button type="submit" className={classesBotao("perigo", "sm")}>
                            Desconectar
                          </button>
                        </form>
                      ) : (
                        <GerarConvite pessoaId={p.id} desabilitado={semTelegram} />
                      )}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao>
          <TituloCartao descricao="Quem vai conversar com o bot: síndico, funcionários, moradores e prestadores.">Adicionar pessoa</TituloCartao>
          <FormularioPessoa condominios={listaCondominios} />
        </Cartao>
      </div>

      {/* Convites */}
      <Cartao className="mt-6">
        <TituloCartao descricao={`${ativos.length} convite(s) aguardando uso. O código fica guardado só como hash: o link aparece uma única vez, ao gerar.`}>
          Convites
        </TituloCartao>
        {convites.length === 0 ? (
          <Vazio>Nenhum convite gerado ainda.</Vazio>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="text-left text-xs text-suave">
                <tr>
                  <th className="py-2 pr-3 font-medium">Pessoa</th>
                  <th className="py-2 pr-3 font-medium">Situação</th>
                  <th className="py-2 pr-3 font-medium">Criado</th>
                  <th className="py-2 pr-3 font-medium">Validade</th>
                  <th className="py-2 font-medium" />
                </tr>
              </thead>
              <tbody className="divide-y divide-borda">
                {convites.map(({ c, pessoa }) => {
                  const situacao = c.usadoEm
                    ? { t: `usado em ${dataHora(c.usadoEm)}`, tom: "verde" as const }
                    : c.revogadoEm
                      ? { t: "cancelado", tom: "cinza" as const }
                      : c.expiraEm <= agora
                        ? { t: "vencido", tom: "amarelo" as const }
                        : { t: "aguardando", tom: "azul" as const };
                  const ativo = !c.usadoEm && !c.revogadoEm && c.expiraEm > agora;
                  return (
                    <tr key={c.id}>
                      <td className="py-2 pr-3">{pessoa}</td>
                      <td className="py-2 pr-3">
                        <Selo tom={situacao.tom}>{situacao.t}</Selo>
                      </td>
                      <td className="py-2 pr-3 text-suave">{dataHora(c.criadoEm)}</td>
                      <td className="py-2 pr-3 text-suave">{dataHora(c.expiraEm)}</td>
                      <td className="py-2 text-right">
                        {ativo && podeGerenciar ? (
                          <form action={revogar}>
                            <input type="hidden" name="conviteId" value={c.id} />
                            <button type="submit" className={classesBotao("perigo", "sm")}>
                              Cancelar
                            </button>
                          </form>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Cartao>

      {/* Avisos */}
      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Cartao>
          <TituloCartao descricao="Para uma pessoa ou para todos de um perfil. A entrega de cada pessoa fica registrada.">Enviar aviso</TituloCartao>
          <FormularioAviso
            condominios={listaCondominios}
            pessoas={listaPessoas.map(({ p }) => ({ id: p.id, nome: p.nome, condominioId: p.condominioId, vinculada: !!p.telegramChatId }))}
            desabilitado={semTelegram}
          />
        </Cartao>
        <Cartao>
          <TituloCartao acao={conectado ? <BotaoAcao acao={enviarFilaAgora} rotulo="Enviar fila agora" pendenteRotulo="Enviando…" /> : null}>
            Avisos recentes
          </TituloCartao>
          {filaEnvios.length === 0 ? (
            <Vazio>Nenhum aviso enviado ainda.</Vazio>
          ) : (
            <ul className="divide-y divide-borda">
              {filaEnvios.map(({ e, pessoa }) => {
                const s = ROTULO_STATUS_ENVIO[e.status];
                return (
                  <li key={e.id} className="py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-medium">{pessoa ?? "Pessoa removida"}</span>
                      <Selo tom={s.tom}>{s.texto}</Selo>
                      <span className="ml-auto text-xs text-suave">{dataHora(e.enviadoEm ?? e.criadoEm)}</span>
                    </div>
                    <p className="mt-0.5 line-clamp-2 text-sm text-suave">{e.texto}</p>
                    {e.erro && e.status !== "enviado" ? <p className="text-xs text-perigo">{e.erro}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}
        </Cartao>
      </div>

      {/* Conversas */}
      <Cartao className="mt-6">
        <TituloCartao descricao="As 30 mensagens mais recentes das pessoas conectadas. Mensagens de quem não tem convite não são guardadas.">
          Últimas conversas
        </TituloCartao>
        {conversas.length === 0 ? (
          <Vazio>Nenhuma conversa ainda. Gere um convite e peça para a pessoa tocar no link.</Vazio>
        ) : (
          <ul className="space-y-2">
            {conversas.map(({ m, pessoa, arquivoNome }) => (
              <li key={m.id} className={m.direcao === "saida" ? "flex justify-end" : "flex"}>
                <div
                  className={
                    m.direcao === "saida"
                      ? "max-w-[80%] rounded-2xl rounded-br-sm bg-primaria-clara/60 px-3 py-2"
                      : "max-w-[80%] rounded-2xl rounded-bl-sm border border-borda bg-white px-3 py-2"
                  }
                >
                  <p className="text-xs text-suave">
                    {m.direcao === "saida" ? `Bot → ${pessoa ?? "pessoa"}` : (pessoa ?? "pessoa")} · {ROTULO_TIPO_MSG[m.tipo]} · {dataHora(m.criadoEm)}
                  </p>
                  {m.texto ? <p className="whitespace-pre-wrap break-words text-sm">{m.texto}</p> : null}
                  {m.arquivoId ? (
                    <a href={`/api/arquivos/${m.arquivoId}`} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-primaria hover:underline">
                      Abrir {arquivoNome ?? "arquivo"}
                    </a>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Cartao>
    </>
  );
}
