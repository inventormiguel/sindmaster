# Instruções para quem continuar com assistente de IA

Sistema de gestão de condomínio com IA para síndicos e administradoras. Nome provisório em `src/lib/brand.ts` (único lugar).

## Comandos

Execute a partir de `software/`. Leia também `contexto.md` para o público-alvo, paleta, tom e referências visuais.

- `npm run dev` (porta 3241) · `npm run build` · `npm run typecheck` · `npm run lint` · `npm test`
- `npm run db:generate` depois de mudar `src/db/schema.ts`; `npm run db:setup` aplica migrações e seed
- `npm run telegram:polling` (modo local do bot) · `telegram:set-webhook -- <url>` · `telegram:info`
- `npm run rotinas:diarias` · `npm run check:layout` (servidor no ar) · `npm run ia:medir` (custo real da IA)

## Onde fica cada coisa

Leia `docs/ARQUITETURA.md` (pastas, modelo de dados, fluxo do Telegram, IA, cron, pontos de extensão) e
`docs/MANUAL-DO-BOT.md` (comandos por papel; o teste falha se o manual e o roteador divergirem).
Next.js 16: o antigo `middleware.ts` agora é `src/proxy.ts`; documentação da versão instalada em `node_modules/next/dist/docs/`.

## Regras

- Ao concluir alterações solicitadas por Miguel, publicar na Vercel e verificar em produção (`https://sindmaster.vercel.app`). A entrega apenas local não conclui o pedido. Preservar os cadastros de produção; nunca copiar o banco local para lá.
- Não quebre o usuário de demonstração: `demonstracao@inventormiguel.com` / `abc123`, criado pelo seed idempotente no build.
- Nada simulado: nenhum envio fingido, resposta de IA falsa ou botão "simular". O que não funciona de verdade vai para `docs/ROADMAP.md`.
- O único canal de mensagens é o Telegram. Contato de pessoa é "Telefone".
- Multi-tenant: toda consulta filtra por `organizacao_id`; o bot nunca manda a uma pessoa dados de outra.
- IA: `@anthropic-ai/sdk` 0.135.0, modelo `claude-haiku-5-5` (esforço `low`, folga de tokens para o raciocínio), nunca enviar `temperature`, `top_p` ou `top_k`.
- Token do bot e chaves só em variáveis de ambiente; na tela e nos logs, só os 4 últimos caracteres.
- Endereços: use `urlPublica()`/`APP_URL`, nunca o endereço interno da requisição.
- CNPJs só da lista de CNPJs fictícios conferidos (dão 404 na BrasilAPI). User-Agent externo = `BRAND.userAgent`.
- Layout sem cortes a 1440 e 1280 px; textos em português; datas dd/mm/aaaa.
- Nunca use `pkill`/`killall`: pare só o PID que você iniciou.
- Rotina de funcionário é tarefa, nunca jornada: nada de entrada, saída, turno, horas ou localização (teste T-PT).
- Linguagem: "dentro/fora do prazo cadastrado", "conferido por"; nunca afirmar conformidade legal (teste T-LN-01).
- Nada se apaga em chamados, despesas e auditoria (triggers); correção é evento novo ou estorno com motivo.
- IA: tudo é sugestão conferida; dúvida do morador só com citação literal conferida por `conferirResposta`.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
