# sindmaster — contexto do projeto

Última atualização: 29/10/2026.

Nome confirmado por Miguel: **sindmaster**, sem acento, tudo junto e em minúsculas.


## Público-alvo e direção da marca — 29/10/2026

Pesquisa documental consultada em 29/10/2026. Os dados abaixo descrevem as amostras das fontes; não são uma pesquisa com clientes do produto. Não há evidência suficiente para fixar idade, gênero, renda ou uma preferência de cor universal. A identidade é uma decisão de design orientada às necessidades encontradas, a validar com usuários.

### Evidências e referências

1. **Grupo Superlógica / Datafolha, “Perfil do Síndico Brasileiro”, divulgação de 02/12/2025.** Entrevistas mistas com 350 síndicos de todas as regiões. Entre os entrevistados, 46% atuam profissionalmente, 72% buscaram qualificação e 74% usam plataforma de gestão. O síndico profissional administra em média oito condomínios; o morador, um ou dois. Implicação: navegação clara por carteira e por condomínio, controles legíveis e acesso rápido às pendências. Fonte: <https://blog.superlogica.com/imprensa/releases/46-dos-sindicos-ja-sao-profissionais/>.
2. **SíndicoNet, Censo 2024 / artigo “Metas de ano novo”.** A comunicação é citada como característica relevante por 61,6% dos entrevistados; o artigo destaca a sobrecarga e a necessidade de organizar prioridades. Implicação: linguagem simples, próximos passos visíveis, informações com fonte e redução de ruído visual. Fonte: <https://www.sindiconet.com.br/informese/metas-ano-novo-administracao-ferramentas-e-metodos>. Referência do levantamento, com mais de 2,5 mil participantes: <https://www.sindiconet.com.br/downloads/report-censo%C2%A0sindiconet-2024-ebooks-report-sindiconet-2024>. Os resultados pertencem a pesquisas diferentes; não somar amostras nem tratar números de anos distintos como equivalentes.
3. **W3C, WCAG 2.2, critério 1.4.3.** Referência técnica para contraste: pelo menos 4,5:1 em texto comum e 3:1 em texto grande. Serve de requisito de legibilidade, sem alegar certificação de acessibilidade do produto. Fonte: <https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html>.

### Quem compra, quem opera e quem participa

| Perfil | Necessidade principal | Resposta da interface e da comunicação |
|---|---|---|
| Síndico profissional | Enxergar vários condomínios, priorizar e acompanhar responsáveis | Carteira com totais reais, seletor de condomínio constante, cartões comparáveis |
| Administradora | Operação padronizada e histórico consultável para a equipe | Menu por áreas, tabelas legíveis, documentos e auditoria acessíveis |
| Síndico morador | Começar com segurança e entender o próximo passo | Primeiros passos, rótulos diretos, campos com instruções e estados explícitos |
| Conselho | Acompanhar o condomínio conforme o acesso concedido | Respeitar a visão de leitura e as permissões existentes |
| Moradores, equipe e prestadores | Fazer pedidos, receber orientações e registrar tarefas | Telegram conforme o papel; instruções curtas e sem linguagem técnica |

Os três primeiros perfis são o foco comercial. Os demais são participantes da operação. Não prometer recursos financeiros ou canais externos apenas porque outras plataformas os oferecem.

### Posicionamento e personalidade

**Promessa:** mais clareza para gerir e mais cuidado com o condomínio. **Assinatura:** “Gestão mais clara. Condomínios mais bem cuidados.” Personalidade: organizada, próxima, responsável e serena. Tecnologia discreta, com decisões humanas visíveis. O nome continua **sindmaster**, em minúsculas, definido somente em `src/lib/brand.ts` no código.

A escolha de azul profundo como estrutura, verde como apoio e superfícies claras é uma interpretação de design para oferecer hierarquia e sobriedade. As fontes não demonstram que determinada cor provoque confiança ou conversão nesse público.

### Paleta oficial e usos

