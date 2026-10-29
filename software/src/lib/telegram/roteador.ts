import { BRAND } from "@/lib/brand";
import type { Aguardando, PapelPessoa } from "@/db/schema";
import type { TgCallbackQuery, TgMessage, TgUpdate, TgUser, TecladoInline } from "./tipos";

/**
 * Roteador do bot: registro (registry) de comandos, botões e tratadores.
 *
 * Para um módulo de negócio falar pelo Telegram, crie um arquivo em
 * `src/lib/telegram/comandos/` e registre ali comandos (`registrarComando`),
 * botões (`registrarAcao`), tratadores de arquivo (`registrarArquivo`) e de
 * mensagem livre (`registrarMensagemLivre`). Depois importe o arquivo em
 * `comandos/index.ts`.
 */

export type PessoaVinculada = {
  id: string;
  nome: string;
  papel: PapelPessoa;
  unidade: string | null;
  organizacaoId: string;
  condominioId: string;
  condominioNome: string;
  /** Quantos vínculos (condomínios) a conta do Telegram tem. Com mais de 1, toda resposta diz o condomínio. */
  vinculos?: number;
};

/** Saída do bot. Em produção fala com a Bot API; nos testes é um registro em memória. */
export interface Saida {
  enviarTexto(
    destino: { chatId: number; pessoa?: PessoaVinculada | null },
    texto: string,
    opcoes?: { teclado?: TecladoInline },
  ): Promise<{ messageId: number } | null>;
  responderBotao(callbackId: string, texto?: string): Promise<void>;
  editarTexto(chatId: number, messageId: number, texto: string, teclado?: TecladoInline): Promise<void>;
  baixarArquivo(fileId: string): Promise<{ bytes: Uint8Array; caminho: string; tamanho: number }>;
  /** Envia um arquivo (PDF como documento, imagem como foto). */
  enviarArquivo(
    destino: { chatId: number; pessoa?: PessoaVinculada | null },
    arquivo: { campo: "document" | "photo"; bytes: Uint8Array; nome: string; mime: string },
    legenda?: string,
  ): Promise<{ messageId: number } | null>;
}

export type ContextoBot = {
  update: TgUpdate;
  chatId: number;
  chatPrivado: boolean;
  de: TgUser;
  /** Pessoa vinculada a este chat (null se ninguém vinculado). Pode mudar durante o processamento (/start, /sair). */
  pessoa: PessoaVinculada | null;
  mensagem?: TgMessage;
  callback?: TgCallbackQuery;
  texto: string | null;
  /** Nome do comando sem a barra e sem @bot, em minúsculas (ex.: "ajuda"). */
  comando: string | null;
  args: string;
  /** Id do registro de entrada em telegram_mensagens (para anexar arquivo depois). */
  registroEntradaId: string | null;
  /** Vínculos do chat quando há vários condomínios e nenhum escolhido (o roteador pede a escolha). */
  opcoesContexto?: PessoaVinculada[];
  saida: Saida;
  responder(texto: string, opcoes?: { teclado?: TecladoInline }): Promise<{ messageId: number } | null>;
  /** Estado da conversa (o que o bot espera deste chat), carregado antes de rotear. */
  estado?: EstadoConversa | null;
  limparEstado?: () => Promise<void>;
  /** Arquivo da mensagem já guardado (preenchido por obterArquivoDaMensagem). */
  arquivoSalvo?: { id: string; nome: string; mimeType: string; tamanho: number } | null;
  /** Responde o toque no botão (some o "carregando" do Telegram). */
  responderBotao(texto?: string): Promise<void>;
  botaoRespondido: boolean;
};

export type Permissao = "publico" | "vinculado" | PapelPessoa[];

export type Comando = {
  nome: string;
  descricao: string;
  permissao: Permissao;
  /** Esconde da lista do /ajuda (ex.: /start). */
  oculto?: boolean;
  executar(ctx: ContextoBot): Promise<void>;
};

export type AcaoBotao = {
  /** Prefixo do callback_data, antes dos dois-pontos (ex.: "sair" em "sair:sim"). Máx. 64 bytes no total. */
  prefixo: string;
  permissao: Permissao;
  executar(ctx: ContextoBot, dados: string): Promise<void>;
};

export type EstadoConversa = { aguardando: Aguardando; refId: string | null; dados: Record<string, unknown> | null; pessoaId: string | null };

/** Devolve true se tratou a mensagem (a cadeia para no primeiro true). */
export type TratadorMensagem = (ctx: ContextoBot) => Promise<boolean>;

