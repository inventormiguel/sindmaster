# GICON · Síndico Inteligente para Administração de Condomínios

O síndico vive apagando incêndio: o zelador que não sabe se a caixa d'água já foi limpa, o laudo dos extintores que vence sem ninguém lembrar, o prestador que chega com a certidão vencida, o recibo que some na gaveta e as mesmas perguntas dos moradores todo dia. O GICON organiza tudo isso num painel só e leva o dia a dia para o Telegram. O zelador recebe a rotina de manhã e manda a foto de cada tarefa feita. O morador abre o chamado com foto, acompanha até o fim e confirma quando ficou resolvido. Você recebe de manhã o resumo do que venceu, do que vai vencer e do que ficou para trás. A inteligência artificial lê o recibo e a certidão pela foto, escreve o rascunho do comunicado e responde ao morador citando o artigo exato do regimento ou da convenção. Quando a resposta não está nos documentos, ela diz que não encontrou e passa para você. Em emergência (gás, fogo, alguém preso no elevador), a IA sai do caminho: o morador recebe na hora a orientação de segurança e você e o plantão são avisados em segundos. Nada sai em nome do condomínio sem a sua conferência, e nada do que foi aprovado se apaga.

## O que ele não faz

- Não faz cobrança, boleto de cota, contabilidade nem balancete.
- Não controla jornada: registra a tarefa feita, com foto (sem entrada, saída, horas nem localização).
- Não afirma conformidade legal: mostra o prazo cadastrado, dentro ou fora dele, conferido pelo síndico.
- A IA não decide multa nem dá parecer; tudo o que ela faz é sugestão conferida pelo síndico.
- Não promete barrar fraude de boleto: confere a linha digitável e manda conferir o beneficiário no app do banco.
- Não tem fórum entre moradores, encomendas, reservas nem assembleia.
- O Telegram não substitui a portaria: não declare o bot como canal único de atendimento.

## O que ele substitui

A planilha de vencimentos, a agenda do celular, a pasta de certidões dos prestadores, a gaveta de recibos e o grupo de mensagens com os funcionários. É a sua versão das ferramentas de gestão de condomínio com IA que as administradoras de fora usam, com o Telegram como canal do dia a dia e sem senha para o morador.

## O que tem neste ZIP

O código completo do sistema. Não tem nada simulado: o bot do Telegram é o seu, criado no @BotFather; a IA é real (Claude, da Anthropic); a linha digitável do boleto é conferida por código; o CNPJ e o CEP vêm da BrasilAPI e do ViaCEP. A conta de demonstração usa a Ribeiro Síndicos Profissionais, uma carteira fictícia de Curitiba do síndico profissional José Ribeiro, com o Residencial Jardim das Araucárias (48 unidades, zelador, auxiliar de limpeza e portaria contratada, seis prestadores, o regimento e a convenção, 12 meses de histórico) e o Edifício Mirante do Batel; no Jardim, a limpeza dos reservatórios está fora do prazo cadastrado há 12 dias, a Hidro Limpa está com a CND federal vencida, há duas dúvidas de moradores esperando e o boleto da Jardim Verde Vivo para conferir. Nenhuma pessoa da demonstração tem Telegram nem telefone: o vínculo só acontece por convite real.

**Principais funcionalidades**