Valores de execução centralizados em `BRAND.cores`, enviados pelo `RootLayout` às variáveis CSS. Não criar paletas próprias por módulo. O SVG da ilustração e o favicon são ativos estáticos e devem ser atualizados quando a paleta mudar.

| Cor | HEX | Uso |
|---|---|---|
| Azul profundo | `#132F42` | Navegação e blocos institucionais |
| Azul petróleo | `#275D77` | Ações principais, links e ícones |
| Azul escuro | `#173D52` | Interação dos botões |
| Azul névoa | `#EAF1F5` | Fundos de apoio |
| Verde sóbrio | `#227567` | Ênfase editorial e cuidado |
| Areia dourada | `#C59A55` | Detalhes de marca; não usar como texto pequeno em branco |
| Tinta | `#193344` | Texto principal |
| Texto de apoio | `#586B76` | Descrições e metadados |
| Branco cálido de fundo | `#F5F6F4` | Área de trabalho |
| Branco | `#FFFFFF` | Cartões e formulários |
| Borda | `#DCE3E5` | Separação suave |
| Vermelho | `#B42332` | Erros e situações que exigem atenção |

Cores semânticas de sucesso, alerta e erro devem vir acompanhadas de texto e/ou ícone. Dourado não significa pendência; amarelo é reservado ao alerta. Texto claro da navegação: `#D9E6EB`; texto secundário em fundo escuro: `#A7BECB` / `#C2D3DC`.

### Tipografia, composição e interação

- Família de interface: Avenir Next quando disponível; alternativas Segoe UI e fontes de sistema. Sem download obrigatório de fonte externa. Para peças de marca externas, usar **Avenir Next** licenciada ou **Inter** como alternativa; não pressupor que Inter esteja embutida no site.
- Texto de conteúdo de 14–16 px; títulos de página de 24–30 px; títulos editoriais maiores só nas páginas públicas. Peso 600 para títulos, linha confortável e alinhamento à esquerda. Evitar parágrafos em caixa alta.
- Base de espaçamento de 4 px, cartões de 20–24 px, raios de 8 px em controles e 16 px em cartões. Bordas discretas e sombra suave. Tabelas com cabeçalho claro e linhas espaçadas.
- Menu azul profundo com grupos, ícones lineares e seleção com faixa dourada; versão móvel recolhível. Barra de contexto clara com condomínio e data. Nenhuma estatística inventada.
- Foco de teclado visível, link para pular ao conteúdo, estados ativos com `aria-current`, avisos legíveis e movimento reduzido quando solicitado pelo sistema.
- Conferir 1440 e 1280 px, além de 390 px no celular. Tabelas largas rolam dentro do contêiner. Telas de impressão mantêm fundo branco e preservam a leitura.

### Imagens, ícones e referências visuais para replicação

**Ativo principal próprio:** `public/brand/residencial.svg`. Ilustração vetorial original criada para o projeto: fachadas residenciais, áreas verdes, geometria arquitetônica e luz cálida na paleta. Usada na página inicial e no acesso. Não representa um empreendimento real nem é uma captura do sistema. Referência visual local para novas peças: esse arquivo e o layout publicado em <https://sindmaster.vercel.app>.

**Símbolo:** duas fachadas conectadas e ponto dourado, em `src/components/logo.tsx`; favicon correspondente em `src/app/icon.svg`. Preservar proporções, área de respiro de ao menos metade da altura do símbolo e versão branca do texto em fundo azul. Não esticar nem adicionar efeitos tridimensionais.

**Ícones:** Lucide, traço 1,5–2 px, tamanhos de 16–24 px na interface, sem misturar estilos preenchidos ou emojis decorativos.

**Direção fotográfica futura:** condomínios brasileiros de prédios e casas, portarias e áreas comuns bem cuidadas, zeladoria em tarefas reais e pessoas diversas em interação natural. Luz suave, verde moderado e materiais cotidianos; enquadramentos com espaço para texto. Usar imagens próprias ou licenciadas; registrar autor, origem e licença em `docs/LICENCAS-DE-CONTEUDO.md`. As fontes de pesquisa não concedem direitos de uso sobre suas fotos, gráficos ou marcas.

