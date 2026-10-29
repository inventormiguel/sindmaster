# Manual do bot (Telegram)

Um bot por instalação; o papel vem do vínculo (convite de uso único). Uma conta do Telegram pode ter vínculos em
vários condomínios: toda mensagem começa com "Condomínio · papel" e `/condominio` troca o condomínio da conversa.
Moradores, funcionários e prestadores falam com o bot no privado. Este manual é conferido por teste: todo comando
citado aqui existe no roteador, e todo comando do roteador está aqui.

## Todos

| Comando | O que faz |
|---|---|
| `/ajuda` | Lista os comandos do seu papel |
| `/eu` | Mostra com qual cadastro este Telegram está ligado |
| `/condominio` | Troca o condomínio da conversa (quando há mais de um vínculo) |
| `/sair` | Solta o vínculo do condomínio atual (morador: vira pedido de mudança para o síndico) |

## Síndico

| Comando | O que faz |
|---|---|
| `/hoje` | Resumo do condomínio atual, com os botões "Vencimentos", "Prestadores" e "Abrir no painel" |
| `/aprovar` | Itens para conferir e aprovar: respostas da IA, recibos e boletos, certidões, comprovantes, comunicados, mudanças |
| `/pendencias` | Dúvidas encaminhadas, pedidos "Falar com o síndico", chamados parados, alertas |
| `/recibo` | Pede a foto ou o PDF; a IA lê e devolve para você conferir (boleto: "Conferi o beneficiário no app do banco") |
| `/aviso` | Pede os tópicos; a IA escreve o rascunho; "Aprovar e enviar" ou "Editar no painel" |

## Funcionário

| Comando | O que faz |
|---|---|
| `/rotina` | Tarefas de hoje: "Feito" (pede a foto quando exigida) ou "Não deu" (pede o motivo) |
| `/chamado` | Abre chamado, inclusive em nome de uma unidade (digite o número, ex.: 302) |
| `/chamados` | Chamados com você; "Resolvido" pede a foto do serviço |
| `/ocorrencia` | Registra uma ocorrência (texto e foto) |

O sistema registra tarefas feitas, não a jornada. Você não precisa responder fora do seu horário.

## Morador

| Comando | O que faz |
|---|---|
| `/duvida` | Pergunta sobre as regras; a resposta cita o artigo do regimento ou da convenção |
| `/chamado` | Abre chamado com até 4 fotos; pode vir um passo de autoajuda ("Resolveu" / "Não resolveu") |
| `/meus` | Seus chamados e dúvidas, com o andamento |
| `/documentos` | Documentos do condomínio, enviados como arquivo |

Texto sem comando: o bot pergunta "É uma dúvida ou um problema para consertar?". Palavras de emergência (gás, fumaça,
fogo, alagamento, preso no elevador, choque…) pulam tudo: mensagem de segurança com o 193 e aviso na hora ao síndico.

## Prestador

| Comando | O que faz |
|---|---|
| `/os` | Serviços atribuídos a você, com data |
| `/concluir` | Fotos do serviço, comprovante (PDF) e nota |
| `/certidao` | Envia certidão ou apólice; o síndico confere antes de valer |

## Botões

`ap:` (enviar resposta ou aprovar comunicado), `rs:` (responder eu mesmo), `bf:` (conferi o beneficiário), `cf:`
(conferir despesa, documento ou comprovante), `rc:` (recusar), `hj:` (vencimentos e prestadores do /hoje), `pd:`
(pedir documento), `rt:` (rotina: feito / não deu), `ch:` (resolvido; morador: resolvido / não resolvido), `aa:`
(autoajuda), `fs:` (falar com o síndico), `cat:` (categoria sem IA), `pr:` (pronto / sem foto), `lv:` (dúvida ou
problema), `dc:` (documento), `li:` (Li o aviso), `fd:` (destino do arquivo sem estado), `ctx:` (trocar condomínio),
`tm:` (termo do convite), `sair:` (confirmar saída).
