import { randomUUID } from "node:crypto";
import { and, eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { comunicadoEntregas, comunicados, condominios, envios, pessoas, unidades } from "@/db/schema";
import { chamarIAJson, delimitar, pseudonimizar, REGRA_DADOS } from "@/lib/ia/funcoes";
import { expressoesProibidasEm } from "@/lib/negocio/linguagem";
import { enfileirarAvisoPessoa } from "@/lib/telegram/avisos";
import { agendarEnvioDaFila } from "@/lib/negocio/fila";
import { auditar } from "@/lib/negocio/auditoria";

export const ESQUEMA_IA6 = z.object({ titulo: z.string().min(3).max(80), texto: z.string().min(10).max(1200) });

/** Números (datas, horas, valores) que aparecem num texto, normalizados ("8h" = "08:00", "31/10" = "31/10"). */
export function numerosDoTexto(t: string): string[] {
  const out = new Set<string>();
  const s = t.replace(/(\d{1,2})h(\d{2})?\b/gi, (_m, h, m) => `${h.padStart(2, "0")}:${m ?? "00"}`);
  for (const m of s.matchAll(/\b(\d{1,2})[/.](\d{1,2})(?:[/.](\d{2,4}))?\b/g)) out.add(`${Number(m[1])}/${Number(m[2])}`);
  for (const m of s.matchAll(/\b(\d{1,2}):(\d{2})\b/g)) out.add(`${Number(m[1])}:${m[2]}`);
  const semDatas = s.replace(/\b\d{1,2}[/.]\d{1,2}(?:[/.]\d{2,4})?\b/g, " ").replace(/\b\d{1,2}:\d{2}\b/g, " ");
  for (const m of semDatas.matchAll(/\b\d+(?:[.,]\d+)?\b/g)) out.add(m[0].replace(",", "."));
  return [...out];
}

/** Guardrail da IA6: datas e horas só as dos tópicos; nada de unidade ou nome; sem expressão proibida. */
export function conferirRascunho(topicos: string, r: { titulo: string; texto: string }): string[] {
  const problemas: string[] = [];
  const permitidos = new Set(numerosDoTexto(topicos));
  // Partes das datas e horas dos tópicos também valem ("31/10" permite "dia 31"; "08:00" permite "8").
  for (const n of [...permitidos]) {
    for (const parte of n.split(/[/:]/)) permitidos.add(String(Number(parte)));
  }
  for (const n of numerosDoTexto(`${r.titulo} ${r.texto}`)) if (!permitidos.has(n)) problemas.push(`número ou data que não está nos tópicos: ${n}`);
  if (/\b(apto\.?|apartamento|unidade)\s*n?º?\s*\d+/i.test(r.texto)) problemas.push("cita unidade num comunicado geral");
  const proib = expressoesProibidasEm(`${r.titulo} ${r.texto}`);
  if (proib.length) problemas.push(`expressão proibida: ${proib.join(", ")}`);
  return problemas;
}

/** IA6 · rascunho do comunicado a partir dos tópicos do síndico. Nada entra na fila antes da aprovação. */
export async function rascunharComunicadoIA(p: { organizacaoId: string; condominioId: string; topicos: string; tom?: "informativo" | "urgente"; nomes?: string[] }) {
  const [c] = await db.select({ nome: condominios.nome }).from(condominios).where(eq(condominios.id, p.condominioId)).limit(1);
  const sistema = `Você escreve comunicados curtos e claros do síndico para os moradores de um condomínio no Brasil.
Use SOMENTE as datas, horas e números dos tópicos (não invente nenhum). Não cite unidades nem nomes de pessoas. Tom ${p.tom ?? "informativo"}.
Formato: {"titulo": "até 80 caracteres", "texto": "até 1200 caracteres"}.
${REGRA_DADOS}`;
  const r = await chamarIAJson({
    organizacaoId: p.organizacaoId,
    funcao: "IA6",
    system: sistema,
    esquema: ESQUEMA_IA6,
    conteudo: [{ type: "text", text: `Condomínio: ${c?.nome ?? ""}\n${delimitar("TOPICOS", pseudonimizar(p.topicos, p.nomes ?? []))}` }],
  });
  if (!r.ok) return { ok: false as const, mensagem: r.mensagem };
  const problemas = conferirRascunho(p.topicos, r.dados);
  return { ok: true as const, ...r.dados, problemas };
}

export async function criarRascunho(p: { organizacaoId: string; condominioId: string; topicos: string | null; titulo: string; texto: string; origemTexto: "ia" | "sindico"; publico?: "moradores" | "todos" | "bloco"; publicoValor?: string | null }) {
  const [c] = await db
    .insert(comunicados)
    .values({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, topicos: p.topicos, titulo: p.titulo.trim().slice(0, 120), texto: p.texto.trim().slice(0, 3500), origemTexto: p.origemTexto, publico: p.publico ?? "moradores", publicoValor: p.publicoValor ?? null })
    .returning();
  return c;
}

/** Aprova e enfileira para os vinculados (um envio por pessoa, com o botão "Li o aviso"). Comunicado não aprovado nunca entra na fila. */
export async function aprovarEEnviar(p: { organizacaoId: string; comunicadoId: string; quem: string; titulo?: string; texto?: string }) {
  const [c] = await db.select().from(comunicados).where(and(eq(comunicados.id, p.comunicadoId), eq(comunicados.organizacaoId, p.organizacaoId))).limit(1);
  if (!c) throw new Error("Comunicado não encontrado.");
  if (c.estado !== "rascunho") throw new Error("Este comunicado já foi enviado.");
  const titulo = p.titulo?.trim() || c.titulo;
  const texto = p.texto?.trim() || c.texto;
  if (expressoesProibidasEm(`${titulo} ${texto}`).length) throw new Error(`O texto tem expressão proibida (${expressoesProibidasEm(`${titulo} ${texto}`).join(", ")}). Edite antes de enviar.`);
  const papeis = c.publico === "todos" ? (["morador", "funcionario"] as const) : (["morador"] as const);
  let lista = await db
    .select()
    .from(pessoas)
    .where(and(eq(pessoas.condominioId, c.condominioId), inArray(pessoas.papel, [...papeis]), isNull(pessoas.saiuEm), isNull(pessoas.removidaEm)));
  if (c.publico === "bloco" && c.publicoValor) {
    const us = await db.select({ id: unidades.id }).from(unidades).where(and(eq(unidades.condominioId, c.condominioId), eq(unidades.bloco, c.publicoValor)));
    const ids = new Set(us.map((u) => u.id));
    lista = lista.filter((x) => x.unidadeId && ids.has(x.unidadeId));
  }
  const [cond] = await db.select({ nome: condominios.nome }).from(condominios).where(eq(condominios.id, c.condominioId)).limit(1);
  await db.update(comunicados).set({ titulo, texto, estado: "enviado", aprovadoPorNome: p.quem, aprovadoEm: new Date(), enviadoEm: new Date() }).where(eq(comunicados.id, c.id));
  let enfileirados = 0;
  for (const pessoa of lista) {
    const entregaId = randomUUID();
    const chave = `comunicado:${c.id}:${pessoa.id}`;
    const r = await enfileirarAvisoPessoa({
      organizacaoId: p.organizacaoId,
      pessoaId: pessoa.id,
      categoria: "comunicado",
      texto: `Comunicado do ${cond?.nome ?? "condomínio"}\n\n${titulo}\n\n${texto}`,
      teclado: [[{ text: "Li o aviso", callback_data: `li:${entregaId}` }]],
      chaveIdempotencia: chave,
    });
    enfileirados += r.enfileirados;
    const [env] = await db.select({ id: envios.id }).from(envios).where(eq(envios.chaveIdempotencia, chave)).limit(1);
    await db.insert(comunicadoEntregas).values({ id: entregaId, organizacaoId: p.organizacaoId, comunicadoId: c.id, pessoaId: pessoa.id, envioId: env?.id ?? null }).onConflictDoNothing();
  }
  agendarEnvioDaFila(p.organizacaoId);
  await auditar({ organizacaoId: p.organizacaoId, condominioId: c.condominioId, ator: p.quem, acao: "comunicado.aprovado_e_enviado", alvo: c.id, detalhe: { destinatarios: lista.length } });
  return { destinatarios: lista.length, enfileirados };
}

/** "Li o aviso": conta uma vez por vínculo (idempotente). */
export async function registrarLeitura(p: { entregaId: string; pessoaId: string }): Promise<"lido" | "ja_lido" | "invalido"> {
  const [e] = await db.select().from(comunicadoEntregas).where(eq(comunicadoEntregas.id, p.entregaId)).limit(1);
  if (!e || e.pessoaId !== p.pessoaId) return "invalido";
  if (e.lidoEm) return "ja_lido";
  const r = await db.update(comunicadoEntregas).set({ lidoEm: new Date() }).where(and(eq(comunicadoEntregas.id, e.id), isNull(comunicadoEntregas.lidoEm))).returning({ id: comunicadoEntregas.id });
  return r.length ? "lido" : "ja_lido";
}

/** Entregues, lidos e falhas de um comunicado (pela fila de envios). */
export async function estatisticas(comunicadoId: string) {
  const l = await db
    .select({ e: comunicadoEntregas, status: envios.status, erro: envios.erro })
    .from(comunicadoEntregas)
    .leftJoin(envios, eq(envios.id, comunicadoEntregas.envioId))
    .where(eq(comunicadoEntregas.comunicadoId, comunicadoId));
  const entregues = l.filter((x) => x.e.exemplo || x.status === "enviado").length;
  const falhas = l.filter((x) => !x.e.exemplo && (x.status === "erro" || x.status === "nao_enviado")).length;
  const pendentes = l.filter((x) => !x.e.exemplo && (x.status === "pendente" || x.status === "enviando")).length;
  const lidos = l.filter((x) => x.e.lidoEm).length;
  return { destinatarios: l.length, entregues, falhas, pendentes, lidos, exemplo: l.some((x) => x.e.exemplo) };
}