**Briefing replicável para ilustrações futuras:** “Arquitetura residencial brasileira contemporânea, prédios de escala humana e casas, áreas verdes, composição geométrica editorial, azul petróleo e verde sóbrio, branco cálido e detalhes areia dourada, luz suave, espaço negativo, sem texto, sem logotipos, sem indicadores fictícios.” Manter diversidade de tipologias, sem restringir a marca a condomínios de luxo.

### Tom de voz e exemplos

Português brasileiro, direto, acolhedor e preciso. Tratar o leitor por “você”. Explicar a ação e o que acontece depois. A IA **sugere, organiza, lê e prepara**; a pessoa **confere, aprova e decide**. Evitar promessas absolutas, jargão tecnológico, garantias legais e dados de desempenho não medidos.

| Situação | Referência de redação |
|---|---|
| Apresentação | “Mais clareza para gerir. Mais cuidado com o seu condomínio.” |
| IA | “A IA ajuda a organizar. Você acompanha e decide.” |
| Pendência | “Itens para conferir” |
| Prazo | “Fora do prazo cadastrado” |
| Conferência | “Conferido por [nome]” |
| Estado vazio | “Nenhum chamado aberto.” |
| Convite à ação | “Organizar meu condomínio”, “Ver o Hoje”, “Criar minha conta” |

### Aplicação nos desdobramentos

Sites e páginas comerciais usam título claro, ilustração arquitetônica e ação principal azul. Painéis e relatórios priorizam dados reais e hierarquia de leitura. Propostas, apresentações e redes sociais repetem a paleta, o símbolo e o tom de cuidado. Não copiar identidades dos portais pesquisados nem usar suas marcas como endosso. Para novas telas, reutilizar `components/ui`, `components/negocio` e o layout do painel antes de criar estilos novos.

## Organização da pasta

A raiz contém `README.md`, `AGENTS.md`, `.gitignore` e os metadados do repositório/ferramentas. Todo o material do software está em `software/`: este contexto, documentação, fontes, testes, dependências, atalhos, configuração da Vercel, variáveis locais e dados privados. Executar npm e Vercel dentro de `software/`. Os atalhos `Iniciar.command` e `Parar.command` ficam nessa pasta e usam a própria localização. A organização não altera o banco da Vercel; os dados locais permanecem independentes.

## Visão e objetivo

O sindmaster é um sistema de síndico inteligente para síndicos de condomínios operarem com inteligência artificial embarcada. Atende síndicos profissionais, síndicos moradores e administradoras, reunindo a operação dos condomínios em um painel web.

A instalação começou no computador de Miguel; a demonstração e a configuração agora continuam no ambiente de produção da Vercel. Esta pasta mantém o código e a referência para a evolução do produto. A base recebida usa IA por API da Anthropic: “embarcada” significa integrada aos fluxos do produto, e não um modelo que roda offline no computador.

O código inicial veio de `/Users/inventormiguel/Downloads/gestao-condominio-ia.zip`, extraído inicialmente em `/Volumes/inventor/sindmaster`; em 29/10/2026, todo o software foi reunido em `software/`. O pacote usava a marca provisória GICON; o nome exibido pela aplicação foi alterado para sindmaster em `src/lib/brand.ts`. Documentos originais do pacote podem continuar usando o nome anterior.

Os exemplos de pedidos existentes em `COMECE-AQUI.md` são material de referência do pacote. Publicação na nuvem, contratação de serviços e ativação de canais externos dependem do pedido efetivo de Miguel; esses exemplos não registram decisões já tomadas.

## Produção — ambiente de referência atual