- Carteira e Hoje: os condomínios da administradora ou do síndico profissional num seletor, e para cada um o que venceu, o que vence, as rotinas do dia, os chamados por urgência, as dúvidas esperando, os itens para conferir e os alertas; o síndico recebe o mesmo resumo de manhã no Telegram (/hoje)
- Vencimentos a partir de modelos com a referência informada (limpeza dos reservatórios, extintores, elevador, seguro, Corpo de Bombeiros, PMOC e outros), que o síndico confere e ativa ("Conferi e ativo"), "dentro / fora do prazo cadastrado", registro do serviço com o comprovante (a IA lê a data) e o próximo vencimento recalculado
- Prestadores com a certidão negativa (CND) pela raiz do CNPJ, a apólice e os avisos proporcionais à validade, o link para conferir a autenticidade no emissor e o alerta de troca dos dados de pagamento, que só fecha com "Confirmei por telefone com…"
- Chamados pelo Telegram com até 4 fotos, triagem pela IA, passo de autoajuda só da biblioteca aprovada pelo síndico, responsável padrão por categoria, foto obrigatória para resolver e a confirmação do morador ("Resolvido" ou "Não resolvido"); a portaria abre pela unidade e as ocorrências ficam num livro só de inserção
- Emergência sem IA no caminho: palavras fixas (gás, fumaça, fogo, alagamento, preso no elevador, choque), a mensagem de segurança com o 193 na hora para quem escreveu e o aviso direto ao síndico e ao contato de plantão, com a unidade e o horário
- Rotinas dos funcionários como tarefa feita com foto, nunca jornada: o zelador recebe a lista do dia no Telegram dentro da janela de envio do condomínio e responde "Feito" (com a foto, quando exigida) ou "Não deu" (com o motivo); sem entrada, saída, horas nem localização
- Dúvidas dos moradores respondidas pela IA só com a citação literal do regimento ou da convenção, conferida por código; por padrão o síndico confere antes no /aprovar; a resposta vai identificada como IA, com o botão "Falar com o síndico"; sem resposta nos documentos, ela diz que não encontrou e encaminha
- Despesas por foto ou PDF (a IA lê fornecedor, valor e vencimento) com a linha digitável do boleto conferida por código (dígitos, banco, valor e vencimento recalculados), o toque obrigatório "Conferi o beneficiário no app do banco" e estorno com motivo, nunca apagar
- Comunicados com o rascunho da IA a partir dos tópicos, a aprovação do síndico e o botão "Li o aviso" contado no painel; Unidades com vários moradores, convites de uso único com QR imprimível e a Mudança (quem sai é desvinculado e o novo morador não vê nada do anterior)
- Painel de valor com o medido e o estimado em blocos separados e o selo "dado de exemplo"; Integrações com o "Testar conexão" de cada serviço, a Saúde do sistema, as rotinas agendadas com "Rodar agora", Exportar tudo, a auditoria e a LGPD

## Passo a passo (Manus)

Você pode usar o Manus, o Codex ou o Claude Code. No Manus tudo acontece pelo navegador: o sistema roda no computador dele, na nuvem.

1. **Crie o seu bot** (2 minutos): no Telegram, abra o **@BotFather**, envie `/newbot`, escolha o nome ("Condomínio Jardim das Araucárias") e o usuário (termina em "bot"). Guarde o **token** (é uma senha: não mande a ninguém) e o **@ do bot**.
2. Abra o Manus (manus.im), use o **Manus 2.0 Lite** e comece uma tarefa nova. Clique em **+** → **Arquivos locais** e anexe este ZIP.
3. Envie o **pedido 1** com o token e o @ do bot. Em cinco a dez minutos o Manus devolve o link. (Sem bot ainda: use a variante do pedido 1 logo abaixo dele; o painel funciona sem o Telegram.)
4. Abra o link → **Entrar** e, no quadro **Entrar como demonstração**, clique em **Entrar na demonstração** (e-mail `demonstracao@inventormiguel.com`, senha `abc123`). O **Início** mostra a carteira da Ribeiro Síndicos Profissionais (fictícia) com o Jardim das Araucárias e o Mirante do Batel.
5. Selecione o **Jardim das Araucárias** no topo e abra **Hoje**: 1 vencido (limpeza dos reservatórios, fora do prazo cadastrado há 12 dias), 4 vencendo, a Hidro Limpa com a CND federal vencida, 2 dúvidas esperando, o boleto da Jardim Verde Vivo para conferir.
6. Em **Telegram**, gere o seu convite como síndico e leia o QR com o celular: o bot responde e o `/hoje` mostra o mesmo resumo.
7. Em **Unidades e moradores**, gere um convite para a unidade 302 e abra com um segundo Telegram (o de alguém da família, por exemplo): pergunte "Posso fazer minha mudança nesse sábado à tarde?". Sem a chave de IA, a dúvida vai direto para você; com a chave, a resposta com o artigo chega ao seu `/aprovar`. (Uma mesma conta do Telegram também pode ter vários vínculos, como síndico e como morador: `/condominio` troca o papel da conversa.)
8. **Pedido 2** liga a IA com a sua chave do Claude Console (**console.anthropic.com** → **API Keys** → **Create Key**). **Pedido 3** cria a sua versão.
9. **Quando for usar de verdade**, envie o **pedido de publicação**: o sistema vai para a sua conta da Vercel, com o banco no Neon e as fotos no Blob. Para condomínio em operação, a Vercel pede o **plano Pro**; o Hobby (grátis) é só para avaliar.

