import {
  pgTable,
  uuid,
  text,
  boolean,
  integer,
  bigint,
  timestamp,
  jsonb,
  primaryKey,
  index,
  uniqueIndex,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

/* ------------------------------------------------------------------ */
/* Tipos de domínio (texto no banco, para estender sem migração de enum) */
/* ------------------------------------------------------------------ */

/** Papel de quem entra no painel. */
export type PapelUsuario = "admin" | "sindico" | "conselho" | "equipe";
export type PapelNoAcesso = "sindico" | "equipe" | "conselho";
/** Tipo da conta: uma conta = uma administradora ou um síndico. */
export type TipoConta = "administradora" | "sindico_profissional" | "sindico_morador";
/** Papel de uma pessoa do condomínio que fala com o bot. */
export type PapelPessoa = "sindico" | "funcionario" | "morador" | "prestador";
export type Urgencia = "baixa" | "media" | "alta" | "emergencia";

export type StatusUpdate = "recebido" | "processado" | "ignorado" | "erro";
export type StatusEnvio = "pendente" | "enviando" | "enviado" | "erro" | "nao_enviado" | "cancelado";
export type DirecaoMensagem = "entrada" | "saida";
export type TipoMensagem = "texto" | "comando" | "foto" | "documento" | "botao" | "outro";

const criadoEm = () => timestamp("criado_em", { withTimezone: true }).notNull().defaultNow();
const telegramId = (nome: string) => bigint(nome, { mode: "number" });

/* ------------------------------ Contas ------------------------------ */

export const organizacoes = pgTable("organizacoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  nome: text("nome").notNull(),
  /** Teto mensal da IA em dólares. */
  limiteIaUsd: integer("limite_ia_usd").notNull().default(5),
  tipo: text("tipo").$type<TipoConta>().notNull().default("administradora"),
  cnpj: text("cnpj"),
  isDemo: boolean("is_demo").notNull().default(false),
  criadoEm: criadoEm(),
});

export const usuarios = pgTable(
  "usuarios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    email: text("email").notNull(),
    senhaHash: text("senha_hash").notNull(),
    papel: text("papel").$type<PapelUsuario>().notNull().default("admin"),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("usuarios_email_uq").on(t.email), index("usuarios_org_idx").on(t.organizacaoId)],
);

export const condominios = pgTable(
  "condominios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    cnpj: text("cnpj"),
    endereco: text("endereco"),
    cidade: text("cidade"),
    uf: text("uf"),
    totalUnidades: integer("total_unidades"),
    cep: text("cep"),
    isDemo: boolean("is_demo").notNull().default(false),
    enderecoFicticio: boolean("endereco_ficticio").notNull().default(false),
    /** Despesa acima deste valor (centavos) fica aguardando aprovação; nulo = sem alçada. */
    alcadaDespesaCentavos: bigint("alcada_despesa_centavos", { mode: "number" }),
    /** Mensagens fixas de segurança editadas pelo síndico, por grupo de emergência. */
    mensagensSeguranca: jsonb("mensagens_seguranca").$type<Record<string, string>>(),
    /** "conferencia" (padrão): a resposta da IA ao morador espera o síndico. "automatico_com_citacao": sai sozinha se a citação passou na conferência do código. */
    modoRespostaDuvida: text("modo_resposta_duvida").$type<"conferencia" | "automatico_com_citacao">().notNull().default("conferencia"),
    contatoEmergenciaNome: text("contato_emergencia_nome"),
    contatoEmergenciaTelefone: text("contato_emergencia_telefone"),
    /** Janela de envio de rotinas e lembretes aos funcionários (hora local, sem horário por pessoa). */
    janelaInicio: integer("janela_inicio").notNull().default(8),
    janelaFim: integer("janela_fim").notNull().default(18),
    /** Horas para o morador confirmar o chamado resolvido; sem resposta, fecha "sem confirmação". */
    horasConfirmacaoChamado: integer("horas_confirmacao_chamado").notNull().default(72),
    /** Dias que as fotos de rotina ficam guardadas. */
    purgaFotosRotinaDias: integer("purga_fotos_rotina_dias").notNull().default(90),
    criadoEm: criadoEm(),
  },
  (t) => [index("condominios_org_idx").on(t.organizacaoId)],
);

/* ---------------------- Pessoas e vínculo Telegram ---------------------- */

/**
 * Pessoa do condomínio que conversa com o bot (síndico, funcionário, morador,
 * prestador). O vínculo com o Telegram fica aqui: um chat privado vincula no
 * máximo uma pessoa por vez (índice único em telegram_chat_id).
 * Os módulos de negócio (moradores, unidades) podem referenciar pessoas.id.
 */