- Aplicação: <https://sindmaster.vercel.app>.
- Vercel: equipe `inventor-miguel`, plano Pro já existente, projeto `sindmaster` (`prj_VZn1PrD1h3SSKdW3RdDe8nBXHSx2`).
- Execução: Next.js em Node 24, funções na região `gru1` (São Paulo).
- Banco persistente: Neon, recurso `sindmaster-db`, região `gru1`, plano Free; conexão pooled para a aplicação.
- Arquivos: Vercel Blob **privado**, recurso `sindmaster-arquivos`, região `gru1`. Gravação, leitura e URL assinada verificadas com um arquivo temporário de 1 KB, removido ao concluir.
- IA: chave Anthropic nas variáveis protegidas da Vercel; teste real em produção aprovado com `claude-haiku-5-5`, resposta "conectado" (23 tokens de entrada e 5 de saída).
- Rotinas: diário às **08h de Brasília** e frequente a cada **15 minutos**, protegidos por `CRON_SECRET`.
- Telegram ainda não configurado.
- Deploy via Vercel CLI a partir de `software/`, vinculada por `.vercel/project.json`. Repositório público: <https://github.com/inventormiguel/sindmaster>.
- Último deploy desta correção: `dpl_95DMGca4zvKHUPL1YS4E68V7Lo3t`.

### Periodicidades das rotinas e publicação

Em 29/10/2026, foram publicadas as cinco opções de rotinas: **diária, semanal, mensal, trimestral e anual**. A migração `0002_complex_penance` adicionou apenas `mes_referencia` ao banco de produção. O cadastro usa dia do mês para mensal/trimestral/anual e mês de referência para trimestral/anual; meses curtos ajustam o item ao último dia sem alterar o dia cadastrado.

Deploy `dpl_95DMGca4zvKHUPL1YS4E68V7Lo3t`, produção <https://sindmaster.vercel.app/app/rotinas>. As cinco opções e os campos condicionais foram conferidos na interface autenticada de demonstração em 1440 e 1280 px, sem rolagem horizontal ou erros JavaScript. Saúde de produção: `ok`, banco Postgres. Capturas em `.layout/rotinas-producao-*.png`.

Miguel determinou que alterações solicitadas neste projeto sejam **sempre publicadas na Vercel e verificadas em produção** antes da conclusão; a entrega apenas local não atende ao pedido. Preservar os cadastros existentes e a separação dos bancos.

### Cadastro de produção e numeração de unidades

Em produção, Foi criado um condomínio de produção na conta do responsável pela instalação. O texto `unidades 1 a 14` havia sido gravado como uma única unidade. Em 29/10/2026, o cadastro foi corrigido para **14 casas, numeradas de 1 a 14, sem andar**, com o total do condomínio atualizado e registro na auditoria. O registro incorreto não tinha vínculos e seu identificador foi preservado para a casa 1. Backup anterior à correção em `.data/backups/[backup privado]`.

O formulário agora interpreta listas e intervalos como `de 1 a 14`, `unidades 1 a 14`, `Casas de 1 a 14`, `1-14`, vírgulas e uma unidade por linha. Há seleção **Casas (sem andar)** e prévia da quantidade e dos números. Duplicatas são removidas antes da contagem; entradas sem interpretação segura mostram um erro antes de criar o condomínio. O gerador de apartamentos por andar foi preservado. Condomínio e unidades são gravados juntos numa transação. A listagem usa ordem numérica e oculta a coluna Andar quando nenhuma unidade tem andar.

### Separação dos ambientes

Miguel **cancelou expressamente a migração dos dados locais para produção**. Não copiar o banco do computador para a Vercel: os cadastros feitos em produção devem ser preservados. O condomínio local local foi corrigido para 14 casas, mas não foi transferido; o condomínio de produção foi criado pelo próprio Miguel em produção e corrigido diretamente lá. Os dois bancos permanecem independentes. A produção passa a ser a referência para a continuação desta demonstração.

Segredos e backups privados permanecem em `.data`, `.env.local` e nas variáveis protegidas da Vercel. `.vercelignore` exclui banco local, backups e arquivos de ambiente do envio.

### Remoção dos comunicados (29/10/2026)