export type ResultadoRota =
  | { tipo: "comando"; nome: string }
  | { tipo: "botao"; prefixo: string }
  | { tipo: "arquivo" }
  | { tipo: "livre" }
  | { tipo: "sem_vinculo" }
  | { tipo: "negado"; motivo: string }
  | { tipo: "desconhecido" }
  | { tipo: "ignorado" };

export const ROTULO_PAPEL: Record<PapelPessoa, string> = {
  sindico: "Síndico(a)",
  funcionario: "Funcionário(a)",
  morador: "Morador(a)",
  prestador: "Prestador(a) de serviço",
};

export function mensagemSemVinculo(): string {
  return [
    `Olá! Eu sou o assistente do ${BRAND.nome}.`,
    "",
    "Para conversar comigo, peça ao síndico ou à administradora do seu condomínio um link de convite e toque nele.",
    "Se você recebeu um código, envie: /start <código>",
  ].join("\n");
}

export function textoEscolhaContexto(): string {
  return "Este Telegram está ligado a mais de um condomínio. Escolha com qual você quer falar agora:";
}

export function tecladoContexto(opcoes: PessoaVinculada[]): TecladoInline {
  return opcoes.slice(0, 8).map((o) => [{ text: rotuloVinculo(o).slice(0, 60), callback_data: `ctx:${o.id}` }]);
}

/** "Jardim das Araucárias · morador 302". */
export function rotuloVinculo(p: Pick<PessoaVinculada, "condominioNome" | "papel" | "unidade">): string {
  const papel = ROTULO_PAPEL[p.papel].replace(/\(a\)| de serviço/g, "").toLowerCase();
  return `${p.condominioNome} · ${papel}${p.papel === "morador" && p.unidade ? ` ${p.unidade}` : ""}`;
}

/** Toda mensagem que sai começa com "{Condomínio} · {papel}". */
export function cabecalhoContexto(p: PessoaVinculada | null): string {
  if (!p) return "";
  return `${rotuloVinculo(p)}\n\n`;
}

export function permitido(permissao: Permissao, pessoa: PessoaVinculada | null): boolean {
  if (permissao === "publico") return true;
  if (!pessoa) return false;
  if (permissao === "vinculado") return true;
  return permissao.includes(pessoa.papel);
}

/** "/Ajuda@meu_bot  x y" → { comando: "ajuda", args: "x y" } */
export function analisarComando(texto: string | null | undefined): { comando: string | null; args: string } {
  if (!texto || !texto.startsWith("/")) return { comando: null, args: "" };
  const m = texto.match(/^\/([A-Za-z0-9_]{1,32})(?:@[A-Za-z0-9_]+)?(?:\s+([\s\S]*))?$/);
  if (!m) return { comando: null, args: "" };
  return { comando: m[1].toLowerCase(), args: (m[2] ?? "").trim() };
}

