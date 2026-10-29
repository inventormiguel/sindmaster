# Arquitetura

## Stack

Next.js 16 (App Router, `src/`, Turbopack) · TypeScript · Tailwind 4 · Drizzle ORM · Postgres (`DATABASE_URL`, postgres-js)
ou PGlite local (`.data/pglite`) · auth própria (bcryptjs + JWT HS256 em cookie httpOnly, `jose`) · `@anthropic-ai/sdk` 0.135.0 ·
`@vercel/blob` (opcional) · `qrcode` · Vitest.

## Pastas

```
src/
  lib/brand.ts              nome provisório, cores, User-Agent, credenciais demo (único lugar com o nome)
  lib/segredos.ts           segredo da instalação, segredos derivados (sessão, cron, webhook), comparação constante
  lib/url-publica.ts        endereço público atrás de proxy (X-Forwarded-*), APP_URL
  lib/auth/                 senha, token JWT, sessão, permissões do painel (pode/exigirPermissao)
  lib/telegram/             módulo Telegram (ver abaixo)
  lib/storage/              adaptador de arquivos: Vercel Blob privado ou .data/uploads
  lib/ia/anthropic.ts       cliente da IA (modelo + reserva, sem temperature/top_p/top_k)
  lib/integracoes.ts        "Testar conexão" e status real das integrações
  lib/cron/jobs.ts          rotinas agendadas e registro de geradores de lembretes
  config/navegacao.ts       menu lateral e módulos "em construção"
  db/schema.ts, db/index.ts, db/migrar.ts, db/seed/
  features/<modulo>/        ações de servidor e componentes de cada área (auth, condominios, telegram, integracoes)
  app/                      páginas e rotas (landing, login, cadastro, /app/*, /api/*)
  proxy.ts                  protege /app (antigo middleware)
scripts/                    setup-db, reset-db, telegram-polling, telegram-set-webhook, telegram-info, cron
tests/                      Vitest (roteador, webhook, convites, cliente da API, limitador, avisos, regras)
drizzle/                    migrações versionadas
```

## Modelo de dados (multi-tenant)

Toda tabela de dados tem `organizacao_id`, e toda consulta do painel filtra por ela; as do condomínio também têm
`condominio_id`, e o acesso de cada usuário é conferido por condomínio (`lib/negocio/acesso.ts`: admin vê todos;
síndico, equipe e conselho só os de `acesso_condominios`; id de fora devolve 404).

| Grupo | Tabelas |
|---|---|
| Base | `organizacoes`, `usuarios`, `condominios`, `pessoas`, `telegram_convites`, `telegram_updates`, `telegram_mensagens`, `arquivos`, `envios`, `cron_execucoes`, `integracoes_testes` |
| Telegram | `telegram_contas` (um chat → N pessoas, contexto atual), `conversa_estados` (o que o bot espera, 30 min), `telegram_albuns` (media_group_id) |
| Cadastro | `acesso_condominios`, `unidades`, `mudancas` (só inserção) |
| Chamados | `regras_categoria` (urgência, prazo, responsável), `palavras_emergencia_extra`, `passos_autoajuda`, `chamados` (sem DELETE), `chamado_eventos` (só inserção), `contatos_sindico` |
| Rotinas | `rotina_modelos`, `rotina_itens` (sem entrada, saída, duração ou horas) |
| Vencimentos | `vencimento_modelos` (global, versionada), `vencimentos`, `servicos_registrados` |
| Prestadores | `prestadores`, `prestador_condominios`, `prestador_documentos`, `prestador_pagamentos` (cifrados, só inserção), `emissores_certidao` |
| Despesas | `despesas` (para_conferir → lançada → estornada; DELETE recusado; lançada só muda para estornada com motivo) |
| Documentos e dúvidas | `documentos`, `trechos` (por artigo), `duvidas` |
| Comunicados | `comunicados`, `comunicado_entregas` ("Li o aviso") |
| Operação | `alertas`, `resumos`, `ai_runs`, `fila_trabalho`, `parametros_valor`, `exportacoes`, `auditoria` (só inserção) |

