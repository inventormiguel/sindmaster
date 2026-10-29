# Integrações

O status "Conectada" só aparece depois de um "Testar conexão" que fez uma chamada real com a chave atual.

## Telegram (bot)

1. No Telegram, abra o [@BotFather](https://t.me/BotFather), envie `/newbot`, escolha o nome e o @usuario (termina em "bot").
2. Cole o token em `TELEGRAM_BOT_TOKEN` e o @usuario (sem @) em `TELEGRAM_BOT_USERNAME` no `.env.local`
   (ou nas variáveis do servidor). Nunca coloque o token em arquivo versionado.
3. Reinicie e use **Integrações → Telegram → Testar conexão** (chama `getMe`).
4. Como as mensagens chegam:
   - **Computador, sem endereço público**: `npm run telegram:polling` (remove o webhook, se houver, e repassa as
     mensagens ao servidor local).
   - **Servidor com https**: **Telegram → Ativar webhook neste endereço**, ou
     `npm run telegram:set-webhook -- https://seu-endereco.com.br` (com o mesmo `TELEGRAM_WEBHOOK_SECRET` do servidor).
5. `npm run telegram:info` mostra o bot e o estado do webhook.

Limites respeitados pelo sistema: cerca de 1 mensagem/s por conversa, 20/min por grupo, 30/s no total; arquivos
recebidos até 20 MB. Documentação: <https://core.telegram.org/bots/api>.

## IA (Anthropic)

1. Crie a conta em <https://console.anthropic.com> e adicione créditos.
2. Crie uma chave em "API Keys" e cole em `ANTHROPIC_API_KEY`.
3. Opcional: `ANTHROPIC_MODEL` (padrão `claude-haiku-5-5`) e `ANTHROPIC_MODEL_FALLBACK` (padrão `claude-haiku-4-5-20251001`,
   usado só se o principal não existir mais).
4. **Integrações → IA → Testar conexão** faz uma chamada curta e mostra os tokens usados.

A IA lê recibos, notas, boletos, certidões e comprovantes, faz a triagem dos chamados e
responde dúvidas com citação literal (custo medido em `docs/CUSTOS-IA.md`). Perguntas, fotos e documentos vão à
Anthropic (EUA) sem nome nem contato de moradores. Limite mensal por conta em `IA_LIMITE_MENSAL_USD` (padrão 5).

## Armazenamento de arquivos

- Computador: nada a configurar (pasta `.data/uploads`).
- Servidor: crie um Blob store **Private** e ligue ao projeto na Vercel (autenticação OIDC com `BLOB_STORE_ID`, lida
  pelo SDK) ou defina `BLOB_READ_WRITE_TOKEN`. Sem nenhum dos dois, o servidor publicado recusa guardar arquivos.
  Portão P-BLOB: confira na Vercel real o upload, a leitura privada e a URL pré-assinada; se a pré-assinada falhar
  com OIDC, defina `BLOB_READ_WRITE_TOKEN`.
- Imagem recebida como documento (Telegram) ou enviada pelo painel é reduzida e regravada sem EXIF (GPS).

## Banco de dados

- Computador: PGlite em `.data/pglite`, criado sozinho.
- Servidor: Postgres no Neon (região AWS sa-east-1), connection string pooled em `DATABASE_URL`.

## BrasilAPI e ViaCEP

Sem chave, com User-Agent próprio do sistema. BrasilAPI mostra razão social e situação cadastral do CNPJ (o CNPJ
fictício do seed devolve 404, o esperado); ViaCEP preenche o endereço pelo CEP. "Testar conexão" em Integrações.

## Rotinas agendadas

`/api/cron/diario` (uma vez por dia às 08h de Brasília no `vercel.json`), `/api/cron/frequente` (opcional) e
`/api/cron/enviar-fila`, protegidas por `Authorization: Bearer <CRON_SECRET>`. No painel: **Integrações → Rotinas
agendadas → Rodar agora**. No terminal: `npm run rotinas:diarias`.

Agendador frequente (opcional): no plano **Pro** da Vercel, acrescente ao `vercel.json`
`{ "path": "/api/cron/frequente", "schedule": "*/15 * * * *" }`. Fora da Vercel (ou para avaliar), um agendador
externo gratuito como o **cron-job.org** pode fazer GET em `https://seu-endereco/api/cron/frequente` a cada 15 min com
o cabeçalho `Authorization: Bearer <CRON_SECRET>` (a rota responde em menos de 1 s e trabalha depois); o GitHub
Actions com `schedule` é outra opção, com atraso frequente. Sem agendador, tudo vai no diário. A emergência não
depende de cron. Plano Hobby: só para avaliação.
