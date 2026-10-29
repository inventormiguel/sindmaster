CREATE TABLE "arquivos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid,
	"pessoa_id" uuid,
	"origem" text NOT NULL,
	"nome_original" text NOT NULL,
	"mime_type" text NOT NULL,
	"tamanho_bytes" integer NOT NULL,
	"provedor" text NOT NULL,
	"chave" text NOT NULL,
	"telegram_file_id" text,
	"telegram_file_unique_id" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "condominios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"cnpj" text,
	"endereco" text,
	"cidade" text,
	"uf" text,
	"total_unidades" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cron_execucoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job" text NOT NULL,
	"origem" text NOT NULL,
	"status" text NOT NULL,
	"resumo" jsonb,
	"erro" text,
	"iniciado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"terminado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "envios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid,
	"pessoa_id" uuid,
	"chat_id" bigint,
	"categoria" text DEFAULT 'aviso' NOT NULL,
	"texto" text NOT NULL,
	"teclado" jsonb,
	"status" text DEFAULT 'pendente' NOT NULL,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"proxima_tentativa_em" timestamp with time zone DEFAULT now() NOT NULL,
	"erro" text,
	"telegram_message_id" bigint,
	"chave_idempotencia" text,
	"lote_id" uuid,
	"criado_por_usuario_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"enviado_em" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "integracoes_testes" (
	"servico" text PRIMARY KEY NOT NULL,
	"ok" boolean NOT NULL,
	"detalhe" text,
	"assinatura" text,
	"testado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "organizacoes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"nome" text NOT NULL,
	"tipo" text DEFAULT 'administradora' NOT NULL,
	"cnpj" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "pessoas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"papel" text NOT NULL,
	"unidade" text,
	"telefone" text,
	"telegram_chat_id" bigint,
	"telegram_user_id" bigint,
	"telegram_username" text,
	"telegram_nome" text,
	"vinculado_em" timestamp with time zone,
	"bot_bloqueado_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_convites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"condominio_id" uuid NOT NULL,
	"pessoa_id" uuid NOT NULL,
	"codigo_hash" text NOT NULL,
	"expira_em" timestamp with time zone NOT NULL,
	"usado_em" timestamp with time zone,
	"usado_por_telegram_user_id" bigint,
	"revogado_em" timestamp with time zone,
	"criado_por_usuario_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_mensagens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid,
	"condominio_id" uuid,
	"pessoa_id" uuid,
	"chat_id" bigint NOT NULL,
	"direcao" text NOT NULL,
	"tipo" text NOT NULL,
	"texto" text,
	"telegram_message_id" bigint,
	"update_id" bigint,
	"arquivo_id" uuid,
	"envio_id" uuid,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_updates" (
	"bot_id" bigint NOT NULL,
	"update_id" bigint NOT NULL,
	"tipo" text NOT NULL,
	"origem" text NOT NULL,
	"status" text DEFAULT 'recebido' NOT NULL,
	"payload" jsonb,
	"erro" text,
	"tentativas" integer DEFAULT 0 NOT NULL,
	"recebido_em" timestamp with time zone DEFAULT now() NOT NULL,
	"processado_em" timestamp with time zone,
	CONSTRAINT "telegram_updates_bot_id_update_id_pk" PRIMARY KEY("bot_id","update_id")
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organizacao_id" uuid NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"papel" text DEFAULT 'admin' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "arquivos" ADD CONSTRAINT "arquivos_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "condominios" ADD CONSTRAINT "condominios_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envios" ADD CONSTRAINT "envios_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envios" ADD CONSTRAINT "envios_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envios" ADD CONSTRAINT "envios_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "envios" ADD CONSTRAINT "envios_criado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pessoas" ADD CONSTRAINT "pessoas_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_convites" ADD CONSTRAINT "telegram_convites_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_convites" ADD CONSTRAINT "telegram_convites_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_convites" ADD CONSTRAINT "telegram_convites_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_convites" ADD CONSTRAINT "telegram_convites_criado_por_usuario_id_usuarios_id_fk" FOREIGN KEY ("criado_por_usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_mensagens" ADD CONSTRAINT "telegram_mensagens_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_mensagens" ADD CONSTRAINT "telegram_mensagens_condominio_id_condominios_id_fk" FOREIGN KEY ("condominio_id") REFERENCES "public"."condominios"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_mensagens" ADD CONSTRAINT "telegram_mensagens_pessoa_id_pessoas_id_fk" FOREIGN KEY ("pessoa_id") REFERENCES "public"."pessoas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_organizacao_id_organizacoes_id_fk" FOREIGN KEY ("organizacao_id") REFERENCES "public"."organizacoes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "arquivos_org_idx" ON "arquivos" USING btree ("organizacao_id","criado_em");--> statement-breakpoint
CREATE INDEX "condominios_org_idx" ON "condominios" USING btree ("organizacao_id");--> statement-breakpoint
CREATE INDEX "envios_fila_idx" ON "envios" USING btree ("status","proxima_tentativa_em");--> statement-breakpoint
CREATE INDEX "envios_org_idx" ON "envios" USING btree ("organizacao_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "envios_idempotencia_uq" ON "envios" USING btree ("chave_idempotencia");--> statement-breakpoint
CREATE UNIQUE INDEX "pessoas_telegram_chat_uq" ON "pessoas" USING btree ("telegram_chat_id");--> statement-breakpoint
CREATE INDEX "pessoas_condominio_papel_idx" ON "pessoas" USING btree ("condominio_id","papel");--> statement-breakpoint
CREATE INDEX "pessoas_org_idx" ON "pessoas" USING btree ("organizacao_id");--> statement-breakpoint
CREATE UNIQUE INDEX "telegram_convites_hash_uq" ON "telegram_convites" USING btree ("codigo_hash");--> statement-breakpoint
CREATE INDEX "telegram_convites_pessoa_idx" ON "telegram_convites" USING btree ("pessoa_id");--> statement-breakpoint
CREATE INDEX "telegram_mensagens_org_idx" ON "telegram_mensagens" USING btree ("organizacao_id","criado_em");--> statement-breakpoint
CREATE INDEX "telegram_mensagens_chat_idx" ON "telegram_mensagens" USING btree ("chat_id");--> statement-breakpoint
CREATE INDEX "telegram_updates_status_idx" ON "telegram_updates" USING btree ("status","recebido_em");--> statement-breakpoint
CREATE UNIQUE INDEX "usuarios_email_uq" ON "usuarios" USING btree ("email");--> statement-breakpoint
CREATE INDEX "usuarios_org_idx" ON "usuarios" USING btree ("organizacao_id");