export const pessoas = pgTable(
  "pessoas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id, { onDelete: "cascade" }),
    condominioId: uuid("condominio_id")
      .notNull()
      .references(() => condominios.id, { onDelete: "cascade" }),
    nome: text("nome").notNull(),
    papel: text("papel").$type<PapelPessoa>().notNull(),
    unidade: text("unidade"),
    telefone: text("telefone"),
    telegramChatId: telegramId("telegram_chat_id"),
    telegramUserId: telegramId("telegram_user_id"),
    telegramUsername: text("telegram_username"),
    telegramNome: text("telegram_nome"),
    vinculadoEm: timestamp("vinculado_em", { withTimezone: true }),
    botBloqueadoEm: timestamp("bot_bloqueado_em", { withTimezone: true }),
    /** Conta do Telegram (uma conta pode ter vínculos em vários condomínios). */
    telegramContaId: uuid("telegram_conta_id").references((): AnyPgColumn => telegramContas.id, { onDelete: "set null" }),
    unidadeId: uuid("unidade_id").references((): AnyPgColumn => unidades.id, { onDelete: "set null" }),
    prestadorId: uuid("prestador_id").references((): AnyPgColumn => prestadores.id, { onDelete: "set null" }),
    /** Usuário do painel que é esta pessoa (síndico), para o /condominio trocar entre os condomínios dele. */
    usuarioId: uuid("usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    /** Função (zelador, limpeza, portaria…) e posto (rotina do posto, para terceirizados). */
    funcao: text("funcao"),
    posto: text("posto"),
    empregador: text("empregador").$type<"condominio" | "contratada">(),
    empresaContratada: text("empresa_contratada"),
    /** Contato de plantão para emergências (combinado com o empregador). */
    contatoPlantao: boolean("contato_plantao").notNull().default(false),
    /** Funcionário vinculado num aparelho do condomínio (o vínculo é da pessoa; a conta do Telegram é do posto). */
    celularDoPosto: boolean("celular_do_posto").notNull().default(false),
    aceitouTermoEm: timestamp("aceitou_termo_em", { withTimezone: true }),
    revogadaEm: timestamp("revogada_em", { withTimezone: true }),
    exemplo: boolean("exemplo").notNull().default(false),
    /** Pessoa de exemplo do seed: nunca tem Telegram (o envio é registrado como não enviado). */
    semTelegram: boolean("sem_telegram").notNull().default(false),
    /** Cadastro provisório criado pelo convite da unidade ("Morador do 302"); o nome vem do Telegram ao vincular. */
    provisoria: boolean("provisoria").notNull().default(false),
    /** Morador: relação com a unidade (uma unidade tem várias pessoas, cada uma com o seu vínculo). */
    relacaoUnidade: text("relacao_unidade").$type<"proprietario" | "inquilino" | "dependente" | "outro">(),
    /** Mudança registrada: quem saiu não recebe avisos nem usa o bot (o histórico fica). */
    saiuEm: text("saiu_em"),
    /** LGPD: dados pessoais apagados a pedido (o histórico fica sem nome nem telefone). */
    removidaEm: timestamp("removida_em", { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("pessoas_telegram_chat_idx").on(t.telegramChatId),
    index("pessoas_condominio_papel_idx").on(t.condominioId, t.papel),
    index("pessoas_org_idx").on(t.organizacaoId),
  ],
);

/** Convite de uso único para vincular uma pessoa ao bot. Só o hash do código fica guardado. */
export const telegramConvites = pgTable(
  "telegram_convites",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id, { onDelete: "cascade" }),
    condominioId: uuid("condominio_id")
      .notNull()
      .references(() => condominios.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id")
      .notNull()
      .references(() => pessoas.id, { onDelete: "cascade" }),
    codigoHash: text("codigo_hash").notNull(),
    expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
    usadoEm: timestamp("usado_em", { withTimezone: true }),
    usadoPorTelegramUserId: telegramId("usado_por_telegram_user_id"),
    revogadoEm: timestamp("revogado_em", { withTimezone: true }),
    motivoRevogacao: text("motivo_revogacao"),
    loteId: uuid("lote_id"),
    criadoPorUsuarioId: uuid("criado_por_usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("telegram_convites_hash_uq").on(t.codigoHash), index("telegram_convites_pessoa_idx").on(t.pessoaId)],
);

/* ------------------------- Updates e conversas ------------------------- */

/** Updates recebidos (webhook ou polling). A chave (bot, update_id) garante a idempotência. */
export const telegramUpdates = pgTable(
  "telegram_updates",
  {
    botId: telegramId("bot_id").notNull(),
    updateId: telegramId("update_id").notNull(),
    tipo: text("tipo").notNull(),
    origem: text("origem").$type<"webhook" | "polling">().notNull(),
    status: text("status").$type<StatusUpdate>().notNull().default("recebido"),
    payload: jsonb("payload"),
    erro: text("erro"),
    tentativas: integer("tentativas").notNull().default(0),
    recebidoEm: timestamp("recebido_em", { withTimezone: true }).notNull().defaultNow(),
    processadoEm: timestamp("processado_em", { withTimezone: true }),
  },
  (t) => [primaryKey({ columns: [t.botId, t.updateId] }), index("telegram_updates_status_idx").on(t.status, t.recebidoEm)],
);

/** Registro das conversas (entrada e saída). Mensagens de quem não está vinculado ficam sem texto e sem organização. */
export const telegramMensagens = pgTable(
  "telegram_mensagens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: uuid("organizacao_id").references(() => organizacoes.id, { onDelete: "cascade" }),
    condominioId: uuid("condominio_id").references(() => condominios.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    chatId: telegramId("chat_id").notNull(),
    direcao: text("direcao").$type<DirecaoMensagem>().notNull(),
    tipo: text("tipo").$type<TipoMensagem>().notNull(),
    texto: text("texto"),
    telegramMessageId: telegramId("telegram_message_id"),
    updateId: telegramId("update_id"),
    arquivoId: uuid("arquivo_id"),
    envioId: uuid("envio_id"),
    criadoEm: criadoEm(),
  },
  (t) => [index("telegram_mensagens_org_idx").on(t.organizacaoId, t.criadoEm), index("telegram_mensagens_chat_idx").on(t.chatId)],
);

/** Arquivos recebidos (fotos e documentos). O conteúdo fica no adaptador de armazenamento. */
export const arquivos = pgTable(
  "arquivos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id, { onDelete: "cascade" }),
    condominioId: uuid("condominio_id").references(() => condominios.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    origem: text("origem").$type<"telegram" | "painel">().notNull(),
    nomeOriginal: text("nome_original").notNull(),
    mimeType: text("mime_type").notNull(),
    tamanhoBytes: integer("tamanho_bytes").notNull(),
    /** "seed": imagem de exemplo servida pelo próprio app (public/exemplos). */
    provedor: text("provedor").$type<"local" | "blob" | "seed">().notNull(),
    sha256: text("sha256"),
    recebidoComo: text("recebido_como").$type<"foto" | "documento" | "painel" | "seed">(),
    exemplo: boolean("exemplo").notNull().default(false),
    chave: text("chave").notNull(),
    telegramFileId: text("telegram_file_id"),
    telegramFileUniqueId: text("telegram_file_unique_id"),
    criadoEm: criadoEm(),
  },
  (t) => [index("arquivos_org_idx").on(t.organizacaoId, t.criadoEm)],
);

/* ------------------------------ Avisos ------------------------------ */

/**
 * Fila de envios (avisos do sistema). Cada linha é uma mensagem para uma pessoa.
 * `chaveIdempotencia` evita mandar o mesmo lembrete duas vezes (ex.: "vencimento:123:2026-11-05").
 */
export const envios = pgTable(
  "envios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: uuid("organizacao_id")
      .notNull()
      .references(() => organizacoes.id, { onDelete: "cascade" }),
    condominioId: uuid("condominio_id").references(() => condominios.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    chatId: telegramId("chat_id"),
    categoria: text("categoria").notNull().default("aviso"),
    texto: text("texto").notNull(),
    teclado: jsonb("teclado"),
    status: text("status").$type<StatusEnvio>().notNull().default("pendente"),
    tentativas: integer("tentativas").notNull().default(0),
    proximaTentativaEm: timestamp("proxima_tentativa_em", { withTimezone: true }).notNull().defaultNow(),
    erro: text("erro"),
    telegramMessageId: telegramId("telegram_message_id"),
    chaveIdempotencia: text("chave_idempotencia"),
    loteId: uuid("lote_id"),
    criadoPorUsuarioId: uuid("criado_por_usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    /** Emergência: envio direto, sem fila. */
    direto: boolean("direto").notNull().default(false),
    /** Janela de envio ao funcionário: não sai antes desta hora. */
    naoAntesDe: timestamp("nao_antes_de", { withTimezone: true }),
    travadoAte: timestamp("travado_ate", { withTimezone: true }),
    criadoEm: criadoEm(),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
  },
  (t) => [
    index("envios_fila_idx").on(t.status, t.proximaTentativaEm),
    index("envios_org_idx").on(t.organizacaoId, t.criadoEm),
    uniqueIndex("envios_idempotencia_uq").on(t.chaveIdempotencia),
  ],
);

/* --------------------------- Operação --------------------------- */

export const cronExecucoes = pgTable("cron_execucoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  job: text("job").notNull(),
  origem: text("origem").$type<"cron" | "manual" | "script">().notNull(),
  status: text("status").$type<"executando" | "ok" | "erro">().notNull(),
  resumo: jsonb("resumo"),
  erro: text("erro"),
  iniciadoEm: timestamp("iniciado_em", { withTimezone: true }).notNull().defaultNow(),
  terminadoEm: timestamp("terminado_em", { withTimezone: true }),
});

/** Resultado do último "Testar conexão" de cada integração (as chaves são da instalação). */
export const integracoesTestes = pgTable("integracoes_testes", {
  servico: text("servico").primaryKey(),
  ok: boolean("ok").notNull(),
  detalhe: text("detalhe"),
  /** Impressão digital (hash curto) da chave testada: se a chave mudar, o status volta a "não testada". */
  assinatura: text("assinatura"),
  testadoEm: timestamp("testado_em", { withTimezone: true }).notNull().defaultNow(),
});

/* =================================================================== */
/*                    Funcionalidades de negócio                        */
/* =================================================================== */

const org = () =>
  uuid("organizacao_id")
    .notNull()
    .references(() => organizacoes.id, { onDelete: "cascade" });
const cond = () =>
  uuid("condominio_id")
    .notNull()
    .references(() => condominios.id, { onDelete: "cascade" });
const atualizadoEm = () => timestamp("atualizado_em", { withTimezone: true }).notNull().defaultNow();
/** Data sem hora, "AAAA-MM-DD" (texto: igual no Postgres e no PGlite, sem fuso). */
const dia = (nome: string) => text(nome);
/** Registro histórico do seed (mostrado com o selo "dado de exemplo"). */
const exemplo = () => boolean("exemplo").notNull().default(false);

/* ------------------------ Telegram: conta, estado, álbum ------------------------ */

/**
 * Conta do Telegram (um chat privado). Uma conta tem vínculos com VÁRIAS pessoas
 * (o síndico profissional em vários condomínios, o prestador em vários).
 * `contextoPessoaId` é o condomínio atual da conversa, trocado por /condominio.
 */
export const telegramContas = pgTable(
  "telegram_contas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    chatId: telegramId("chat_id").notNull(),
    telegramUserId: telegramId("telegram_user_id").notNull(),
    username: text("username"),
    nome: text("nome"),
    contextoPessoaId: uuid("contexto_pessoa_id"),
    botBloqueadoEm: timestamp("bot_bloqueado_em", { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("telegram_contas_chat_uq").on(t.chatId), index("telegram_contas_user_idx").on(t.telegramUserId)],
);

export type Aguardando =
  | "tipo_mensagem_livre"
  | "duvida"
  | "unidade_chamado"
  | "descricao_chamado"
  | "fotos_chamado"
  | "foto_rotina"
  | "motivo_rotina"
  | "conclusao"
  | "recibo"
  | "topicos_aviso"
  | "certidao"
  | "ocorrencia"
  | "resposta_sindico"
  | "destino_arquivo";

/** O que o bot espera de cada chat (expira em 30 minutos). Lido antes dos tratadores. */
export const conversaEstados = pgTable("conversa_estados", {
  chatId: telegramId("chat_id").primaryKey(),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "cascade" }),
  aguardando: text("aguardando").$type<Aguardando>().notNull(),
  refId: text("ref_id"),
  dados: jsonb("dados"),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
});

/** Álbum (media_group_id): várias fotos chegam em updates separados e são processadas uma vez. */
export const telegramAlbuns = pgTable("telegram_albuns", {
  mediaGroupId: text("media_group_id").primaryKey(),
  chatId: telegramId("chat_id").notNull(),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
  arquivoIds: jsonb("arquivo_ids").$type<string[]>().notNull().default([]),
  legenda: text("legenda"),
  primeiroEm: timestamp("primeiro_em", { withTimezone: true }).notNull().defaultNow(),
  processadoEm: timestamp("processado_em", { withTimezone: true }),
});

/* ------------------------ Acesso, unidades, mudanças, auditoria ------------------------ */

export const acessoCondominios = pgTable(
  "acesso_condominios",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    usuarioId: uuid("usuario_id")
      .notNull()
      .references(() => usuarios.id, { onDelete: "cascade" }),
    condominioId: cond(),
    papel: text("papel").$type<PapelNoAcesso>().notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("acesso_condominios_uq").on(t.usuarioId, t.condominioId), index("acesso_condominios_org_idx").on(t.organizacaoId)],
);

export const unidades = pgTable(
  "unidades",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    bloco: text("bloco").notNull().default(""),
    numero: text("numero").notNull(),
    andar: integer("andar"),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("unidades_uq").on(t.condominioId, t.bloco, t.numero), index("unidades_org_idx").on(t.organizacaoId)],
);