export function criarRoteador() {
  const comandos = new Map<string, Comando>();
  const acoes = new Map<string, AcaoBotao>();
  const tratadoresArquivo: TratadorMensagem[] = [];
  const tratadoresLivres: TratadorMensagem[] = [];
  const tratadoresEstado = new Map<Aguardando, TratadorMensagem>();
  const tratadoresAntesDoEstado: TratadorMensagem[] = [];
  let trocaDeContexto: ((ctx: ContextoBot, pessoa: PessoaVinculada) => Promise<PessoaVinculada | null>) | null = null;

  const api = {
    registrarComando(c: Comando) {
      if (!/^[a-z0-9_]{1,32}$/.test(c.nome)) throw new Error(`Nome de comando inválido: ${c.nome}`);
      comandos.set(c.nome, c);
    },
    registrarAcao(a: AcaoBotao) {
      if (!/^[a-z0-9_]{1,20}$/.test(a.prefixo)) throw new Error(`Prefixo de botão inválido: ${a.prefixo}`);
      acoes.set(a.prefixo, a);
    },
    /** Tratadores de foto/documento, em ordem de registro. */
    registrarArquivo(t: TratadorMensagem, opcoes: { prioridade?: "inicio" | "fim" } = {}) {
      if (opcoes.prioridade === "inicio") tratadoresArquivo.unshift(t);
      else tratadoresArquivo.push(t);
    },
    /**
     * Ponto de extensão da "mensagem livre" (texto que não é comando). A IA entra aqui:
     * registre com prioridade "inicio" para ser chamado antes do tratador padrão.
     */
    registrarMensagemLivre(t: TratadorMensagem, opcoes: { prioridade?: "inicio" | "fim" } = {}) {
      if (opcoes.prioridade === "inicio") tratadoresLivres.unshift(t);
      else tratadoresLivres.push(t);
    },
    /** Tratador do estado da conversa (ex.: "recibo" → espera a foto). Chamado antes de arquivo e texto livre. */
    registrarEstado(aguardando: Aguardando, t: TratadorMensagem) {
      tratadoresEstado.set(aguardando, t);
    },
    /** Roda antes do estado da conversa e dos tratadores (texto ou legenda). */
    registrarAntesDoEstado(t: TratadorMensagem) {
      tratadoresAntesDoEstado.push(t);
    },
    /** Como trocar o vínculo atual do chat (fica em base.ts, que conhece o banco e o menu). */
    definirTrocaDeContexto(fn: (ctx: ContextoBot, pessoa: PessoaVinculada) => Promise<PessoaVinculada | null>) {
      trocaDeContexto = fn;
    },
    acoesRegistradas(): string[] {
      return [...acoes.keys()];
    },
    comandosRegistrados(): string[] {
      return [...comandos.keys()];
    },
    comando(nome: string) {
      return comandos.get(nome);
    },
    /** Comandos que esta pessoa pode usar (o que o /ajuda mostra). */
    comandosDisponiveis(pessoa: PessoaVinculada | null): Comando[] {
      return [...comandos.values()].filter((c) => !c.oculto && permitido(c.permissao, pessoa));
    },
    /** Lista para o setMyCommands (menu do Telegram). */
    comandosParaMenu(): { command: string; description: string }[] {
      return [...comandos.values()].filter((c) => !c.oculto).map((c) => ({ command: c.nome, description: c.descricao.slice(0, 256) }));
    },

    async rotear(ctx: ContextoBot): Promise<ResultadoRota> {
      // 0. Vários condomínios e nenhum escolhido: nunca usa o último por acaso, pede a escolha.
      // (Botões não passam por aqui: cada ação acha o condomínio pelo registro e confere o vínculo naquele condomínio.)
      if (!ctx.callback && !ctx.pessoa && ctx.opcoesContexto && ctx.opcoesContexto.length > 1 && !["start", "condominio", "ajuda"].includes(ctx.comando ?? "")) {
        if (ctx.chatPrivado) await ctx.responder(textoEscolhaContexto(), { teclado: tecladoContexto(ctx.opcoesContexto) });
        return { tipo: "negado", motivo: "sem_contexto" };
      }
      // 1. Toque em botão (callback_query).
      if (ctx.callback) {
        const dados = ctx.callback.data ?? "";
        const sep = dados.indexOf(":");
        const prefixo = sep >= 0 ? dados.slice(0, sep) : dados;
        const resto = sep >= 0 ? dados.slice(sep + 1) : "";
        const acao = acoes.get(prefixo);
        if (!acao) {
          await ctx.responderBotao("Esse botão não está mais disponível.");
          return { tipo: "desconhecido" };
        }
        if (!permitido(acao.permissao, ctx.pessoa)) {
          await ctx.responderBotao(ctx.pessoa ? "Esta opção não está disponível para o seu perfil." : "Você não está vinculado.");
          return { tipo: "negado", motivo: "permissao" };
        }
        await acao.executar(ctx, resto);
        if (!ctx.botaoRespondido) await ctx.responderBotao();
        return { tipo: "botao", prefixo };
      }

      // 2. Só conversas privadas (grupos ficam para depois e não recebem resposta).
      if (!ctx.chatPrivado || !ctx.mensagem) return { tipo: "ignorado" };

      // 3. Comandos.
      if (ctx.comando) {
        const cmd = comandos.get(ctx.comando);
        if (!cmd) {
          if (!ctx.pessoa) {
            await ctx.responder(mensagemSemVinculo());
            return { tipo: "sem_vinculo" };
          }
          await ctx.responder(`Não conheço o comando /${ctx.comando}. Envie /ajuda para ver o que posso fazer.`);
          return { tipo: "desconhecido" };
        }
        if (!permitido(cmd.permissao, ctx.pessoa)) {
          if (!ctx.pessoa) {
            await ctx.responder(mensagemSemVinculo());
            return { tipo: "sem_vinculo" };
          }
          // Síndico que também é morador (ou prestador em vários condomínios): o comando é de outro
          // vínculo deste mesmo Telegram. Com um só candidato, troca e executa; com vários, pergunta.
          const todos = (ctx.opcoesContexto ?? []).filter((o) => o.id !== ctx.pessoa?.id && permitido(cmd.permissao, o));
          // Prefere o perfil do mesmo condomínio (o síndico morador continua no prédio dele).
          const mesmoCondominio = todos.filter((o) => o.condominioId === ctx.pessoa?.condominioId);
          const candidatos = mesmoCondominio.length === 1 ? mesmoCondominio : todos;
          if (candidatos.length === 1 && trocaDeContexto) {
            const nova = await trocaDeContexto(ctx, candidatos[0]);
            if (nova) {
              ctx.pessoa = nova;
              await ctx.responder(`Troquei esta conversa para ${rotuloVinculo(nova)}.`);
              if (ctx.estado && ctx.limparEstado) {
                await ctx.limparEstado();
                ctx.estado = null;
              }
              await cmd.executar(ctx);
              return { tipo: "comando", nome: cmd.nome };
            }
          }
          if (candidatos.length > 1) {
            await ctx.responder(`O comando /${cmd.nome} é de outro perfil seu. Escolha com qual quer continuar e envie /${cmd.nome} de novo:`, {
              teclado: tecladoContexto(candidatos),
            });
            return { tipo: "negado", motivo: "outro_perfil" };
          }
          await ctx.responder(`O comando /${cmd.nome} não está disponível para o seu perfil. Envie /ajuda para ver os seus comandos.`);
          return { tipo: "negado", motivo: "permissao" };
        }
        // Um comando novo cancela o que o bot estava esperando.
        if (ctx.estado && ctx.limparEstado) {
          await ctx.limparEstado();
          ctx.estado = null;
        }
        await cmd.executar(ctx);
        return { tipo: "comando", nome: cmd.nome };
      }

      // 4. Quem não está vinculado só recebe a instrução.
      if (!ctx.pessoa) {
        await ctx.responder(mensagemSemVinculo());
        return { tipo: "sem_vinculo" };
      }

      // 5. Antes do estado (ex.: emergência: "cheiro de gás" no meio de um /recibo ainda dispara).
      for (const t of tratadoresAntesDoEstado) if (await t(ctx)) return { tipo: "livre" };

      // 5b. O bot esperava algo deste chat (estado da conversa).
      if (ctx.estado) {
        const t = tratadoresEstado.get(ctx.estado.aguardando);
        if (t && (await t(ctx))) return { tipo: ctx.mensagem.photo?.length || ctx.mensagem.document ? "arquivo" : "livre" };
      }

      // 6. Foto ou documento.
      if (ctx.mensagem.photo?.length || ctx.mensagem.document) {
        for (const t of tratadoresArquivo) if (await t(ctx)) return { tipo: "arquivo" };
        await ctx.responder("Não consegui tratar este arquivo agora.");
        return { tipo: "arquivo" };
      }

      // 7. Texto livre (ponto de extensão da IA).
      if (ctx.texto) {
        for (const t of tratadoresLivres) if (await t(ctx)) return { tipo: "livre" };
        return { tipo: "livre" };
      }

      await ctx.responder("Por enquanto eu entendo texto, fotos e documentos.");
      return { tipo: "ignorado" };
    },
  };
  return api;
}

