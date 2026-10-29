# Roadmap

## Pronto

- Base: conta multi-organização, login/cadastro com demonstração, Integrações, módulo Telegram (webhook com segredo,
  polling local, fila com limites, convites de uso único).
- Extensões da base: conta do Telegram com vários vínculos e `/condominio` (B1); estado de conversa e álbuns (B2);
  fila que anda com `after()` e emergência por envio direto (B3); menu do Telegram por papel e por chat (B4); Blob
  com OIDC (B5); agendador do modo local (B6); `maxDuration` 300 e diário em fila de trabalho (B7).
- Obrigatórios: carteira, acessos por condomínio, unidades com vários moradores, convites em lote imprimíveis,
  Mudança, Hoje, painel de valor; chamados (triagem, emergência, autoajuda, responsável padrão, confirmação do
  morador, portaria pela unidade, ocorrências); rotinas com foto (sem jornada); vencimentos; prestadores com
  documentos e alerta de pagamento; despesas conferidas sem apagar; documentos, dúvidas com citação literal e
  diagnóstico; resumo diário; Integrações, Saúde do sistema, Exportar tudo,
  auditoria e LGPD.

## Desejável (próximas tarefas)

- [ ] D1 Alçada do conselho: aprovação de despesa por conselheiros acima de um valor (hoje a alçada existe e quem
      aprova é o síndico ou o admin).
- [ ] D2 Lembretes por período (rotina da noite às 19h, hora-limite passada, chamado alto sem responsável há 2 h,
      escalonamento ao subsíndico). A rota `/api/cron/frequente` já existe e consome a fila e as rotinas da janela.
- [ ] D3 Responder à mensagem do chamado vira comentário (mapear `reply_to_message`).
- [ ] D5 Texto do resumo pela IA (IA7) com guardrail de números. Hoje o resumo é texto do código.
- [ ] D6 Relatório mensal em PDF e envio no dia 1. Hoje: página Valor com Imprimir e CSV.
- [ ] D7 Cópia das pendências ao supervisor da empresa contratada.
- [ ] D8 Preferência de notificação por pessoa.
- [ ] D9 "Exportar tudo" com os arquivos binários (hoje: CSVs, com os arquivos listados).
- [ ] D10 Ler PDF escaneado de regimento e convenção pela IA (hoje: PDF com texto, DOCX ou texto colado).
- [ ] D11 Comparador de três orçamentos. D12 Conector MCP. D13 Enquete consultiva. D14 Importar unidades por planilha.
- [ ] D16 E-mail (Resend/SMTP) para convites do painel e relatório.
- [ ] Upload do painel direto ao Blob por URL pré-assinada (`/api/upload/presign`). Hoje o upload passa pela função
      (até 4 MB por arquivo; pelo Telegram, até 20 MB).
- [ ] Busca com `to_tsquery` e `ts_rank_cd` no Postgres quando o texto dos documentos passar de 12 mil tokens (hoje:
      busca por termos com OU e sinônimos no código, igual no PGlite e no Neon).
- [ ] Gestão de usuários do painel (convite por e-mail); hoje os acessos por condomínio são dados em Condomínios.
- [ ] Modo escuro.

## Fora do MVP (de propósito)

- Ponto, entrada e saída, turno, horas, localização, "hora de chegada" (Portaria MTP 671/2021 e CLT, art. 74).
- Encomendas na portaria (fase 2), assembleia e votação, advertência e multa, boletos de cota e cobrança,
  contabilidade, reservas, visitantes, câmeras, fórum entre moradores, áudio, outros mensageiros além do Telegram, SMS, aplicativo próprio,
  modo offline, "lei embutida" por cidade, resposta da IA sobre lei geral.