/** Mudanças por unidade (saída e entrada com data). Só inserção. */
export const mudancas = pgTable(
  "mudancas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    unidadeId: uuid("unidade_id")
      .notNull()
      .references(() => unidades.id, { onDelete: "cascade" }),
    tipo: text("tipo").$type<"saida" | "entrada">().notNull(),
    data: dia("data").notNull(),
    pessoaIds: jsonb("pessoa_ids").$type<string[]>().notNull().default([]),
    origem: text("origem").$type<"painel" | "bot">().notNull().default("painel"),
    estado: text("estado").$type<"pedida" | "confirmada">().notNull().default("confirmada"),
    registradaPorRotulo: text("registrada_por_rotulo").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index("mudancas_unidade_idx").on(t.unidadeId)],
);

/** Auditoria só de inserção (trigger recusa UPDATE e DELETE). */
export const auditoria = pgTable(
  "auditoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: uuid("condominio_id"),
    ator: text("ator").notNull(),
    acao: text("acao").notNull(),
    alvo: text("alvo"),
    detalhe: jsonb("detalhe"),
    criadoEm: criadoEm(),
  },
  (t) => [index("auditoria_org_idx").on(t.organizacaoId, t.criadoEm)],
);

/* --------------------------- Chamados --------------------------- */

/** Regras por categoria: urgência padrão, prazo em horas e responsável padrão (funcionário ou prestador). */
export const regrasCategoria = pgTable(
  "regras_categoria",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    categoria: text("categoria").notNull(),
    urgenciaPadrao: text("urgencia_padrao").$type<Urgencia>().notNull(),
    prazoHoras: integer("prazo_horas").notNull().default(72),
    responsavelPessoaId: uuid("responsavel_pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    responsavelPrestadorId: uuid("responsavel_prestador_id").references((): AnyPgColumn => prestadores.id, { onDelete: "set null" }),
    ativa: boolean("ativa").notNull().default(true),
  },
  (t) => [uniqueIndex("regras_categoria_uq").on(t.condominioId, t.categoria)],
);

