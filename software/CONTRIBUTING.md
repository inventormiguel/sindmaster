# Como contribuir

1. Crie uma branch a partir de `main`: `git checkout -b modulo/chamados`.
2. `npm install` e `npm run dev` (porta 3241). Para o bot, `npm run telegram:polling` em outro terminal.
3. Mudou o banco? Edite `src/db/schema.ts` e rode `npm run db:generate` (gera a migração em `drizzle/`, que vai no commit).
4. Antes do commit: `npm run typecheck && npm run lint && npm test`, e confira que nenhuma chave entrou:
   `git grep -nE "sk-ant|[0-9]{6,}:[A-Za-z0-9_-]{30,}"` não pode achar nada.

## Padrões

- Módulo novo: `src/config/navegacao.ts` + `src/app/app/<rota>/page.tsx` + `src/features/<modulo>/`.
- Comandos do bot: `src/lib/telegram/comandos/<modulo>.ts`, registrado em `comandos/index.ts`.
- Toda consulta filtra por `organizacao_id`. Textos da tela em português, datas dd/mm/aaaa, nada de chave interna.
- Nada simulado: o que não funciona de verdade não entra (vai para `docs/ROADMAP.md`).
- O nome do produto só em `src/lib/brand.ts` (há teste para isso).
