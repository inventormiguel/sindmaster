# sindmaster — gestão inteligente de condomínios (painel + bot no Telegram)

Instalação local e contexto atualizado deste projeto: veja `contexto.md`.

Sistema para **síndicos profissionais, síndicos moradores e administradoras**: um painel web por condomínio (e da
carteira inteira) e um **bot no Telegram** para funcionários, moradores e prestadores. O nome do produto fica num
lugar só: `src/lib/brand.ts`.

O que faz:
- **Hoje e carteira:** o que venceu, o que vence, rotinas de hoje, chamados por urgência, dúvidas esperando, itens
  para conferir, alertas; **painel de valor** (medido e estimado, nunca somados) com Imprimir e CSV.
- **Chamados** com triagem pela IA, **emergência na hora** (palavras fixas, mensagem de segurança com o 193, aviso
  direto ao síndico e ao plantão, sem IA), autoajuda só da biblioteca aprovada, responsável padrão por categoria,
  foto obrigatória para resolver, **confirmação do morador** (72 h sem resposta: encerra "sem confirmação"),
  portaria abrindo **pela unidade**, ocorrências (livro só de inserção).
- **Rotinas dos funcionários** como **tarefa feita com foto**, nunca jornada: sem entrada, saída, horas nem
  localização; janela de envio por condomínio; rotina do posto para empresa contratada.
- **Vencimentos** por modelos com referência informada, "Conferi e ativo", "dentro/fora do prazo cadastrado",
  registro do serviço com comprovante (a IA lê a data), avisos proporcionais no resumo.
- **Prestadores** com certidões e apólice vigiadas (CND pela raiz do CNPJ, avisos proporcionais à validade, link do
  emissor) e **alerta de troca dos dados de pagamento** (fecha só com "Confirmei por telefone com…").
- **Despesas** por foto ou PDF (IA lê os campos) com conferência do código: DVs da linha digitável, banco, valor e
  vencimento recalculados; beneficiário impresso como sugestão; toque obrigatório **"Conferi o beneficiário no app do
  banco"**; **nada se apaga** (estorno com motivo, garantido por trigger).
- **Documentos** divididos por artigo e **dúvidas dos moradores** respondidas pela IA **só com citação literal
  conferida por código**, conferência prévia do síndico por padrão, "Falar com o síndico" em toda resposta.
- **Unidades** com vários moradores, **convites em lote** (página imprimível com QR), **Mudança** (quem sai é
  desvinculado e o novo morador não vê nada do anterior), revogar e reemitir convite.
- **Integrações** com status real, **Saúde do sistema**, **Exportar tudo** (ZIP com CSVs), auditoria só de inserção, LGPD.

## Rodar no computador

Requisitos: Node 22.13 ou mais novo.

```bash
npm install
npm run dev          # http://localhost:3241 (cria o banco local e a conta de demonstração)
```

Acesso de demonstração: **demonstracao@inventormiguel.com** / **abc123** (conta "Ribeiro Síndicos Profissionais",
fictícia, com o **Residencial Jardim das Araucárias** e o **Edifício Mirante do Batel**). O histórico do seed é
marcado como "dado de exemplo"; nenhuma pessoa do seed tem Telegram nem telefone. Em **Condomínios**, "Criar
condomínio de demonstração" gera outra cópia completa do caso da caixa d'água.

Para ligar a IA e o Telegram, copie `.env.example` para `.env.local` e preencha `ANTHROPIC_API_KEY`,
`TELEGRAM_BOT_TOKEN` e `TELEGRAM_BOT_USERNAME`. Em **Integrações**, use "Testar conexão". Sem a chave de IA, tudo
funciona à mão.

## Telegram no computador (sem endereço público)

```bash
npm run dev                  # terminal 1
npm run telegram:polling     # terminal 2: escuta o bot e repassa ao servidor local;
                             # também envia a fila (1 min), roda o frequente (15 min) e o diário (08h)
```

Comandos por papel e botões: `docs/MANUAL-DO-BOT.md`. Uma conta do Telegram pode ter vínculos em vários condomínios
(`/condominio` troca); toda mensagem começa com "Condomínio · papel".

## Publicar (Vercel + Neon)

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/inventormiguel/sindmaster&root-directory=software)

1. Banco Postgres no Neon (região **AWS sa-east-1, São Paulo**), connection string **pooled** em `DATABASE_URL`.
2. Importe o repositório na Vercel com **Root Directory = `software`** (`vercel.json`: região `gru1`, um cron diário `/api/cron/diario` às 08h).
3. Variáveis: `DATABASE_URL`, `AUTH_SECRET`, `CHAVE_CIFRA_DADOS`, `APP_URL` (https), `CRON_SECRET`,
   `TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET`, `ANTHROPIC_API_KEY`. Armazenamento: ligue
   um Blob **privado** ao projeto (OIDC + `BLOB_STORE_ID`, lidos pelo SDK) ou defina `BLOB_READ_WRITE_TOKEN`
   (**portão P-BLOB**: se a URL pré-assinada não funcionar com OIDC na sua conta, defina o token; arquivos acima de
   4,5 MB dependem dela).
4. Deploy. O build aplica as migrações e cria a conta de demonstração.
5. No painel publicado, **Telegram → Ativar webhook neste endereço**.

**Plano Hobby da Vercel: só para avaliação.** É de uso pessoal e não comercial, com cron 1 vez por dia; condomínio em
operação (síndico profissional, administradora, e também o síndico morador com isenção de cota) usa o **Pro**, que
permite o cron frequente (linha pronta em Integrações). A emergência não depende de cron.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run dev` / `build` / `start` | servidor na porta 3241 (o build migra e cria a conta demo) |
| `npm run typecheck` / `lint` / `test` | TypeScript, ESLint e testes (Vitest, banco PGlite em memória) |
| `npm run check:layout` | Playwright a 1440 e 1280 px em todas as telas (servidor no ar; `npx playwright install chromium` na 1ª vez) |
| `npm run ia:medir` | mede o custo real das funções de IA com a sua chave (banco em memória) |
| `npm run db:setup` / `db:generate` / `db:reset` | migrações e seed / nova migração / guarda o banco local e recomeça |
| `npm run telegram:polling` / `telegram:set-webhook` / `telegram:info` | modo local, webhook e diagnóstico do bot |
| `npm run rotinas:diarias` / `rotinas:frequentes` / `fila:processar` | rodam o diário, o frequente e a fila na hora |

## Documentação

- `docs/ARQUITETURA.md`: pastas, modelo de dados, Telegram, IA, cron e pontos de extensão.
- `docs/MANUAL-DO-BOT.md`: comandos e botões por papel (conferido por teste).
- `docs/INTEGRACOES.md`: passo a passo de cada integração.
- `docs/CUSTOS-IA.md`: custo medido de cada função de IA.
- `docs/ROADMAP.md`: o que está pronto, o desejável e o que ficou fora (com a razão).
- `docs/LICENCAS-DE-CONTEUDO.md`: origem do conteúdo do seed.
