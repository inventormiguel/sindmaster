import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { condominios, duvidas, pessoas, trechos, type Citacao } from "@/db/schema";
import { chamarIAJson, delimitar, iaDisponivel, pseudonimizar, REGRA_DADOS } from "@/lib/ia/funcoes";
import { expressoesProibidasEm, IDENTIFICACAO_IA, normalizar, RODAPE_DUVIDA } from "@/lib/negocio/linguagem";
import { auditar } from "@/lib/negocio/auditoria";
import { enfileirarAvisoPessoa } from "@/lib/telegram/avisos";
import { agendarEnvioDaFila } from "@/lib/negocio/fila";
import { trechosParaRespostas } from "@/features/documentos/servico";
import { buscarTrechos, estimarTokens } from "@/features/documentos/divisao";

/**
 * Dúvidas dos moradores com CITAÇÃO LITERAL conferida por código (IA1).
 * - Desvio por código ANTES da IA: dados de outra unidade, dívida de terceiros, contato, placa, injeção.
 * - Documentos do condomínio inteiros quando cabem em ~12 mil tokens; acima disso, busca com OU e sinônimos (8 trechos).
 * - Conferência: cada citação existe no trecho; todo "art. N" da resposta está nas citações; sem expressão proibida.
 * - Padrão: a resposta espera o "Enviar" do síndico. Modo automático por condomínio (desligado por padrão).
 */
export const TEXTO_NAO_ENCONTREI = "Não encontrei isso nos documentos do condomínio; encaminhei sua dúvida ao síndico.";
export const TEXTO_DESVIO = "Não informo dados de outros moradores nem de outras unidades. Se for um assunto seu, fale com o síndico.";
export const TEXTO_CONFERENCIA = "Recebi sua dúvida. A resposta, com o trecho dos documentos do condomínio, está sendo conferida pelo síndico e chega por aqui.";
export const LIMITE_TOKENS_TEXTO_INTEIRO = 12000;

const PADROES_DESVIO: RegExp[] = [
  /\bquem\s+(nao\s+)?(pagou|paga|deve|esta\s+devendo|ta\s+devendo|mora|e\s+o\s+dono)\b/,
  /\b(inadimplen\w*|caloteir\w*|devedor\w*)\b/,
  /\b\d{2,4}\b.*\b(devendo|deve|debito\w*|atrasad\w*|em\s+atraso)\b/,
  /\b(devendo|debito\w*|atrasad\w*)\b.*\b\d{2,4}\b/,
  /\b(telefone|celular|e-?mail|placa|cpf)\b.*\b(do|da|de)\b/,
  /\b(nome|contato)\s+d[oa]s?\s+(morador|moradora|proprietari\w*|inquilin\w*|vizinh\w*)/,
  /\bignor\w*\s+(as|todas|suas)?\s*(as\s+)?(instruc\w*|regras)/,
  /\b(liste|listar|lista)\s+(quem|todos|todas|os\s+moradores)/,
];

export function deveDesviar(pergunta: string): boolean {
  const n = normalizar(pergunta);
  return PADROES_DESVIO.some((re) => re.test(n));
}

export const ESQUEMA_IA1 = z.object({
  encontrou: z.boolean(),
  pedeDecisaoDoSindico: z.boolean(),
  resposta: z.string().max(600),
  citacoes: z.array(z.object({ trechoId: z.string().max(60), textoLiteral: z.string().min(10).max(400) })).max(3),
});