Imutabilidade por trigger (migração `0001`): `auditoria`, `chamado_eventos`, `prestador_pagamentos` e `mudancas`
recusam UPDATE e DELETE; `chamados` recusa DELETE; `despesas` recusa DELETE das lançadas e qualquer mudança que não
seja o estorno com motivo; a hora da foto da tarefa não muda. O pedido LGPD de apagar dados roda numa transação com
`SET LOCAL app.lgpd = 'on'` (só UPDATE).

## Módulos de negócio (`src/features/<modulo>/`)

`servico.ts` (regras e banco, usado pelo painel e pelo bot), `acoes.ts` (ações de servidor do painel) e componentes.
Módulos: carteira, chamados, rotinas, vencimentos, prestadores, despesas, documentos, duvidas, comunicados, resumos,
valor, unidades, equipe, regras, condominios, integracoes, exportar, lgpd. Bibliotecas comuns em `src/lib/negocio/`
(datas, dinheiro, CNPJ, boleto, cifra, linguagem, acesso, auditoria, fila, upload, CSV).

Rotinas aceitam periodicidade diária, semanal, mensal, trimestral ou anual. Diárias e semanais usam
`dias_semana`; as demais usam `dia_mes`. Trimestrais repetem a cada três meses a partir do
`mes_referencia` (ex.: janeiro/abril/julho/outubro); anuais usam esse campo como mês do ano.
Se o dia cadastrado não existir no mês, o item é gerado no último dia, sem alterar o dia cadastrado.

## IA (`src/lib/ia/funcoes.ts`)

`chamarIAJson` manda conteúdo (texto, imagem ou PDF com até 3 páginas) e valida o JSON com zod; uma nova tentativa
com o erro; `max_tokens` por função; `stop_reason = max_tokens` não grava; cache por hash da entrada; limite mensal
por organização; custo em `ai_runs`. Nomes e contatos saem do texto antes (pseudonimização) e o conteúdo vai
delimitado como dado. Funções: IA1 dúvida com citação (conferida por `conferirResposta`), IA2 recibo/nota/boleto,
IA3 certidão e comprovante, IA4 triagem, IA6 comunicado. Tudo é sugestão até alguém conferir; sem chave, à mão.

## Fluxo do Telegram

```
Telegram ──webhook (https)──▶ /api/telegram/webhook ─┐
Telegram ◀──getUpdates── npm run telegram:polling ──POST (mesmo segredo)──┘
                                                     │
               tratarRequisicaoWebhook: confere X-Telegram-Bot-Api-Secret-Token (401 se não bater)
               registrarUpdate: insert (bot, update_id) on conflict do nothing → repetido? 200 e para
               responde 200 na hora; processarUpdate roda depois (after())
                                                     │
               tratarUpdate: my_chat_member → marca/desmarca "bot bloqueado"
                             grupo → ignorado
                             busca a pessoa pelo chat → registra a conversa → roteador
                                                     │
               roteador: botão (callback_query) → AcaoBotao (sempre answerCallbackQuery)
                         /comando → Comando (permissão por papel)
                         sem vínculo → só a instrução de como pedir convite
                         foto/documento → tratadores de arquivo (getFile + download ≤ 20 MB → armazenamento)
                         texto livre → tratadores de mensagem livre (a IA entra aqui)
                                                     │
               Saida: limitador (1/s por chat, 20/min por grupo, 30/s total) → sendMessage → registra a saída
```

O cliente da Bot API (`lib/telegram/api.ts`) usa `fetch`, repete em 429 respeitando `retry_after` (até 30 s; acima
disso devolve o erro para a fila reagendar), repete 5xx e falhas de rede, e tira o token de qualquer mensagem de erro.

Avisos: `enfileirarAvisoPessoa` / `enfileirarAvisoPapel` gravam uma linha por pessoa em `envios`
(`nao_enviado` para quem não tem Telegram ou bloqueou o bot). `processarFilaEnvios` envia respeitando os limites,
marca `enviado`/`erro`, reagenda 429 e marca a pessoa como "bot bloqueado" no 403. Roda pelo botão do painel,
pelo cron diário, pela rota `/api/cron/enviar-fila` e pelo script de polling (a cada minuto).