/** Palavras de emergência extras do condomínio (as do código não podem ser removidas). */
export const palavrasEmergenciaExtra = pgTable("palavras_emergencia_extra", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: org(),
  condominioId: cond(),
  grupo: text("grupo").$type<"fogo_gas" | "elevador" | "agua" | "eletrica">().notNull(),
  expressao: text("expressao").notNull(),
  criadoEm: criadoEm(),
});

export const passosAutoajuda = pgTable(
  "passos_autoajuda",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    categoria: text("categoria").notNull(),
    titulo: text("titulo").notNull(),
    texto: text("texto").notNull(),
    aprovadoPorNome: text("aprovado_por_nome").notNull(),
    aprovadoEm: timestamp("aprovado_em", { withTimezone: true }).notNull().defaultNow(),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [index("passos_autoajuda_cond_idx").on(t.condominioId)],
);

export type EstadoChamado = "novo" | "com_responsavel" | "aguardando_prestador" | "agendado" | "resolvido" | "aguardando_confirmacao" | "encerrado";
export type MotivoEncerramento = "confirmado_pelo_morador" | "sem_confirmacao_72h" | "resolvido_na_entrada" | "encerrado_pelo_sindico" | "registrada";
export type OrigemChamado = "morador" | "funcionario" | "funcionario_pela_unidade" | "sindico" | "vencimento";