function semAcentoEspaco(t: string) {
  return normalizar(t).replace(/[“”"'`´]/g, "").replace(/[^a-z0-9 ,.;:%$/()-]/g, " ").replace(/\s+/g, " ").trim();
}

/** Conferência por código da resposta da IA1. Devolve as citações válidas ou o motivo da recusa. */
export function conferirResposta(r: z.infer<typeof ESQUEMA_IA1>, disponiveis: { id: string; rotulo: string; texto: string }[]): { ok: true; citacoes: Citacao[] } | { ok: false; motivo: string } {
  const validas: Citacao[] = [];
  for (const c of r.citacoes) {
    const tr = disponiveis.find((t) => t.id === c.trechoId);
    if (!tr) return { ok: false, motivo: "citação de trecho inexistente" };
    if (!semAcentoEspaco(tr.texto).includes(semAcentoEspaco(c.textoLiteral))) return { ok: false, motivo: `citação não literal (${tr.rotulo})` };
    validas.push({ trechoId: tr.id, rotulo: tr.rotulo, textoLiteral: c.textoLiteral.trim() });
  }
  if (r.encontrou && validas.length === 0) return { ok: false, motivo: "sem citação" };
  const numeros = [...normalizar(r.resposta).matchAll(/\b(?:art\.?|artigo)\s*(\d+)/g)].map((m) => m[1]);
  const citados = validas.map((c) => normalizar(c.rotulo).match(/art\. (\d+)/)?.[1]).filter(Boolean);
  for (const n of numeros) if (!citados.includes(n)) return { ok: false, motivo: `artigo ${n} sem citação` };
  const proibidas = expressoesProibidasEm(r.resposta);
  if (proibidas.length) return { ok: false, motivo: `expressão proibida: ${proibidas.join(", ")}` };
  return { ok: true, citacoes: validas };
}

/** Texto que o morador recebe: a IA se identifica, com a citação literal e o rodapé fixo. */
export function montarMensagemResposta(p: { resposta: string; citacoes: Citacao[]; conferidaPor?: string | null; encaminhada?: boolean }): string {
  const cab = p.conferidaPor ? `${IDENTIFICACAO_IA} (conferida por ${p.conferidaPor}):` : `${IDENTIFICACAO_IA}:`;
  const cit = p.citacoes.map((c) => `${c.rotulo}: "${c.textoLiteral}"`).join("\n");
  const penalidade = /multa|advertencia|penalidade/.test(normalizar(p.resposta + cit)) ? "\nA aplicação de qualquer penalidade é decisão do síndico." : "";
  return [cab, "", p.resposta.trim(), "", cit, penalidade, p.encaminhada ? "\nEncaminhei ao síndico para avaliar o seu caso." : "", "", RODAPE_DUVIDA].filter((x) => x !== "").join("\n");
}

export const TECLADO_FALAR_SINDICO = (duvidaId: string) => [[{ text: "Falar com o síndico", callback_data: `fs:d:${duvidaId}` }]];

export type ResultadoDuvida = { duvida: typeof duvidas.$inferSelect; mensagemMorador: string; teclado?: { text: string; callback_data: string }[][] };

export async function receberDuvida(p: { organizacaoId: string; condominioId: string; pessoaId: string | null; pergunta: string }): Promise<ResultadoDuvida> {
  const pergunta = p.pergunta.trim().slice(0, 1000);
  const base = { organizacaoId: p.organizacaoId, condominioId: p.condominioId, pessoaId: p.pessoaId, pergunta };
  if (deveDesviar(pergunta)) {
    const [d] = await db.insert(duvidas).values({ ...base, estado: "desviada", motivoEncaminhamento: "desvio por código (dado de terceiro ou instrução)" }).returning();
    return { duvida: d, mensagemMorador: TEXTO_DESVIO };
  }
  const encaminhar = async (motivo: string, extra: Partial<typeof duvidas.$inferInsert> = {}, mensagem = TEXTO_NAO_ENCONTREI) => {
    const [d] = await db.insert(duvidas).values({ ...base, estado: "encaminhada", motivoEncaminhamento: motivo, ...extra }).returning();
    await avisarSindicos(p.organizacaoId, p.condominioId, `Dúvida de morador esperando você: "${pergunta.slice(0, 200)}". Responda no painel (Dúvidas).`, `duvida:${d.id}`);
    return { duvida: d, mensagemMorador: mensagem, teclado: TECLADO_FALAR_SINDICO(d.id) };
  };
  if (!iaDisponivel()) return encaminhar("IA não conectada", {}, "Recebi sua dúvida e encaminhei ao síndico. A resposta chega por aqui.");

  const ia = await perguntarIA1({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, pergunta });
  if (ia.tipo === "sem_documentos") return encaminhar("sem documentos para consulta");
  if (ia.tipo === "sem_trecho") return encaminhar("nenhum trecho relacionado");
  if (ia.tipo === "falha_ia") return encaminhar(`IA: ${ia.mensagem}`, {}, "Recebido. O síndico vai ver e responder por aqui.");
  if (ia.tipo === "recusada") return encaminhar(`resposta recusada pela conferência: ${ia.motivo}`);
  if (ia.tipo !== "ok") return encaminhar("não está nos documentos");
  const r = { dados: ia.dados, execucaoId: ia.execucaoId };
  const conf = { citacoes: ia.citacoes };
  if (r.dados.pedeDecisaoDoSindico) {
    const res = await encaminhar("pede decisão do síndico", { resposta: r.dados.resposta, citacoes: conf.citacoes, pedeDecisao: true }, montarMensagemResposta({ resposta: r.dados.resposta, citacoes: conf.citacoes, encaminhada: true }));
    return res;
  }
  const [c] = await db.select({ modo: condominios.modoRespostaDuvida }).from(condominios).where(eq(condominios.id, p.condominioId)).limit(1);
  if (c?.modo === "automatico_com_citacao") {
    const [d] = await db.insert(duvidas).values({ ...base, estado: "respondida_documentos", resposta: r.dados.resposta, origemResposta: "ia", citacoes: conf.citacoes, enviadaEm: new Date(), aiRunId: r.execucaoId }).returning();
    return { duvida: d, mensagemMorador: montarMensagemResposta({ resposta: r.dados.resposta, citacoes: conf.citacoes }), teclado: TECLADO_FALAR_SINDICO(d.id) };
  }
  const [d] = await db.insert(duvidas).values({ ...base, estado: "aguardando_envio", resposta: r.dados.resposta, origemResposta: "ia", citacoes: conf.citacoes, aiRunId: r.execucaoId }).returning();
  await avisarSindicos(p.organizacaoId, p.condominioId, `Resposta da IA esperando conferência: "${pergunta.slice(0, 160)}". Envie /aprovar.`, `duvida-aprovar:${d.id}`);
  return { duvida: d, mensagemMorador: TEXTO_CONFERENCIA, teclado: TECLADO_FALAR_SINDICO(d.id) };
}

export type ResultadoIA1 =
  | { tipo: "sem_documentos" | "sem_trecho" }
  | { tipo: "falha_ia"; mensagem: string }
  | { tipo: "recusada"; motivo: string }
  | { tipo: "nao_encontrou" }
  | { tipo: "ok"; dados: z.infer<typeof ESQUEMA_IA1>; citacoes: Citacao[]; execucaoId: string };

/** IA1 sem gravar a dúvida (usada pela dúvida do morador e pelo diagnóstico). A citação é conferida pelo código. */
export async function perguntarIA1(p: { organizacaoId: string; condominioId: string; pergunta: string }): Promise<ResultadoIA1> {
  const pergunta = p.pergunta;
  const todos = await trechosParaRespostas(p.organizacaoId, p.condominioId);
  if (todos.length === 0) return { tipo: "sem_documentos" };
  const total = todos.reduce((s, t) => s + estimarTokens(t.texto) + 10, 0);
  const selecionados = total <= LIMITE_TOKENS_TEXTO_INTEIRO ? todos : buscarTrechos(pergunta, todos, 8);
  if (selecionados.length === 0) return { tipo: "sem_trecho" };

  const nomes = (await db.select({ nome: pessoas.nome }).from(pessoas).where(eq(pessoas.condominioId, p.condominioId))).map((x) => x.nome);
  const perguntaSegura = pseudonimizar(pergunta, nomes, { tirarUnidade: true });
  const corpus = selecionados.map((t) => `[${t.id}] ${t.rotulo}\n${t.texto}`).join("\n\n");
  const sistema = `Você responde dúvidas de moradores de um condomínio no Brasil usando SOMENTE os trechos dos documentos do condomínio fornecidos.
Regras:
- Se algum trecho trata do assunto da pergunta, mesmo sem um "sim" ou "não" direto, encontrou=true: responda dizendo o que o trecho estabelece e cite-o.
- Se nenhum trecho trata do assunto, devolva encontrou=false e citacoes=[].
- Cada citação traz o trechoId e um textoLiteral copiado EXATAMENTE do trecho (10 a 400 caracteres).
- Na resposta (até 600 caracteres, em português simples), cite o artigo só se ele estiver nas citações.
- Se a pergunta pede decisão sobre um caso concreto (conflito entre vizinhos, quem paga um conserto específico do apartamento de alguém, cobrança, "o condomínio paga o meu…"), pedeDecisaoDoSindico=true, mesmo que um trecho trate do assunto.
- Nunca fale de lei geral, nunca dê parecer jurídico, nunca diga que alguém será multado.
${REGRA_DADOS}
Formato: {"encontrou":bool,"pedeDecisaoDoSindico":bool,"resposta":"...","citacoes":[{"trechoId":"...","textoLiteral":"..."}]}`;
  const r = await chamarIAJson({
    organizacaoId: p.organizacaoId,
    funcao: "IA1",
    system: sistema,
    esquema: ESQUEMA_IA1,
    conteudo: [{ type: "text", text: `${delimitar("TRECHOS", corpus)}\n\n${delimitar("PERGUNTA", perguntaSegura)}` }],
  });
  if (!r.ok) return { tipo: "falha_ia", mensagem: r.mensagem };
  const conf = conferirResposta(r.dados, selecionados);
  if (!conf.ok) return { tipo: "recusada", motivo: conf.motivo };
  if (!r.dados.encontrou) return { tipo: "nao_encontrou" };
  return { tipo: "ok", dados: r.dados, citacoes: conf.citacoes, execucaoId: r.execucaoId };
}

export async function avisarSindicos(organizacaoId: string, condominioId: string, texto: string, chave: string) {
  const sindicos = await db.select({ id: pessoas.id }).from(pessoas).where(and(eq(pessoas.condominioId, condominioId), eq(pessoas.papel, "sindico")));
  for (const s of sindicos) {
    await enfileirarAvisoPessoa({ organizacaoId, pessoaId: s.id, categoria: "sindico", texto, chaveIdempotencia: `${chave}:${s.id}` });
  }
  if (sindicos.length) agendarEnvioDaFila(organizacaoId);
}

async function carregar(organizacaoId: string, id: string) {
  const [d] = await db.select().from(duvidas).where(and(eq(duvidas.id, id), eq(duvidas.organizacaoId, organizacaoId))).limit(1);
  if (!d) throw new Error("Dúvida não encontrada.");
  return d;
}

/** Síndico confere e envia a resposta da IA (ou a editada). */
export async function enviarRespostaConferida(p: { organizacaoId: string; duvidaId: string; quem: string; respostaEditada?: string | null }) {
  const d = await carregar(p.organizacaoId, p.duvidaId);
  if (d.estado !== "aguardando_envio") throw new Error("Esta dúvida não está esperando conferência.");
  const resposta = p.respostaEditada?.trim() || d.resposta || "";
  if (expressoesProibidasEm(resposta).length) throw new Error(`A resposta tem expressão proibida (${expressoesProibidasEm(resposta).join(", ")}). Edite antes de enviar.`);
  await db.update(duvidas).set({ estado: "respondida_documentos", resposta, origemResposta: p.respostaEditada?.trim() ? "sindico" : "ia", assumidaEm: new Date(), respondidaPorNome: p.quem, respondidaEm: new Date(), enviadaEm: new Date() }).where(eq(duvidas.id, d.id));
  if (d.pessoaId) {
    await enfileirarAvisoPessoa({ organizacaoId: p.organizacaoId, pessoaId: d.pessoaId, categoria: "duvida", texto: montarMensagemResposta({ resposta, citacoes: d.citacoes ?? [], conferidaPor: p.quem }), teclado: TECLADO_FALAR_SINDICO(d.id), chaveIdempotencia: `duvida-resposta:${d.id}` });
    agendarEnvioDaFila(p.organizacaoId);
  }
  await auditar({ organizacaoId: p.organizacaoId, condominioId: d.condominioId, ator: p.quem, acao: "duvida.resposta_enviada", alvo: d.id });
}

/** Síndico responde ele mesmo (dúvida encaminhada ou "Responder eu mesmo"). Pode salvar como resposta do condomínio. */
export async function responderPeloSindico(p: { organizacaoId: string; duvidaId: string; quem: string; resposta: string; salvarComoResposta: boolean }) {
  const d = await carregar(p.organizacaoId, p.duvidaId);
  if (!["encaminhada", "aguardando_envio"].includes(d.estado)) throw new Error("Esta dúvida já foi respondida.");
  const resposta = p.resposta.trim();
  if (resposta.length < 3) throw new Error("Escreva a resposta.");
  let trechoId: string | null = null;
  if (p.salvarComoResposta) {
    const [t] = await db
      .insert(trechos)
      .values({ organizacaoId: p.organizacaoId, condominioId: d.condominioId, rotulo: `Resposta do condomínio (${p.quem}, ${new Date().toLocaleDateString("pt-BR")})`, texto: `Pergunta: ${d.pergunta}\nResposta: ${resposta}`, origem: "resposta_sindico", autorRotulo: p.quem })
      .returning({ id: trechos.id });
    trechoId = t.id;
  }
  await db.update(duvidas).set({ estado: "respondida_sindico", resposta, origemResposta: "sindico", assumidaEm: d.assumidaEm ?? new Date(), citacoes: null, respondidaPorNome: p.quem, respondidaEm: new Date(), enviadaEm: new Date(), salvaComoTrechoId: trechoId }).where(eq(duvidas.id, d.id));
  if (d.pessoaId) {
    await enfileirarAvisoPessoa({ organizacaoId: p.organizacaoId, pessoaId: d.pessoaId, categoria: "duvida", texto: `Resposta do síndico à sua dúvida "${d.pergunta.slice(0, 120)}":\n\n${resposta}`, chaveIdempotencia: `duvida-resposta:${d.id}` });
    agendarEnvioDaFila(p.organizacaoId);
  }
  await auditar({ organizacaoId: p.organizacaoId, condominioId: d.condominioId, ator: p.quem, acao: "duvida.respondida_pelo_sindico", alvo: d.id, detalhe: { salva: p.salvarComoResposta } });
}

/** Botão "Falar com o síndico": a dúvida vai para a fila do síndico. */
export async function pedirSindico(p: { organizacaoId: string; duvidaId: string }) {
  const d = await carregar(p.organizacaoId, p.duvidaId);
  if (d.estado === "respondida_documentos" || d.estado === "aguardando_envio") {
    await db.update(duvidas).set({ estado: "encaminhada", motivoEncaminhamento: "morador pediu para falar com o síndico" }).where(eq(duvidas.id, d.id));
  }
  await avisarSindicos(p.organizacaoId, d.condominioId, `Um morador pediu para falar com você sobre a dúvida "${d.pergunta.slice(0, 160)}". Veja no painel (Dúvidas).`, `falar-sindico:${d.id}`);
}