Por decisão de Miguel, o módulo de comunicados foi removido: menu, página, ações de servidor, criação e aprovação pelo Telegram (`/aviso` e botões antigos), confirmação de leitura, contagens no Hoje, métricas no Valor/CSV e rascunho pela IA. O seed e o medidor de custos também deixam de gerar comunicados. As tabelas e migrações antigas permanecem apenas para preservar histórico e exportação; não há exclusão de dados nem migração entre ambientes. A fila ignora a categoria legada `comunicado`, inclusive em novas tentativas. Notificações operacionais de chamados, rotinas e vencimentos continuam disponíveis.

## Estado da instalação local

- Projeto: `/Volumes/inventor/sindmaster/software`.
- Endereço: <http://localhost:3241/login>.
- Servidor configurado para escutar apenas em `127.0.0.1` nos atalhos locais.
- Node instalado no computador: `25.8.1`; npm: `11.11.0`. O pacote exige Node `>=22.13`.
- Dependências instaladas com `npm ci`. Foi aplicado um override de Zod em `@vercel/cli-config` para usar a versão corrigida já utilizada pelo projeto; `package-lock.json` atualizado.
- Banco local PGlite, inicializado pelas migrações e pelo seed do projeto.
- `.env.local` configurado com endereço local e chave Anthropic; campos de Telegram vazios. Arquivo ignorado pelo Git e com permissão `0600`.
- Repositório Git na raiz, branch `main`, remoto <https://github.com/inventormiguel/sindmaster>. Aplicação em `software/`; a branch `vercel-production` preserva o código do deploy de referência. Alguns testes usam `git ls-files` para inspecionar o projeto.
- **IA Anthropic ativada e testada em 29/10/2026**, com status **Conectada** persistido no painel. Telegram ainda não configurado. Banco e arquivos usam armazenamento local.
- Não há agendador de rotinas executando automaticamente nesta instalação inicial.
- Datas e rotinas de negócio usam `America/Sao_Paulo`, conforme a implementação recebida.

### Abrir e encerrar

No Finder, abra esta pasta e dê duplo clique em `Iniciar.command`. Ele abre o navegador se o sistema já estiver ativo; caso contrário, inicia a versão compilada e mantém o servidor no terminal. Nesse caso, mantenha a janela aberta e use `Control+C` para encerrar.

`Parar.command` encerra o servidor Next.js da porta 3241 somente se ele pertencer a esta pasta. Os dados são preservados. O processo iniciado durante a instalação pode continuar em segundo plano até ser encerrado; reiniciar o Mac exige iniciar o servidor novamente.

Para desenvolvimento, com o servidor anterior parado:

```bash
cd /Volumes/inventor/sindmaster/software
npm run dev -- --hostname 127.0.0.1
```

Para compilar alterações e testar a versão de produção, com o servidor parado:

```bash
cd /Volumes/inventor/sindmaster/software
npm run build
npm start -- --hostname 127.0.0.1
```

O atalho `Iniciar.command` só compila se ainda não existir um build. Depois de alterar o código, rode `npm run build` para atualizar a versão de produção, ou use o modo de desenvolvimento.

### Conta de demonstração

- E-mail: `demonstracao@inventormiguel.com`.
- Senha: `abc123`.
- Há também o botão **Entrar na demonstração** na tela de login.
- Carteira fictícia: **Ribeiro Síndicos Profissionais**.
- Condomínios: **Residencial Jardim das Araucárias** e **Edifício Mirante do Batel**.

Os registros do seed são exemplos. As pessoas fictícias não têm contato ou vínculo real no Telegram. Essa senha pública é apenas da demonstração; para testar uma operação separada, crie uma conta pelo cadastro.

## Recursos presentes na base recebida