export const chamados = pgTable(
  "chamados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    numero: integer("numero").notNull(),
    natureza: text("natureza").$type<"manutencao" | "ocorrencia">().notNull().default("manutencao"),
    origem: text("origem").$type<OrigemChamado>().notNull(),
    abertoPorPessoaId: uuid("aberto_por_pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    abertoPorUsuarioId: uuid("aberto_por_usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    unidadeId: uuid("unidade_id").references(() => unidades.id, { onDelete: "set null" }),
    descricao: text("descricao").notNull(),
    categoria: text("categoria").notNull().default("outra"),
    categoriaOrigem: text("categoria_origem").$type<"ia" | "botao" | "sindico" | "regra">().notNull().default("regra"),
    urgencia: text("urgencia").$type<Urgencia>().notNull().default("media"),
    urgenciaMotivo: text("urgencia_motivo"),
    emergenciaGrupo: text("emergencia_grupo"),
    estado: text("estado").$type<EstadoChamado>().notNull().default("novo"),
    responsavelPessoaId: uuid("responsavel_pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    prestadorId: uuid("prestador_id").references((): AnyPgColumn => prestadores.id, { onDelete: "set null" }),
    agendadoPara: timestamp("agendado_para", { withTimezone: true }),
    resolvidoNaEntrada: boolean("resolvido_na_entrada").notNull().default(false),
    vencimentoId: uuid("vencimento_id"),
    passoAutoajudaId: uuid("passo_autoajuda_id"),
    perguntaEsclarecimento: text("pergunta_esclarecimento"),
    resumoIa: text("resumo_ia"),
    justificativaPrestador: text("justificativa_prestador"),
    reaberturas: integer("reaberturas").notNull().default(0),
    mediaGroupId: text("media_group_id"),
    abertoEm: timestamp("aberto_em", { withTimezone: true }).notNull().defaultNow(),
    resolvidoEm: timestamp("resolvido_em", { withTimezone: true }),
    encerradoEm: timestamp("encerrado_em", { withTimezone: true }),
    motivoEncerramento: text("motivo_encerramento").$type<MotivoEncerramento>(),
    exemplo: exemplo(),
    atualizadoEm: atualizadoEm(),
  },
  (t) => [uniqueIndex("chamados_numero_uq").on(t.condominioId, t.numero), index("chamados_org_idx").on(t.organizacaoId, t.condominioId, t.estado)],
);

/** Linha do tempo do chamado: só inserção (correção = novo evento ligado ao anterior). */
export const chamadoEventos = pgTable(
  "chamado_eventos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    chamadoId: uuid("chamado_id")
      .notNull()
      .references(() => chamados.id, { onDelete: "cascade" }),
    tipo: text("tipo").notNull(),
    texto: text("texto"),
    autorPessoaId: uuid("autor_pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    autorUsuarioId: uuid("autor_usuario_id").references(() => usuarios.id, { onDelete: "set null" }),
    autorRotulo: text("autor_rotulo").notNull(),
    arquivoIds: jsonb("arquivo_ids").$type<string[]>(),
    corrigeEventoId: uuid("corrige_evento_id"),
    exemplo: exemplo(),
    criadoEm: criadoEm(),
  },
  (t) => [index("chamado_eventos_chamado_idx").on(t.chamadoId, t.criadoEm)],
);

/** Pedidos "Falar com o síndico" (de uma dúvida ou de um chamado). */
export const contatosSindico = pgTable("contatos_sindico", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: org(),
  condominioId: cond(),
  pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
  origemTipo: text("origem_tipo").$type<"duvida" | "chamado">().notNull(),
  origemId: uuid("origem_id").notNull(),
  assumidoEm: timestamp("assumido_em", { withTimezone: true }),
  assumidoPorNome: text("assumido_por_nome"),
  criadoEm: criadoEm(),
});

/* --------------------------- Rotinas (tarefas, nunca jornada) --------------------------- */

export const rotinaModelos = pgTable(
  "rotina_modelos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    /** Empregado do condomínio: a tarefa é da pessoa. Contratada: rotina do POSTO (pessoaId nulo), combinada com a empresa. */
    pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    funcao: text("funcao"),
    posto: text("posto"),
    rotinaDoPosto: boolean("rotina_do_posto").notNull().default(false),
    item: text("item").notNull(),
    instrucao: text("instrucao"),
    periodicidade: text("periodicidade").$type<"diaria" | "semanal" | "mensal" | "trimestral" | "anual">().notNull(),
    /** 0 = domingo … 6 = sábado. */
    diasSemana: jsonb("dias_semana").$type<number[]>(),
    diaMes: integer("dia_mes"),
    /** 1 = janeiro … 12 = dezembro; âncora do ciclo trimestral ou mês anual. */
    mesReferencia: integer("mes_referencia"),
    periodoRotulo: text("periodo_rotulo").$type<"manha" | "tarde" | "noite">().notNull().default("manha"),
    /** Hora-limite do ITEM (nunca da pessoa). */
    horaLimite: text("hora_limite"),
    fotoObrigatoria: boolean("foto_obrigatoria").notNull().default(false),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [index("rotina_modelos_cond_idx").on(t.organizacaoId, t.condominioId)],
);