## Cron

`/api/cron/[job]` (`maxDuration` 300): `diario` (08h na Vercel; enfileira um item por condomínio em
`fila_trabalho` e processa com prazo de 240 s: rotina do dia dentro da janela, resumo do síndico, chamados sem
confirmação em 72 h, purga de fotos, saúde do webhook, fila de avisos), `frequente` (responde na hora e trabalha
depois: sobra do diário, rotinas que esperavam a janela, fila) e `enviar-fila`. `lembretes-do-dia` é apelido do diário.

## Pontos de extensão para as funcionalidades de negócio

1. **Menu e páginas**: acrescente o módulo em `src/config/navegacao.ts`. Com status `em_construcao`, a página
   `/app/<rota>` já existe (genérica). Para construir, crie `src/app/app/<rota>/page.tsx` e mude para `pronto`.
   Ações e componentes do módulo ficam em `src/features/<modulo>/`.
2. **Comandos e botões do bot**: crie `src/lib/telegram/comandos/<modulo>.ts` com `registrar<Modulo>(roteador)` usando
   `registrarComando({ nome, descricao, permissao: ["morador"] | "vinculado" | "publico", executar })` e
   `registrarAcao({ prefixo, permissao, executar(ctx, dados) })` (callback_data `prefixo:dados`, até 64 bytes).
   Chame a função em `comandos/index.ts`. O `/ajuda` e o menu do Telegram passam a listar o comando sozinhos.
3. **Mensagem livre → IA**: `roteador.registrarMensagemLivre(fn, { prioridade: "inicio" })`. O `ctx` traz a pessoa
   (nome, papel, unidade, condomínio) e o texto; responda com `ctx.responder()` e devolva `true`. Use `gerarTexto()`
   de `lib/ia/anthropic.ts`. Nunca coloque dados de outra pessoa na resposta.
4. **Arquivos recebidos**: `aoReceberArquivo(fn)` (em `lib/telegram`) é chamado depois que a foto/documento foi salvo,
   com o id do registro em `arquivos` e o contexto (ex.: anexar a um chamado aberto).
5. **Lembretes e comunicados**: `registrarGeradorDeLembretes({ nome, gerar })` em `lib/cron/jobs.ts`. O job diário
   `lembretes-do-dia` chama todos os geradores e depois envia a fila. Os geradores usam `enfileirarAvisoPessoa` /
   `enfileirarAvisoPapel` com `chaveIdempotencia` (ex.: `vencimento:<id>:<data>`) para não repetir.
6. **Pessoas**: os módulos de moradores/unidades podem referenciar `pessoas.id` (ou criar a pessoa ao cadastrar o
   morador) para ganhar o vínculo com o Telegram e os avisos.
7. **Permissões do painel**: acrescente ações em `PERMISSOES` (`lib/auth/sessao.ts`) e use `exigirPermissao`.

## Segurança e privacidade

- Token do bot só em variável de ambiente; tela e logs mostram `••••` + 4 últimos caracteres.
- Webhook: segredo comparado em tempo constante; `TELEGRAM_WEBHOOK_SECRET` ou derivado do segredo da instalação.
- Cron: `Authorization: Bearer <CRON_SECRET>` (a Vercel envia sozinha).
- Convite: 256 bits aleatórios em base64url (43 caracteres), só o hash no banco, uso único com trava contra corrida,
  validade de 24 h a 7 dias, cancelável; um chat vincula uma pessoa por vez.
- O código do `/start` nunca é gravado (texto e payload ficam como `/start`); o payload bruto do update é apagado
  depois de processado; de quem não está vinculado não se guarda texto.
- Cada aviso é uma mensagem individual: ninguém vê quem mais recebeu.
- Arquivos: entregues só para a mesma organização; na nuvem, por link temporário assinado (5 minutos).

## Auth

Login normaliza o e-mail (minúsculas, sem espaços, sem acento). Sessão JWT HS256 de 14 dias em cookie httpOnly
(`secure` quando o endereço é https). `proxy.ts` protege `/app`; sessão órfã vai para `/api/auth/limpar-sessao`.
Sair é sempre POST.