**Dicas:** o banco local atende uma conexão por vez (o pedido 1 já diz ao Manus para parar o sistema antes de scripts no banco); o processo do Telegram (`telegram:polling`) precisa ficar ligado no Manus; **um bot só funciona num lugar por vez** (pare o Manus antes de ligar o webhook na Vercel, ou crie um segundo bot para testes); sem a chave, o GICON funciona inteiro sem a IA; se o Manus ficar mais de dez minutos parado no mesmo passo, ou o link der erro, avise na mesma tarefa: ele investiga e corrige; quando terminar de testar no Manus, saia da conta e peça para parar o serviço.

**Telegram no seu computador (sem endereço público):** o Telegram não aceita botão com link `localhost`, então, rodando no computador, o bot manda as mensagens sem o botão "Abrir no painel"; publicado com HTTPS, o botão aparece.

No Codex ou no Claude Code a lógica é a mesma: descompacte o ZIP numa pasta, abra o Claude Code (ou o Codex) nela e envie os mesmos pedidos; o sistema roda no seu computador (http://localhost:3241) e o bot funciona no modo de escuta, sem endereço público.

## Pedidos para copiar

### 1. Instalar e rodar (com o bot em modo de escuta)

```text
Este ZIP é o sistema GICON · Síndico Inteligente para Administração de Condomínios. Descompacte, instale e rode o sistema em modo de produção (build e start) aqui no seu computador na nuvem, na porta 3241, que é a do GICON. Configure a variável APP_URL com o endereço público HTTPS que você criar para o sistema, num endereço só dele. O bot do Telegram funciona aqui no modo de escuta (polling), sem webhook: coloque no arquivo .env.local o token do meu bot em TELEGRAM_BOT_TOKEN e o usuário do bot, sem o @, em TELEGRAM_BOT_USERNAME, e deixe rodando, ao lado do sistema, o processo "npm run telegram:polling" (se ele parar, ligue de novo; ele também roda as rotinas do dia). O banco local aceita uma conexão por vez: antes de rodar qualquer script que mexa no banco, pare o sistema e ligue de novo depois (o processo do Telegram não abre o banco e pode continuar). Quando estiver funcionando, me passe o link para eu abrir no navegador e entrar com a conta de demonstração. Token do bot: [cole aqui o token que o @BotFather te deu] · Usuário do bot: [cole aqui o usuário do bot, sem o @]
```

**Sem bot ainda: apague a última frase e a parte do Telegram; o painel funciona sem ele.** Fica assim:

```text
Este ZIP é o sistema GICON · Síndico Inteligente para Administração de Condomínios. Descompacte, instale e rode o sistema em modo de produção (build e start) aqui no seu computador na nuvem, na porta 3241, que é a do GICON. Configure a variável APP_URL com o endereço público HTTPS que você criar para o sistema, num endereço só dele. O banco local aceita uma conexão por vez: antes de rodar qualquer script que mexa no banco, pare o sistema e ligue de novo depois. Quando estiver funcionando, me passe o link para eu abrir no navegador e entrar com a conta de demonstração.
```

### 2. Colocar a chave de IA

```text
Coloque esta chave da Anthropic no arquivo .env.local do sistema, na variável ANTHROPIC_API_KEY, reinicie o sistema e o processo do Telegram, e me confirme quando a IA estiver conectada (na página Integrações, o "Testar conexão" da IA precisa mostrar o modelo e os tokens). Chave: [cole aqui a sua chave]
```

### 3. Criar a sua versão (uma adaptação real)

```text
Agora crie a minha versão. Adapte o GICON para uma administradora de condomínios comerciais (salas e lojas): troque o nome exibido no topo, no menu, na tela de entrada e nas mensagens do bot para "Gestão de Condomínios Comerciais" e use azul-petróleo e laranja na paleta inteira, nos temas claro e escuro. Na tabela de modelos de vencimento, crie uma versão nova em que o "PMOC (ar-condicionado central)" nasce ativo por padrão, com a referência informada "Lei 13.589/2018; confira o seu caso" e periodicidade de 1 mês, sem mudar os vencimentos que já existem. Em Regras, acrescente a categoria de chamado "Ar-condicionado", com urgência média, prazo de 24 horas, responsável o zelador, e um passo de autoajuda aprovado: "Confira se o termostato da sala está ligado e no modo frio". Acrescente a expressão de emergência "alarme de incêndio tocando" ao grupo de fogo e gás, e mude a janela de envio padrão dos condomínios novos para 7h às 19h. Faça isso também na conta de demonstração, para eu abrir Vencimentos e ver o PMOC para conferir, abrir Regras e ver a categoria nova, e escrever no Telegram "o ar da sala 12 não liga" e receber o passo de autoajuda. Lembre que o banco local aceita uma conexão por vez: pare o sistema antes de rodar scripts no banco. Mantenha tudo funcionando, rode os testes, rode de novo e me passe o link da nova versão.
```

### Publicar na sua conta da Vercel (quando for usar de verdade)

```text
Agora publique o GICON na minha conta da Vercel, para o condomínio usar de verdade. Quando precisar entrar na minha conta do GitHub, da Vercel ou do Neon, pare e me peça para fazer o login eu mesmo no navegador; nunca me peça senha no chat. Faça assim: 1) crie um repositório privado no meu GitHub com o código desta versão e importe na Vercel, na região gru1 (São Paulo), que já está no vercel.json; 2) no painel da Vercel, em Storage, crie um banco Neon na região AWS sa-east-1 (São Paulo) e ligue ao projeto (DATABASE_URL com a conexão pooled) e crie um Blob privado ligado ao projeto; 3) cadastre as variáveis do projeto: APP_URL com o endereço https que a Vercel der, AUTH_SECRET, CRON_SECRET e CHAVE_CIFRA_DADOS (gere cada uma com openssl rand -hex 32), TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET (gere um com letras e números) e ANTHROPIC_API_KEY com a mesma chave do pedido 2; 4) faça o deploy (o build cria o banco e a conta de demonstração); 5) antes de ligar o webhook, pare aqui o processo npm run telegram:polling, porque o mesmo bot não funciona em dois lugares; 6) no sistema publicado, entre como administrador, abra Integrações e use "Ativar webhook neste endereço" e "Testar conexão" em todos os cartões (Telegram, IA, banco, armazenamento); se o armazenamento falhar, crie um token de leitura e escrita do Blob e cadastre em BLOB_READ_WRITE_TOKEN; 7) em Integrações, use "Rodar agora" no cron diário e me mostre a última execução. Não mude o vercel.json além do que está nele. Me diga, no fim, que o plano Hobby é só para avaliação e que, para o condomínio em operação, preciso mudar o projeto para o plano Pro; se eu já estiver no Pro, acrescente ao vercel.json a linha do cron frequente que está em docs/INTEGRACOES.md e publique de novo. Me passe o link publicado.
```

Fora da Vercel, com webhook: o README ensina a criar no cron-job.org duas tarefas, GET `{APP_URL}`/api/cron/diario uma vez por dia às 08:00 e GET `{APP_URL}`/api/cron/frequente a cada 15 minutos, com o cabeçalho Authorization: Bearer <CRON_SECRET>; qualquer agendador que faça esse GET com o cabeçalho serve.

## Plano da Vercel e custos

- **Vercel:** o plano Hobby (grátis) é só para avaliar: é de uso pessoal e não comercial e roda o cron uma vez por dia. Condomínio em operação (síndico profissional, administradora e também o síndico morador) usa o **Pro**, que libera o cron frequente. A emergência não depende de cron.
- **IA:** opcional, cobra por uso na sua conta da Anthropic. O sistema usa o Claude Haiku 5.5 com esforço baixo e grava o custo de cada uso (em Integrações); medido em 29/10/2026, um condomínio típico de 48 unidades fica em centavos de dólar por mês. O teto padrão é de US$ 5 por mês por conta.
- **Telegram, BrasilAPI e ViaCEP:** sem custo e sem chave (o Telegram só pede o token do seu bot).

## LGPD e responsabilidade

- Todo convite mostra o termo antes do vínculo: os dados passam pelo Telegram e, quando a IA está ligada, pela Anthropic, as duas fora do Brasil, sem nome nem contato dos moradores nas chamadas da IA.
- O morador só vê o que é dele (os próprios chamados, dúvidas e os comunicados). Na **Mudança**, quem sai é desvinculado e o novo morador não vê nada do anterior; o histórico fica com a unidade.
- Funcionário da portaria contratada usa o **celular do posto**, não o pessoal; ninguém precisa responder fora do horário.
- **Não declare o bot como canal único:** a portaria e o telefone do condomínio continuam valendo.
- Nada se apaga em chamados, despesas e auditoria: correção é um evento novo, ou estorno com motivo. **Exportar tudo** (em Integrações) baixa um ZIP com os CSVs.

Mais detalhes técnicos: `README.md`, `docs/MANUAL-DO-BOT.md` (comandos por papel), `docs/INTEGRACOES.md` e a página **Integrações** dentro do sistema.