/** Item do dia. Sem entrada, saída, duração nem horas: só o estado da tarefa e a foto. */
export const rotinaItens = pgTable(
  "rotina_itens",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    modeloId: uuid("modelo_id")
      .notNull()
      .references(() => rotinaModelos.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    posto: text("posto"),
    data: dia("data").notNull(),
    estado: text("estado").$type<"previsto" | "feito" | "nao_feito">().notNull().default("previsto"),
    motivo: text("motivo"),
    arquivoId: uuid("arquivo_id").references(() => arquivos.id, { onDelete: "set null" }),
    fotoRecebidaEm: timestamp("foto_recebida_em", { withTimezone: true }),
    marcadoPorPessoaId: uuid("marcado_por_pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
    exemplo: exemplo(),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("rotina_itens_uq").on(t.modeloId, t.data), index("rotina_itens_cond_idx").on(t.organizacaoId, t.condominioId, t.data)],
);

/* --------------------------- Vencimentos --------------------------- */

/** Tabela paramétrica global e versionada (o vencimento do condomínio guarda a versão de origem). */
export const vencimentoModelos = pgTable(
  "vencimento_modelos",
  {
    chave: text("chave").notNull(),
    versao: integer("versao").notNull(),
    nome: text("nome").notNull(),
    referenciaInformada: text("referencia_informada").notNull(),
    periodicidadeMeses: integer("periodicidade_meses"),
    usaValidadeImpressa: boolean("usa_validade_impressa").notNull().default(false),
    variaPorLocal: boolean("varia_por_local").notNull().default(false),
    notaConfira: text("nota_confira"),
    ativoPorPadrao: boolean("ativo_por_padrao").notNull().default(true),
    fonte: text("fonte"),
    fonteData: text("fonte_data"),
  },
  (t) => [primaryKey({ columns: [t.chave, t.versao] })],
);

export const vencimentos = pgTable(
  "vencimentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    modeloChave: text("modelo_chave"),
    modeloVersao: integer("modelo_versao"),
    nome: text("nome").notNull(),
    referenciaInformada: text("referencia_informada"),
    variaPorLocal: boolean("varia_por_local").notNull().default(false),
    notaConfira: text("nota_confira"),
    periodicidadeMeses: integer("periodicidade_meses"),
    usaValidadeImpressa: boolean("usa_validade_impressa").notNull().default(false),
    proximo: dia("proximo"),
    estadoConferencia: text("estado_conferencia").$type<"nao_conferido" | "ativo" | "desativado">().notNull().default("nao_conferido"),
    conferidoPorNome: text("conferido_por_nome"),
    conferidoEm: timestamp("conferido_em", { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [index("vencimentos_cond_idx").on(t.condominioId, t.proximo)],
);

export const servicosRegistrados = pgTable(
  "servicos_registrados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    vencimentoId: uuid("vencimento_id")
      .notNull()
      .references(() => vencimentos.id, { onDelete: "cascade" }),
    dataServico: dia("data_servico"),
    validadeImpressa: dia("validade_impressa"),
    prestadorId: uuid("prestador_id").references((): AnyPgColumn => prestadores.id, { onDelete: "set null" }),
    arquivoId: uuid("arquivo_id").references(() => arquivos.id, { onDelete: "set null" }),
    origemLeitura: text("origem_leitura").$type<"ia" | "manual">().notNull().default("manual"),
    leituraIa: jsonb("leitura_ia"),
    estado: text("estado").$type<"para_conferir" | "conferido" | "recusado">().notNull().default("para_conferir"),
    /** Próximo vencimento antes deste registro (para medir "dentro do prazo cadastrado"). */
    proximoAnterior: dia("proximo_anterior"),
    proximoCalculado: dia("proximo_calculado"),
    dentroDoPrazo: boolean("dentro_do_prazo"),
    chamadoId: uuid("chamado_id"),
    conferidoPorNome: text("conferido_por_nome"),
    conferidoEm: timestamp("conferido_em", { withTimezone: true }),
    exemplo: exemplo(),
    criadoEm: criadoEm(),
  },
  (t) => [index("servicos_registrados_cond_idx").on(t.organizacaoId, t.condominioId)],
);

/* --------------------------- Prestadores --------------------------- */

export const prestadores = pgTable(
  "prestadores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    razaoSocial: text("razao_social").notNull(),
    cnpj: text("cnpj"),
    situacaoCadastral: text("situacao_cadastral"),
    consultadoEm: timestamp("consultado_em", { withTimezone: true }),
    categorias: jsonb("categorias").$type<string[]>().notNull().default([]),
    contato: text("contato"),
    telefone: text("telefone"),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("prestadores_cnpj_uq").on(t.organizacaoId, t.cnpj)],
);

export const prestadorCondominios = pgTable(
  "prestador_condominios",
  {
    prestadorId: uuid("prestador_id")
      .notNull()
      .references(() => prestadores.id, { onDelete: "cascade" }),
    condominioId: cond(),
  },
  (t) => [primaryKey({ columns: [t.prestadorId, t.condominioId] })],
);

export type TipoDocumentoPrestador = "cnd_federal" | "crf_fgts" | "cndt" | "apolice_rc" | "alvara" | "outro";

export const prestadorDocumentos = pgTable(
  "prestador_documentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    prestadorId: uuid("prestador_id")
      .notNull()
      .references(() => prestadores.id, { onDelete: "cascade" }),
    tipo: text("tipo").$type<TipoDocumentoPrestador>().notNull(),
    titularCnpj: text("titular_cnpj"),
    emitidoEm: dia("emitido_em"),
    validade: dia("validade"),
    arquivoId: uuid("arquivo_id").references(() => arquivos.id, { onDelete: "set null" }),
    origemLeitura: text("origem_leitura").$type<"ia" | "manual">().notNull().default("manual"),
    leituraIa: jsonb("leitura_ia"),
    estado: text("estado").$type<"para_conferir" | "conferido" | "recusado">().notNull().default("para_conferir"),
    enviadoPor: text("enviado_por").$type<"painel" | "telegram">().notNull().default("painel"),
    conferidoPorNome: text("conferido_por_nome"),
    conferidoEm: timestamp("conferido_em", { withTimezone: true }),
    criadoEm: criadoEm(),
  },
  (t) => [index("prestador_documentos_idx").on(t.organizacaoId, t.prestadorId)],
);

/** Histórico de dados de pagamento: só inserção, dados cifrados (AES-256-GCM). */
export const prestadorPagamentos = pgTable(
  "prestador_pagamentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    prestadorId: uuid("prestador_id")
      .notNull()
      .references(() => prestadores.id, { onDelete: "cascade" }),
    tipo: text("tipo").$type<"pix" | "conta">().notNull(),
    dadosCifrados: text("dados_cifrados").notNull(),
    resumo: text("resumo").notNull(),
    alteradoPorRotulo: text("alterado_por_rotulo").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index("prestador_pagamentos_idx").on(t.prestadorId, t.criadoEm)],
);