- Carteira de condomínios, seleção do condomínio e painel **Hoje** com pendências.
- Chamados, ocorrências, triagem, responsáveis, fotos e confirmação do morador.
- Rotinas como tarefas feitas com evidências.
- Vencimentos, registro de serviços e comprovantes.
- Prestadores, certidões, apólices e conferência de alterações dos dados de pagamento.
- Despesas, leitura de documentos pela IA quando conectada, conferência de linha digitável e estorno com motivo.
- Regimento, convenção, dúvidas dos moradores e respostas assistidas por IA com citação conferida.
- Unidades, moradores, equipe, convites e mudança de ocupantes.
- Integrações, auditoria, exportações CSV e funções de privacidade.

Esses módulos estão presentes no código. A validação inicial local não equivale à homologação de todos os fluxos com usuários reais e serviços externos.

## Arquitetura e organização

| Área | Tecnologia ou localização |
|---|---|
| Aplicação web | Next.js `16.4.3`, React `19.3.0`, TypeScript, App Router |
| Estilos | Tailwind CSS 4 |
| Banco e ORM | Drizzle ORM; PGlite local ou PostgreSQL por `DATABASE_URL` |
| Autenticação | bcryptjs e sessão JWT em cookie httpOnly com `jose` |
| IA integrada | SDK Anthropic; funções de extração, triagem, respostas e rascunhos |
| Canal de mensagens implementado | Telegram Bot API; polling local ou webhook HTTPS |
| Arquivos | `.data/uploads` local; adaptador Vercel Blob disponível |
| Marca | `src/lib/brand.ts` |
| Páginas e APIs | `src/app/` |
| Regras e ações por módulo | `src/features/` |
| Banco, schema e dados de exemplo | `src/db/` |
| Migrações | `drizzle/` |
| Serviços comuns, IA, Telegram, autenticação | `src/lib/` |
| Scripts e testes | `scripts/` e `tests/` |

## IA e Telegram: o que falta conectar

A operação manual do painel não depende dessas duas integrações. A **IA está ativa**: a chave foi inserida por uma caixa protegida local e salva em `ANTHROPIC_API_KEY` no `.env.local`; o servidor foi reiniciado e **Integrações → IA → Testar conexão** executou uma chamada real. O modelo `claude-haiku-5-5` respondeu "conectado" (23 tokens de entrada e 5 de saída). O modelo de reserva continua `claude-haiku-4-5-20251001`, sem necessidade de usá-lo no teste. O limite mensal configurado no aplicativo é de US$ 5 por organização; isso não representa crédito contratado nem validação da cobrança do provedor.

Para o Telegram, preencher `TELEGRAM_BOT_TOKEN` e `TELEGRAM_BOT_USERNAME` com um bot destinado a esta instalação, reiniciar o servidor, testar a conexão e rodar `npm run telegram:polling` em outro terminal. Esse processo também aciona fila e rotinas agendadas. O polling recebido remove um webhook existente: antes de ativá-lo, conferir se o bot já atende outra instalação. Não foi iniciado nesta etapa.

Nunca registrar chaves ou tokens neste arquivo, no código ou no Git. A página de Integrações deve indicar conexão somente depois de um teste real.

## Persistência e cuidados de operação

- Banco: `.data/pglite`; uploads: `.data/uploads`; segredo da instalação: `.data/segredo-local`.
- Preservar a pasta `.data` inteira e o `.env.local` em backups privados; o segredo é usado em sessões e na derivação de chaves. Não o trocar sem avaliar os dados cifrados existentes.
- Parar o servidor antes de copiar o banco, aplicar migrações, executar scripts diretos no banco ou compilar: o PGlite local aceita apenas um processo acessando a pasta por vez. Testes Vitest usam bancos em memória separados.
- `npm run db:reset` reinicia a base local e não faz parte do uso diário.
- O servidor local depende do computador ligado e não é uma publicação para os condomínios.

## Princípios para a evolução