export type Roteador = ReturnType<typeof criarRoteador>;

/** Monta o contexto a partir do update (sem acesso ao banco). */
export function montarContexto(params: {
  update: TgUpdate;
  pessoa: PessoaVinculada | null;
  saida: Saida;
  registroEntradaId?: string | null;
}): ContextoBot | null {
  const { update, saida } = params;
  const mensagem = update.message;
  const callback = update.callback_query;
  const chat = mensagem?.chat ?? callback?.message?.chat;
  const de = mensagem?.from ?? callback?.from;
  if (!chat || !de) return null;
  const texto = mensagem?.text ?? mensagem?.caption ?? null;
  const { comando, args } = analisarComando(mensagem?.text);
  const ctx: ContextoBot = {
    update,
    chatId: chat.id,
    chatPrivado: chat.type === "private",
    de,
    pessoa: params.pessoa,
    mensagem,
    callback,
    texto,
    comando,
    args,
    registroEntradaId: params.registroEntradaId ?? null,
    saida,
    botaoRespondido: false,
    responder: (t, o) => saida.enviarTexto({ chatId: chat.id, pessoa: ctx.pessoa }, cabecalhoContexto(ctx.pessoa) + t, o),
    responderBotao: async (t) => {
      if (!callback || ctx.botaoRespondido) return;
      ctx.botaoRespondido = true;
      await saida.responderBotao(callback.id, t);
    },
  };
  return ctx;
}