/** Emissores das certidões: link para conferir a autenticidade (sem automação, há captcha). */
export const emissoresCertidao = pgTable("emissores_certidao", {
  tipo: text("tipo").primaryKey(),
  nome: text("nome").notNull(),
  url: text("url").notNull(),
  conferidoEm: text("conferido_em").notNull(),
});

/* --------------------------- Despesas --------------------------- */

export type EstadoDespesa = "para_conferir" | "bloqueada" | "aguardando_aprovacao" | "lancada" | "recusada" | "estornada";

/** Nada se apaga: DELETE recusado; lançada só muda para "estornada" (com motivo), nenhum outro campo. */
export const despesas = pgTable(
  "despesas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    estado: text("estado").$type<EstadoDespesa>().notNull().default("para_conferir"),
    tipoDocumento: text("tipo_documento").notNull().default("recibo"),
    fornecedorNome: text("fornecedor_nome"),
    cnpj: text("cnpj"),
    prestadorId: uuid("prestador_id").references(() => prestadores.id, { onDelete: "set null" }),
    dataEmissao: dia("data_emissao"),
    vencimento: dia("vencimento"),
    valorCentavos: bigint("valor_centavos", { mode: "number" }),
    descricao: text("descricao"),
    categoria: text("categoria").notNull().default("outros"),
    linhaDigitavel: text("linha_digitavel"),
    bancoEmissor: text("banco_emissor"),
    valorLinhaCentavos: bigint("valor_linha_centavos", { mode: "number" }),
    vencimentoLinha: dia("vencimento_linha"),
    beneficiarioImpressoNome: text("beneficiario_impresso_nome"),
    beneficiarioImpressoCnpj: text("beneficiario_impresso_cnpj"),
    beneficiarioConferidoPorNome: text("beneficiario_conferido_por_nome"),
    beneficiarioConferidoEm: timestamp("beneficiario_conferido_em", { withTimezone: true }),
    conferencia: jsonb("conferencia"),
    divergencias: jsonb("divergencias").$type<string[]>(),
    arquivoId: uuid("arquivo_id").references(() => arquivos.id, { onDelete: "set null" }),
    origem: text("origem").$type<"ia" | "manual">().notNull().default("manual"),
    leituraIa: jsonb("leitura_ia"),
    conferidoPorNome: text("conferido_por_nome"),
    conferidoEm: timestamp("conferido_em", { withTimezone: true }),
    aprovadoPorNome: text("aprovado_por_nome"),
    aprovadoEm: timestamp("aprovado_em", { withTimezone: true }),
    decisaoMotivo: text("decisao_motivo"),
    estornoMotivo: text("estorno_motivo"),
    estornadoPorNome: text("estornado_por_nome"),
    estornadoEm: timestamp("estornado_em", { withTimezone: true }),
    criadoPorRotulo: text("criado_por_rotulo").notNull(),
    exemplo: exemplo(),
    criadoEm: criadoEm(),
  },
  (t) => [index("despesas_cond_idx").on(t.organizacaoId, t.condominioId, t.estado)],
);

/* --------------------------- Documentos e dúvidas --------------------------- */

export const documentos = pgTable(
  "documentos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    tipo: text("tipo").$type<"convencao" | "regimento" | "ata" | "contrato" | "apolice" | "laudo" | "outro">().notNull(),
    titulo: text("titulo").notNull(),
    arquivoId: uuid("arquivo_id").references(() => arquivos.id, { onDelete: "set null" }),
    texto: text("texto"),
    visivelMoradores: boolean("visivel_moradores").notNull().default(false),
    usarNasRespostas: boolean("usar_nas_respostas").notNull().default(false),
    divisaoConferidaPorNome: text("divisao_conferida_por_nome"),
    divisaoConferidaEm: timestamp("divisao_conferida_em", { withTimezone: true }),
    tokensEstimados: integer("tokens_estimados").notNull().default(0),
    criadoPorRotulo: text("criado_por_rotulo").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index("documentos_cond_idx").on(t.organizacaoId, t.condominioId)],
);

export const trechos = pgTable(
  "trechos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    documentoId: uuid("documento_id").references(() => documentos.id, { onDelete: "cascade" }),
    rotulo: text("rotulo").notNull(),
    texto: text("texto").notNull(),
    ordem: integer("ordem").notNull().default(0),
    revisarDadoPessoal: boolean("revisar_dado_pessoal").notNull().default(false),
    origem: text("origem").$type<"documento" | "resposta_sindico">().notNull().default("documento"),
    autorRotulo: text("autor_rotulo"),
    criadoEm: criadoEm(),
  },
  (t) => [index("trechos_cond_idx").on(t.organizacaoId, t.condominioId)],
);

export type EstadoDuvida = "aguardando_envio" | "respondida_documentos" | "encaminhada" | "respondida_sindico" | "desviada";
export type Citacao = { trechoId: string; rotulo: string; textoLiteral: string };

export const duvidas = pgTable(
  "duvidas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    pergunta: text("pergunta").notNull(),
    estado: text("estado").$type<EstadoDuvida>().notNull(),
    resposta: text("resposta"),
    origemResposta: text("origem_resposta").$type<"ia" | "sindico">(),
    citacoes: jsonb("citacoes").$type<Citacao[]>(),
    pedeDecisao: boolean("pede_decisao").notNull().default(false),
    motivoEncaminhamento: text("motivo_encaminhamento"),
    assumidaEm: timestamp("assumida_em", { withTimezone: true }),
    respondidaPorNome: text("respondida_por_nome"),
    respondidaEm: timestamp("respondida_em", { withTimezone: true }),
    enviadaEm: timestamp("enviada_em", { withTimezone: true }),
    salvaComoTrechoId: uuid("salva_como_trecho_id"),
    aiRunId: uuid("ai_run_id"),
    exemplo: exemplo(),
    criadoEm: criadoEm(),
  },
  (t) => [index("duvidas_cond_idx").on(t.organizacaoId, t.condominioId, t.estado)],
);