- Manter o isolamento por organização e as permissões por condomínio.
- Centralizar a marca no código em `src/lib/brand.ts`; a documentação pode citar o nome do produto.
- IA produz sugestões para conferência humana; dúvidas devem apoiar-se nos documentos do condomínio com citação verificada.
- Não apresentar integrações sem credenciais como conectadas nem respostas simuladas como IA real.
- Preservar histórico e auditoria; correções financeiras devem manter motivo e rastreabilidade.
- Rotinas representam tarefas e evidências, sem controle de jornada.
- Não transformar prazos cadastrados em afirmações de conformidade legal.
- Preferir APIs, MCPs, integrações nativas e CLIs autenticadas antes de navegador, conforme orientação de Miguel.

## Testes e referências

Comandos de verificação: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` e, com o servidor no ar, `npm run check:layout`. O último usa Chromium via Playwright, visita páginas públicas e autenticadas e salva capturas em `.layout/` em larguras de 1440 e 1280 pixels.

O teste de centralização da marca foi ajustado para inspecionar o código da aplicação, permitindo que este documento mencione o nome do produto. As demais verificações desse arquivo de testes foram mantidas.

Validação inicial concluída em 29/10/2026:

- `npm test -- --maxWorkers=2`: **129 testes aprovados em 11 arquivos**.
- `npm run typecheck` e `npm run lint`: aprovados.
- `npm run build`: aprovado, incluindo nova compilação após a confirmação do nome **sindmaster**.
- `npm run check:layout`: **26 páginas em duas larguras** (1440 e 1280 px), sem problemas apontados.
- Depois da compilação final: banco saudável (`/api/saude`), título e marca **sindmaster**, login pelo botão de demonstração e páginas Carteira, Hoje e Integrações aprovados em ambas as larguras, sem erros JavaScript.
- Atalhos de início e encerramento executados; servidor final escutando em `127.0.0.1:3241`.
- Ativação posterior da IA em 29/10/2026: chamada real à Anthropic aprovada e status **Conectada** confirmado após recarregar a página.
- Teste funcional pelo Diagnóstico: pergunta sobre horários de obras respondida pela IA com citação ao **artigo 12** do regimento de demonstração. Apenas o uso da IA foi registrado; não foi criada uma dúvida nem enviado um comunicado. Captura em `.layout/ia-diagnostico-ativacao.png`.
- Mensagens Telegram e demais chamadas a serviços externos não foram homologadas nesta etapa.

Verificação após a correção do cadastro de unidades: **149 testes aprovados em 12 arquivos**, incluindo persistência das 14 casas, intervalos, listas, duplicatas, apartamentos e rejeição de entradas inválidas. Lint, TypeScript, build local e build Vercel aprovados. Auditoria de dependências de produção: **zero alertas**; permanecem avisos moderados em ferramentas de desenvolvimento.

Verificação na interface de produção da conta de Miguel: condomínio de produção exibiu exatamente **14 linhas**, na ordem **1 a 14**, sem coluna Andar. A prévia de `unidades 1 a 14` indicou 14 unidades e o modo Casas ocultou o gerador por andar. Conferido em 1440 e 1280 px, sem rolagem horizontal ou erros JavaScript. Capturas em `.layout/[capturas privadas]` e `.layout/cadastro-casas-producao-*.png`. Banco de produção respondeu saudável; IA em produção também foi testada com sucesso.

Referências locais: `README.md`, `docs/ARQUITETURA.md`, `docs/MANUAL-DO-BOT.md`, `docs/INTEGRACOES.md` e `docs/ROADMAP.md`. O roadmap recebido inclui melhorias como relatório mensal em PDF, importação de unidades, aprovação pelo conselho, PDF escaneado, preferências de notificação e modo escuro; esses itens não devem ser tratados como já implementados.

## Próximos passos sugeridos

1. Continuar a demonstração e a configuração na Vercel com a conta de Miguel e o condomínio de produção.
2. Cadastrar moradores e conferir as 14 casas já criadas em produção.
3. Explorar os recursos de IA já ativados: diagnóstico, leitura de documentos, triagem e respostas com citação.
4. Conectar um bot de testes e validar os papéis de síndico, morador, funcionário e prestador.
5. Registrar o feedback de uso e priorizar a evolução do sindmaster, preservando os dados de produção nos próximos deploys.
