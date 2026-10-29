CREATE TABLE "acesso_condominios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"usuario_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"papel" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"funcao" text NOT NULL,
	"modelo" text,
	"input_hash" text NOT NULL,
	"tokens_entrada" integer DEFAULT 0 NOT NULL,
	"tokens_saida" integer DEFAULT 0 NOT NULL,
	"custo_micro_usd" integer DEFAULT 0 NOT NULL,
	"status" text NOT NULL,
	"base_legal" text,
	"saida" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "alertas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"ref_id" text,
	"chave" text NOT NULL,
	"fatos" jsonb,
	"aberto_em" timestamp with time zone DEFAULT now() NOT NULL,
	"acao" text,
	"acao_por_nome" text,
	"acao_em" timestamp with time zone,
	"fechado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "auditoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid,
	"ator" text NOT NULL,
	"acao" text NOT NULL,
	"alvo" text,
	"detalhe" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chamado_eventos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"chamado_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"texto" text,
	"autor_pessoa_id" uuid,
	"autor_usuario_id" uuid,
	"autor_rotulo" text NOT NULL,
	"arquivo_ids" jsonb,
	"corrige_evento_id" uuid,
	"exemplo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chamados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"numero" integer NOT NULL,
	"natureza" text DEFAULT 'manutencao' NOT NULL,
	"origem" text NOT NULL,
	"aberto_por_pessoa_id" uuid,
	"aberto_por_usuario_id" uuid,
	"unidade_id" uuid,
	"descricao" text NOT NULL,
	"categoria" text DEFAULT 'outra' NOT NULL,
	"categoria_origem" text DEFAULT 'regra' NOT NULL,
	"urgencia" text DEFAULT 'media' NOT NULL,
	"urgencia_motivo" text,
	"emergencia_grupo" text,
	"estado" text DEFAULT 'novo' NOT NULL,
	"responsavel_pessoa_id" uuid,
	"prestador_id" uuid,
	"agendado_para" timestamp with time zone,
	"resolvido_na_entrada" boolean DEFAULT false NOT NULL,
	"vencimento_id" uuid,
	"passo_autoajuda_id" uuid,
	"pergunta_esclarecimento" text,
	"resumo_ia" text,
	"justificativa_prestador" text,
	"reaberturas" integer DEFAULT 0 NOT NULL,
	"media_group_id" text,
	"aberto_em" timestamp with time zone DEFAULT now() NOT NULL,
	"resolvido_em" timestamp with time zone,
	"encerrado_em" timestamp with time zone,
	"motivo_encerramento" text,
	"exemplo" boolean DEFAULT false NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comunicado_entregas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"comunicado_id" uuid NOT NULL,
	"pessoa_id" uuid,
	"envio_id" uuid,
	"lido_em" timestamp with time zone,
	"exemplo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comunicados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"topicos" text,
	"titulo" text NOT NULL,
	"texto" text NOT NULL,
	"origem_texto" text DEFAULT 'sindico' NOT NULL,
	"estado" text DEFAULT 'rascunho' NOT NULL,
	"publico" text DEFAULT 'moradores' NOT NULL,
	"publico_valor" text,
	"aprovado_por_nome" text,
	"aprovado_em" timestamp with time zone,
	"enviado_em" timestamp with time zone,
	"exemplo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "contatos_sindico" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"pessoa_id" uuid,
	"origem_tipo" text NOT NULL,
	"origem_id" uuid NOT NULL,
	"assumido_em" timestamp with time zone,
	"assumido_por_nome" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversa_estados" (
	"chat_id" bigint PRIMARY KEY NOT NULL,
	"pessoa_id" uuid,
	"aguardando" text NOT NULL,
	"ref_id" text,
	"dados" jsonb,
	"expira_em" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "despesas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"estado" text DEFAULT 'para_conferir' NOT NULL,
	"tipo_documento" text DEFAULT 'recibo' NOT NULL,
	"fornecedor_nome" text,
	"cnpj" text,
	"prestador_id" uuid,
	"data_emissao" text,
	"vencimento" text,
	"valor_centavos" bigint,
	"descricao" text,
	"categoria" text DEFAULT 'outros' NOT NULL,
	"linha_digitavel" text,
	"banco_emissor" text,
	"valor_linha_centavos" bigint,
	"vencimento_linha" text,
	"beneficiario_impresso_nome" text,
	"beneficiario_impresso_cnpj" text,
	"beneficiario_conferido_por_nome" text,
	"beneficiario_conferido_em" timestamp with time zone,
	"conferencia" jsonb,
	"divergencias" jsonb,
	"arquivo_id" uuid,
	"origem" text DEFAULT 'manual' NOT NULL,
	"leitura_ia" jsonb,
	"conferido_por_nome" text,
	"conferido_em" timestamp with time zone,
	"aprovado_por_nome" text,
	"aprovado_em" timestamp with time zone,
	"decisao_motivo" text,
	"estorno_motivo" text,
	"estornado_por_nome" text,
	"estornado_em" timestamp with time zone,
	"criado_por_rotulo" text NOT NULL,
	"exemplo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"titulo" text NOT NULL,
	"arquivo_id" uuid,
	"texto" text,
	"visivel_moradores" boolean DEFAULT false NOT NULL,
	"usar_nas_respostas" boolean DEFAULT false NOT NULL,
	"divisao_conferida_por_nome" text,
	"divisao_conferida_em" timestamp with time zone,
	"tokens_estimados" integer DEFAULT 0 NOT NULL,
	"criado_por_rotulo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "duvidas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"pessoa_id" uuid,
	"pergunta" text NOT NULL,
	"estado" text NOT NULL,
	"resposta" text,
	"origem_resposta" text,
	"citacoes" jsonb,
	"pede_decisao" boolean DEFAULT false NOT NULL,
	"motivo_encaminhamento" text,
	"assumida_em" timestamp with time zone,
	"respondida_por_nome" text,
	"respondida_em" timestamp with time zone,
	"enviada_em" timestamp with time zone,
	"salva_como_trecho_id" uuid,
	"ai_run_id" uuid,
	"exemplo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emissores_certidao" (
	"tipo" text PRIMARY KEY NOT NULL,
	"nome" text NOT NULL,
	"url" text NOT NULL,
	"conferido_em" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exportacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"arquivo_chave" text NOT NULL,
	"tamanho" integer NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"pedido_por_rotulo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "fila_trabalho" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tipo" text NOT NULL,
	"ref_id" uuid,
	"chave" text NOT NULL,
	"travado_ate" timestamp with time zone,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"feito_em" timestamp with time zone,
	"erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mudancas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"unidade_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"data" text NOT NULL,
	"pessoa_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"origem" text DEFAULT 'painel' NOT NULL,
	"estado" text DEFAULT 'confirmada' NOT NULL,
	"registrada_por_rotulo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "palavras_emergencia_extra" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"grupo" text NOT NULL,
	"expressao" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "parametros_valor" (
	"organizacao_id" uuid PRIMARY KEY NOT NULL,
	"minutos_por_duvida" integer DEFAULT 4 NOT NULL,
	"minutos_por_documento_lido" integer DEFAULT 5 NOT NULL,
	"valor_hora_centavos" integer DEFAULT 8000 NOT NULL,
	"versao" integer DEFAULT 1 NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "passos_autoajuda" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"categoria" text NOT NULL,
	"titulo" text NOT NULL,
	"texto" text NOT NULL,
	"aprovado_por_nome" text NOT NULL,
	"aprovado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prestador_condominios" (
	"prestador_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	CONSTRAINT "prestador_condominios_prestador_id_condominio_id_pk" PRIMARY KEY("prestador_id","condominio_id")
);
--> statement-breakpoint
CREATE TABLE "prestador_documentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"prestador_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"titular_cnpj" text,
	"emitido_em" text,
	"validade" text,
	"arquivo_id" uuid,
	"origem_leitura" text DEFAULT 'manual' NOT NULL,
	"leitura_ia" jsonb,
	"estado" text DEFAULT 'para_conferir' NOT NULL,
	"enviado_por" text DEFAULT 'painel' NOT NULL,
	"conferido_por_nome" text,
	"conferido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prestador_pagamentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"prestador_id" uuid NOT NULL,
	"tipo" text NOT NULL,
	"dados_cifrados" text NOT NULL,
	"resumo" text NOT NULL,
	"alterado_por_rotulo" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prestadores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"razao_social" text NOT NULL,
	"cnpj" text,
	"situacao_cadastral" text,
	"consultado_em" timestamp with time zone,
	"categorias" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"contato" text,
	"telefone" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regras_categoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"categoria" text NOT NULL,
	"urgencia_padrao" text NOT NULL,
	"prazo_horas" integer DEFAULT 72 NOT NULL,
	"responsavel_pessoa_id" uuid,
	"responsavel_prestador_id" uuid,
	"ativa" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "resumos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"data" text NOT NULL,
	"fatos" jsonb,
	"texto" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rotina_itens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"modelo_id" uuid NOT NULL,
	"pessoa_id" uuid,
	"posto" text,
	"data" text NOT NULL,
	"estado" text DEFAULT 'previsto' NOT NULL,
	"motivo" text,
	"arquivo_id" uuid,
	"foto_recebida_em" timestamp with time zone,
	"marcado_por_pessoa_id" uuid,
	"enviado_em" timestamp with time zone,
	"exemplo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rotina_modelos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"pessoa_id" uuid,
	"funcao" text,
	"posto" text,
	"rotina_do_posto" boolean DEFAULT false NOT NULL,
	"item" text NOT NULL,
	"instrucao" text,
	"periodicidade" text NOT NULL,
	"dias_semana" jsonb,
	"dia_mes" integer,
	"periodo_rotulo" text DEFAULT 'manha' NOT NULL,
	"hora_limite" text,
	"foto_obrigatoria" boolean DEFAULT false NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "servicos_registrados" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"vencimento_id" uuid NOT NULL,
	"data_servico" text,
	"validade_impressa" text,
	"prestador_id" uuid,
	"arquivo_id" uuid,
	"origem_leitura" text DEFAULT 'manual' NOT NULL,
	"leitura_ia" jsonb,
	"estado" text DEFAULT 'para_conferir' NOT NULL,
	"proximo_anterior" text,
	"proximo_calculado" text,
	"dentro_do_prazo" boolean,
	"chamado_id" uuid,
	"conferido_por_nome" text,
	"conferido_em" timestamp with time zone,
	"exemplo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_albuns" (
	"media_group_id" text PRIMARY KEY NOT NULL,
	"chat_id" bigint NOT NULL,
	"pessoa_id" uuid,
	"arquivo_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"legenda" text,
	"primeiro_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "telegram_contas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_id" bigint NOT NULL,
	"telegram_user_id" bigint NOT NULL,
	"username" text,
	"nome" text,
	"contexto_pessoa_id" uuid,
	"bot_bloqueado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trechos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"documento_id" uuid,
	"rotulo" text NOT NULL,
	"texto" text NOT NULL,
	"ordem" integer DEFAULT 0 NOT NULL,
	"revisar_dado_pessoal" boolean DEFAULT false NOT NULL,
	"origem" text DEFAULT 'documento' NOT NULL,
	"autor_rotulo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "unidades" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"bloco" text DEFAULT '' NOT NULL,
	"numero" text NOT NULL,
	"andar" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vencimento_modelos" (
	"chave" text NOT NULL,
	"versao" integer NOT NULL,
	"nome" text NOT NULL,
	"referencia_informada" text NOT NULL,
	"periodicidade_meses" integer,
	"usa_validade_impressa" boolean DEFAULT false NOT NULL,
	"varia_por_local" boolean DEFAULT false NOT NULL,
	"nota_confira" text,
	"ativo_por_padrao" boolean DEFAULT true NOT NULL,
	"fonte" text,
	"fonte_data" text,
	CONSTRAINT "vencimento_modelos_chave_versao_pk" PRIMARY KEY("chave","versao")
);
--> statement-breakpoint
CREATE TABLE "vencimentos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"modelo_chave" text,
	"modelo_versao" integer,
	"nome" text NOT NULL,
	"referencia_informada" text,
	"varia_por_local" boolean DEFAULT false NOT NULL,
	"nota_confira" text,
	"periodicidade_meses" integer,
	"usa_validade_impressa" boolean DEFAULT false NOT NULL,
	"proximo" text,
	"estado_conferencia" text DEFAULT 'nao_conferido' NOT NULL,
	"conferido_por_nome" text,
	"conferido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "pessoas_telegram_chat_uq";--> statement-breakpoint
ALTER TABLE "arquivos" ADD COLUMN "sha256" text;--> statement-breakpoint
ALTER TABLE "arquivos" ADD COLUMN "recebido_como" text;--> statement-breakpoint
ALTER TABLE "arquivos" ADD COLUMN "exemplo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "cep" text;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "is_demo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "endereco_ficticio" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "alcada_despesa_centavos" bigint;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "mensagens_seguranca" jsonb;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "modo_resposta_duvida" text DEFAULT 'conferencia' NOT NULL;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "contato_emergencia_nome" text;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "contato_emergencia_telefone" text;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "janela_inicio" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "janela_fim" integer DEFAULT 18 NOT NULL;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "horas_confirmacao_chamado" integer DEFAULT 72 NOT NULL;--> statement-breakpoint
ALTER TABLE "condominios" ADD COLUMN "purga_fotos_rotina_dias" integer DEFAULT 90 NOT NULL;--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "direto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "nao_antes_de" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "envios" ADD COLUMN "travado_ate" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "organizacoes" ADD COLUMN "limite_ia_usd" integer DEFAULT 5 NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "telegram_conta_id" uuid;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "unidade_id" uuid;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "prestador_id" uuid;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "usuario_id" uuid;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "funcao" text;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "posto" text;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "empregador" text;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "empresa_contratada" text;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "contato_plantao" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "celular_do_posto" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "aceitou_termo_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "revogada_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "exemplo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "sem_telegram" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "provisoria" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "relacao_unidade" text;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "saiu_em" text;--> statement-breakpoint
ALTER TABLE "pessoas" ADD COLUMN "removida_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "telegram_convites" ADD COLUMN "motivo_revogacao" text;--> statement-breakpoint
ALTER TABLE "telegram_convites" ADD COLUMN "lote_id" uuid;--> statement-breakpoint
ALTER TABLE "acesso_condominios" ADD CONSTRAINT "acesso_condominios_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acesso_condominios" ADD CONSTRAINT "acesso_condominios_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "acesso_condominios" ADD CONSTRAINT "acesso_condominios_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_runs" ADD CONSTRAINT "ai_runs_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alertas" ADD CONSTRAINT "alertas_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamado_eventos" ADD CONSTRAINT "chamado_eventos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamado_eventos" ADD CONSTRAINT "chamado_eventos_chamado_id_chamados_id_fk" FOREIGN KEY ("chamado_id") REFERENCES "public"."chamados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamado_eventos" ADD CONSTRAINT "chamado_eventos_autor_pessoa_id_pessoas_id_fk" FOREIGN KEY ("autor_pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamado_eventos" ADD CONSTRAINT "chamado_eventos_autor_usuario_id_usuarios_id_fk" FOREIGN KEY ("autor_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_aberto_por_pessoa_id_pessoas_id_fk" FOREIGN KEY ("aberto_por_pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_aberto_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("aberto_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_unidade_id_unidades_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_responsavel_pessoa_id_pessoas_id_fk" FOREIGN KEY ("responsavel_pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamados" ADD CONSTRAINT "chamados_prestador_id_prestadores_id_fk" FOREIGN KEY ("prestador_id") REFERENCES "public"."prestadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comunicado_entregas" ADD CONSTRAINT "comunicado_entregas_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comunicado_entregas" ADD CONSTRAINT "comunicado_entregas_comunicado_id_comunicados_id_fk" FOREIGN KEY ("comunicado_id") REFERENCES "public"."comunicados"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comunicado_entregas" ADD CONSTRAINT "comunicado_entregas_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "comunicados" ADD CONSTRAINT "comunicados_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos_sindico" ADD CONSTRAINT "contatos_sindico_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos_sindico" ADD CONSTRAINT "contatos_sindico_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "contatos_sindico" ADD CONSTRAINT "contatos_sindico_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversa_estados" ADD CONSTRAINT "conversa_estados_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_prestador_id_prestadores_id_fk" FOREIGN KEY ("prestador_id") REFERENCES "public"."prestadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "despesas" ADD CONSTRAINT "despesas_arquivo_id_arquivos_id_fk" FOREIGN KEY ("arquivo_id") REFERENCES "public"."arquivos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documentos" ADD CONSTRAINT "documentos_arquivo_id_arquivos_id_fk" FOREIGN KEY ("arquivo_id") REFERENCES "public"."arquivos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duvidas" ADD CONSTRAINT "duvidas_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duvidas" ADD CONSTRAINT "duvidas_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "duvidas" ADD CONSTRAINT "duvidas_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exportacoes" ADD CONSTRAINT "exportacoes_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mudancas" ADD CONSTRAINT "mudancas_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mudancas" ADD CONSTRAINT "mudancas_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mudancas" ADD CONSTRAINT "mudancas_unidade_id_unidades_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palavras_emergencia_extra" ADD CONSTRAINT "palavras_emergencia_extra_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "palavras_emergencia_extra" ADD CONSTRAINT "palavras_emergencia_extra_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "parametros_valor" ADD CONSTRAINT "parametros_valor_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passos_autoajuda" ADD CONSTRAINT "passos_autoajuda_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "passos_autoajuda" ADD CONSTRAINT "passos_autoajuda_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_condominios" ADD CONSTRAINT "prestador_condominios_prestador_id_prestadores_id_fk" FOREIGN KEY ("prestador_id") REFERENCES "public"."prestadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_condominios" ADD CONSTRAINT "prestador_condominios_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_documentos" ADD CONSTRAINT "prestador_documentos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_documentos" ADD CONSTRAINT "prestador_documentos_prestador_id_prestadores_id_fk" FOREIGN KEY ("prestador_id") REFERENCES "public"."prestadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_documentos" ADD CONSTRAINT "prestador_documentos_arquivo_id_arquivos_id_fk" FOREIGN KEY ("arquivo_id") REFERENCES "public"."arquivos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_pagamentos" ADD CONSTRAINT "prestador_pagamentos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestador_pagamentos" ADD CONSTRAINT "prestador_pagamentos_prestador_id_prestadores_id_fk" FOREIGN KEY ("prestador_id") REFERENCES "public"."prestadores"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prestadores" ADD CONSTRAINT "prestadores_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_categoria" ADD CONSTRAINT "regras_categoria_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_categoria" ADD CONSTRAINT "regras_categoria_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_categoria" ADD CONSTRAINT "regras_categoria_responsavel_pessoa_id_pessoas_id_fk" FOREIGN KEY ("responsavel_pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "regras_categoria" ADD CONSTRAINT "regras_categoria_responsavel_prestador_id_prestadores_id_fk" FOREIGN KEY ("responsavel_prestador_id") REFERENCES "public"."prestadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumos" ADD CONSTRAINT "resumos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumos" ADD CONSTRAINT "resumos_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_itens" ADD CONSTRAINT "rotina_itens_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_itens" ADD CONSTRAINT "rotina_itens_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_itens" ADD CONSTRAINT "rotina_itens_modelo_id_rotina_modelos_id_fk" FOREIGN KEY ("modelo_id") REFERENCES "public"."rotina_modelos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_itens" ADD CONSTRAINT "rotina_itens_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_itens" ADD CONSTRAINT "rotina_itens_arquivo_id_arquivos_id_fk" FOREIGN KEY ("arquivo_id") REFERENCES "public"."arquivos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_itens" ADD CONSTRAINT "rotina_itens_marcado_por_pessoa_id_pessoas_id_fk" FOREIGN KEY ("marcado_por_pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_modelos" ADD CONSTRAINT "rotina_modelos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_modelos" ADD CONSTRAINT "rotina_modelos_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rotina_modelos" ADD CONSTRAINT "rotina_modelos_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_registrados" ADD CONSTRAINT "servicos_registrados_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_registrados" ADD CONSTRAINT "servicos_registrados_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_registrados" ADD CONSTRAINT "servicos_registrados_vencimento_id_vencimentos_id_fk" FOREIGN KEY ("vencimento_id") REFERENCES "public"."vencimentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_registrados" ADD CONSTRAINT "servicos_registrados_prestador_id_prestadores_id_fk" FOREIGN KEY ("prestador_id") REFERENCES "public"."prestadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "servicos_registrados" ADD CONSTRAINT "servicos_registrados_arquivo_id_arquivos_id_fk" FOREIGN KEY ("arquivo_id") REFERENCES "public"."arquivos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_albuns" ADD CONSTRAINT "telegram_albuns_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trechos" ADD CONSTRAINT "trechos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trechos" ADD CONSTRAINT "trechos_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trechos" ADD CONSTRAINT "trechos_documento_id_documentos_id_fk" FOREIGN KEY ("documento_id") REFERENCES "public"."documentos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "unidades" ADD CONSTRAINT "unidades_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vencimentos" ADD CONSTRAINT "vencimentos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vencimentos" ADD CONSTRAINT "vencimentos_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "acesso_condominios_uq" ON "acesso_condominios" USING btree ("usuario_id","condominio_id");--> statement-breakpoint
CREATE INDEX "acesso_condominios_org_idx" ON "acesso_condominios" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "ai_runs_org_idx" ON "ai_runs" USING btree ("organizacao_id","criado_em");--> statement-breakpoint
CREATE INDEX "ai_runs_hash_idx" ON "ai_runs" USING btree ("organizacao_id","funcao","input_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "alertas_chave_uq" ON "alertas" USING btree ("chave");--> statement-breakpoint
CREATE INDEX "alertas_cond_idx" ON "alertas" USING btree ("organizacao_id","condominio_id");--> statement-breakpoint
CREATE INDEX "auditoria_org_idx" ON "auditoria" USING btree ("organizacao_id","criado_em");--> statement-breakpoint
CREATE INDEX "chamado_eventos_chamado_idx" ON "chamado_eventos" USING btree ("chamado_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "chamados_numero_uq" ON "chamados" USING btree ("condominio_id","numero");--> statement-breakpoint
CREATE INDEX "chamados_org_idx" ON "chamados" USING btree ("organizacao_id","condominio_id","estado");--> statement-breakpoint
CREATE UNIQUE INDEX "comunicado_entregas_uq" ON "comunicado_entregas" USING btree ("comunicado_id","pessoa_id");--> statement-breakpoint
CREATE INDEX "comunicados_cond_idx" ON "comunicados" USING btree ("organizacao_id","condominio_id");--> statement-breakpoint
CREATE INDEX "despesas_cond_idx" ON "despesas" USING btree ("organizacao_id","condominio_id","estado");--> statement-breakpoint
CREATE INDEX "documentos_cond_idx" ON "documentos" USING btree ("organizacao_id","condominio_id");--> statement-breakpoint
CREATE INDEX "duvidas_cond_idx" ON "duvidas" USING btree ("organizacao_id","condominio_id","estado");--> statement-breakpoint
CREATE UNIQUE INDEX "fila_trabalho_chave_uq" ON "fila_trabalho" USING btree ("chave");--> statement-breakpoint
CREATE INDEX "mudancas_unidade_idx" ON "mudancas" USING btree ("unidade_id");--> statement-breakpoint
CREATE INDEX "passos_autoajuda_cond_idx" ON "passos_autoajuda" USING btree ("condominio_id");--> statement-breakpoint
CREATE INDEX "prestador_documentos_idx" ON "prestador_documentos" USING btree ("organizacao_id","prestador_id");--> statement-breakpoint
CREATE INDEX "prestador_pagamentos_idx" ON "prestador_pagamentos" USING btree ("prestador_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "prestadores_cnpj_uq" ON "prestadores" USING btree ("organizacao_id","cnpj");--> statement-breakpoint
CREATE UNIQUE INDEX "regras_categoria_uq" ON "regras_categoria" USING btree ("condominio_id","categoria");--> statement-breakpoint
CREATE UNIQUE INDEX "resumos_uq" ON "resumos" USING btree ("condominio_id","data");--> statement-breakpoint
CREATE UNIQUE INDEX "rotina_itens_uq" ON "rotina_itens" USING btree ("modelo_id","data");--> statement-breakpoint
CREATE INDEX "rotina_itens_cond_idx" ON "rotina_itens" USING btree ("organizacao_id","condominio_id","data");--> statement-breakpoint
CREATE INDEX "rotina_modelos_cond_idx" ON "rotina_modelos" USING btree ("organizacao_id","condominio_id");--> statement-breakpoint
CREATE INDEX "servicos_registrados_cond_idx" ON "servicos_registrados" USING btree ("organizacao_id","condominio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_contas_chat_uq" ON "telegram_contas" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "telegram_contas_user_idx" ON "telegram_contas" USING btree ("telegram_user_id");--> statement-breakpoint
CREATE INDEX "trechos_cond_idx" ON "trechos" USING btree ("organizacao_id","condominio_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unidades_uq" ON "unidades" USING btree ("condominio_id","bloco","numero");--> statement-breakpoint
CREATE INDEX "unidades_org_idx" ON "unidades" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "vencimentos_cond_idx" ON "vencimentos" USING btree ("condominio_id","proximo");--> statement-breakpoint
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_telegram_conta_id_telegram_contas_id_fk" FOREIGN KEY ("telegram_conta_id") REFERENCES "public"."telegram_contas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_unidade_id_unidades_id_fk" FOREIGN KEY ("unidade_id") REFERENCES "public"."unidades"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_prestador_id_prestadores_id_fk" FOREIGN KEY ("prestador_id") REFERENCES "public"."prestadores"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "pessoas_telegram_chat_idx" ON "pessoas" USING btree ("telegram_chat_id");--> statement-breakpoint
-- Registros só de inserção. A única exceção é o pedido de apagar dados pessoais (LGPD),
-- feito numa transação com SET LOCAL app.lgpd = 'on' (só UPDATE, nunca DELETE).
CREATE OR REPLACE FUNCTION recusar_alteracao() RETURNS trigger AS $$
BEGIN
  IF current_setting('app.lgpd', true) = 'on' AND TG_OP = 'UPDATE' THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Registro só de inserção (%): % não é permitido', TG_TABLE_NAME, TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER auditoria_so_insercao BEFORE UPDATE OR DELETE ON "auditoria" FOR EACH ROW EXECUTE FUNCTION recusar_alteracao();
--> statement-breakpoint
CREATE TRIGGER chamado_eventos_so_insercao BEFORE UPDATE OR DELETE ON "chamado_eventos" FOR EACH ROW EXECUTE FUNCTION recusar_alteracao();
--> statement-breakpoint
CREATE TRIGGER prestador_pagamentos_so_insercao BEFORE UPDATE OR DELETE ON "prestador_pagamentos" FOR EACH ROW EXECUTE FUNCTION recusar_alteracao();
--> statement-breakpoint
CREATE TRIGGER mudancas_so_insercao BEFORE UPDATE OR DELETE ON "mudancas" FOR EACH ROW EXECUTE FUNCTION recusar_alteracao();
--> statement-breakpoint
-- Chamados não se apagam (correção = novo evento).
CREATE OR REPLACE FUNCTION recusar_exclusao() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Registro não pode ser apagado (%): use estorno ou novo evento', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER chamados_sem_exclusao BEFORE DELETE ON "chamados" FOR EACH ROW EXECUTE FUNCTION recusar_exclusao();
--> statement-breakpoint
-- Despesas: nada se apaga; lançada só vira "estornada" com motivo, sem mudar outro campo.
CREATE OR REPLACE FUNCTION proteger_despesa() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.estado IN ('lancada', 'estornada', 'recusada', 'aguardando_aprovacao') THEN
      RAISE EXCEPTION 'Despesa % não pode ser apagada: faça um estorno com motivo', OLD.estado;
    END IF;
    RETURN OLD;
  END IF;
  IF current_setting('app.lgpd', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF OLD.estado = 'lancada' THEN
    IF NEW.estado <> 'estornada' OR coalesce(trim(NEW.estorno_motivo), '') = ''
       OR NEW.valor_centavos IS DISTINCT FROM OLD.valor_centavos
       OR NEW.fornecedor_nome IS DISTINCT FROM OLD.fornecedor_nome
       OR NEW.categoria IS DISTINCT FROM OLD.categoria
       OR NEW.data_emissao IS DISTINCT FROM OLD.data_emissao THEN
      RAISE EXCEPTION 'Despesa lançada não muda: faça um estorno com motivo';
    END IF;
  END IF;
  IF OLD.estado IN ('recusada', 'estornada') AND NEW.estado IS DISTINCT FROM OLD.estado THEN
    RAISE EXCEPTION 'Despesa % não muda de estado', OLD.estado;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER despesas_protegidas BEFORE UPDATE OR DELETE ON "despesas" FOR EACH ROW EXECUTE FUNCTION proteger_despesa();
--> statement-breakpoint
-- Rotina: a hora da foto, depois de gravada, não muda (só a purga pode tirar o arquivo).
CREATE OR REPLACE FUNCTION proteger_foto_rotina() RETURNS trigger AS $$
BEGIN
  IF OLD.foto_recebida_em IS NOT NULL AND NEW.foto_recebida_em IS DISTINCT FROM OLD.foto_recebida_em AND current_setting('app.lgpd', true) IS DISTINCT FROM 'on' THEN
    RAISE EXCEPTION 'A hora da foto da tarefa não muda depois de gravada';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER rotina_itens_foto_protegida BEFORE UPDATE ON "rotina_itens" FOR EACH ROW EXECUTE FUNCTION proteger_foto_rotina();
--> statement-breakpoint
-- Vínculos existentes passam a ter conta do Telegram (uma conta, várias pessoas).
INSERT INTO "telegram_contas" ("chat_id", "telegram_user_id", "username", "nome", "contexto_pessoa_id")
SELECT DISTINCT ON ("telegram_chat_id") "telegram_chat_id", COALESCE("telegram_user_id", "telegram_chat_id"), "telegram_username", "telegram_nome", "id"
FROM "pessoas" WHERE "telegram_chat_id" IS NOT NULL
ON CONFLICT DO NOTHING;
--> statement-breakpoint
UPDATE "pessoas" p SET "telegram_conta_id" = c."id" FROM "telegram_contas" c WHERE p."telegram_chat_id" = c."chat_id";