/* --------------------------- Comunicados --------------------------- */

export const comunicados = pgTable(
  "comunicados",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    topicos: text("topicos"),
    titulo: text("titulo").notNull(),
    texto: text("texto").notNull(),
    origemTexto: text("origem_texto").$type<"ia" | "sindico">().notNull().default("sindico"),
    estado: text("estado").$type<"rascunho" | "enviado">().notNull().default("rascunho"),
    publico: text("publico").$type<"moradores" | "todos" | "bloco">().notNull().default("moradores"),
    publicoValor: text("publico_valor"),
    aprovadoPorNome: text("aprovado_por_nome"),
    aprovadoEm: timestamp("aprovado_em", { withTimezone: true }),
    enviadoEm: timestamp("enviado_em", { withTimezone: true }),
    exemplo: exemplo(),
    criadoEm: criadoEm(),
  },
  (t) => [index("comunicados_cond_idx").on(t.organizacaoId, t.condominioId)],
);

export const comunicadoEntregas = pgTable(
  "comunicado_entregas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    comunicadoId: uuid("comunicado_id")
      .notNull()
      .references(() => comunicados.id, { onDelete: "cascade" }),
    pessoaId: uuid("pessoa_id").references(() => pessoas.id, { onDelete: "set null" }),
    envioId: uuid("envio_id"),
    lidoEm: timestamp("lido_em", { withTimezone: true }),
    exemplo: exemplo(),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("comunicado_entregas_uq").on(t.comunicadoId, t.pessoaId)],
);

/* --------------------------- Alertas, resumos, IA, filas, valor --------------------------- */

/** Alerta → ação registrada → fecha quando o fato muda. `chave` evita repetir o mesmo alerta. */
export const alertas = pgTable(
  "alertas",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    tipo: text("tipo").notNull(),
    refId: text("ref_id"),
    chave: text("chave").notNull(),
    fatos: jsonb("fatos").$type<Record<string, unknown>>(),
    abertoEm: timestamp("aberto_em", { withTimezone: true }).notNull().defaultNow(),
    acao: text("acao"),
    acaoPorNome: text("acao_por_nome"),
    acaoEm: timestamp("acao_em", { withTimezone: true }),
    fechadoEm: timestamp("fechado_em", { withTimezone: true }),
  },
  (t) => [uniqueIndex("alertas_chave_uq").on(t.chave), index("alertas_cond_idx").on(t.organizacaoId, t.condominioId)],
);

export const resumos = pgTable(
  "resumos",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    condominioId: cond(),
    data: dia("data").notNull(),
    fatos: jsonb("fatos"),
    texto: text("texto").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [uniqueIndex("resumos_uq").on(t.condominioId, t.data)],
);

export const aiRuns = pgTable(
  "ai_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    organizacaoId: org(),
    funcao: text("funcao").notNull(),
    modelo: text("modelo"),
    inputHash: text("input_hash").notNull(),
    tokensEntrada: integer("tokens_entrada").notNull().default(0),
    tokensSaida: integer("tokens_saida").notNull().default(0),
    /** Custo em milionésimos de dólar. */
    custoMicroUsd: integer("custo_micro_usd").notNull().default(0),
    status: text("status").$type<"ok" | "invalido" | "cortado" | "erro">().notNull(),
    baseLegal: text("base_legal"),
    saida: jsonb("saida"),
    criadoEm: criadoEm(),
  },
  (t) => [index("ai_runs_org_idx").on(t.organizacaoId, t.criadoEm), index("ai_runs_hash_idx").on(t.organizacaoId, t.funcao, t.inputHash)],
);

/** Trabalho do cron dividido em itens (um por condomínio), com reserva e idempotência por chave. */
export const filaTrabalho = pgTable("fila_trabalho", {
  id: uuid("id").primaryKey().defaultRandom(),
  tipo: text("tipo").notNull(),
  refId: uuid("ref_id"),
  chave: text("chave").notNull(),
  travadoAte: timestamp("travado_ate", { withTimezone: true }),
  tentativas: integer("tentativas").notNull().default(0),
  feitoEm: timestamp("feito_em", { withTimezone: true }),
  erro: text("erro"),
  criadoEm: criadoEm(),
}, (t) => [uniqueIndex("fila_trabalho_chave_uq").on(t.chave)]);

export const parametrosValor = pgTable("parametros_valor", {
  organizacaoId: uuid("organizacao_id")
    .primaryKey()
    .references(() => organizacoes.id, { onDelete: "cascade" }),
  minutosPorDuvida: integer("minutos_por_duvida").notNull().default(4),
  minutosPorDocumentoLido: integer("minutos_por_documento_lido").notNull().default(5),
  valorHoraCentavos: integer("valor_hora_centavos").notNull().default(8000),
  versao: integer("versao").notNull().default(1),
  atualizadoEm: atualizadoEm(),
});

export const exportacoes = pgTable("exportacoes", {
  id: uuid("id").primaryKey().defaultRandom(),
  organizacaoId: org(),
  arquivoChave: text("arquivo_chave").notNull(),
  tamanho: integer("tamanho").notNull(),
  expiraEm: timestamp("expira_em", { withTimezone: true }).notNull(),
  pedidoPorRotulo: text("pedido_por_rotulo").notNull(),
  criadoEm: criadoEm(),
});
