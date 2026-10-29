# Custos de IA medidos

Medição com chave real em 29/10/2026 (`npm run ia:medir`: banco em memória com o seed da demonstração, sem tocar
no banco local), modelo `claude-haiku-5-5` com esforço `low` (US$ 0,10 por milhão de tokens de entrada e US$ 0,50
por milhão de saída, para pedidos de até 100 mil tokens). Os tokens de raciocínio contam como saída e já estão nos
números abaixo. Os tokens de cada chamada ficam gravados em `ai_runs` e aparecem em Integrações (Saúde do sistema).

| Função | O que faz | Tokens de entrada | Tokens de saída | US$ por chamada |
|---|---|---|---|---|
| IA1 | Dúvida do morador com citação literal (regimento e convenção inteiros, 16 artigos + 4 respostas salvas) | ≈ 2.780 | ≈ 510 | ≈ 0,0005 |
| IA2 | Leitura de nota fiscal em PDF (1 página) | 2.264 | 182 | ≈ 0,0003 |
| IA3 | Leitura de certidão em PDF (1 página) | 2.175 | 137 | ≈ 0,0003 |
| IA4 | Triagem de chamado (categoria, pergunta, passo da biblioteca) | ≈ 750 | ≈ 370 | ≈ 0,0003 |
| IA6 | Rascunho de comunicado a partir dos tópicos | 284 | 150 | ≈ 0,0001 |

Resultados da medição: IA1 achou o art. 15 para "mudança no sábado à tarde" e o art. 9º para "cachorro" (busca com
o texto inteiro, sem a armadilha do E lógico); a pergunta do Pix foi respondida pela "resposta do condomínio" salva
pelo síndico; a da infiltração foi ao síndico com o art. 31 da convenção; IA2 leu fornecedor, R$ 1.380,00 e a
categoria; IA3 leu a CND, o titular, a emissão e a validade; IA6 passou na conferência de datas e horas.

Reserva: se o Haiku 5.5 deixar de existir, o sistema usa `ANTHROPIC_MODEL_FALLBACK` (padrão
`claude-haiku-4-5-20251001`, US$ 1 / 5 por milhão, cerca de 6 vezes mais caro por chamada).

## Condomínio típico (48 unidades), por mês

| Função | Chamadas por mês | US$ por mês |
|---|---|---|
| IA1 dúvidas | 25 | 0,013 |
| IA2 recibos e boletos | 20 | 0,006 |
| IA3 certidões e comprovantes | 8 | 0,002 |
| IA4 chamados e ocorrências | 23 | 0,006 |
| IA6 comunicados | 6 | 0,001 |
| **Total** | | **≈ 0,03** (com 30% de margem para segunda tentativa: ≈ US$ 0,04) |

PDF acima de 3 páginas vai só com as 3 primeiras (separadas no servidor); acima de 10 MB não vai à IA. Limite
mensal por conta: US$ 5 (`IA_LIMITE_MENSAL_USD`), com bloqueio ao atingir. Sem chave, todas as telas funcionam à
mão. O resumo diário é texto do código (sem IA).
