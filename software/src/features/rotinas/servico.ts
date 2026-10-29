import { and, asc, eq, inArray, isNull, or } from "drizzle-orm";
import { db } from "@/db";
import { condominios, pessoas, rotinaItens, rotinaModelos } from "@/db/schema";
import { diaDaSemana, hojeISO, horaLocal, partes, ultimoDiaDoMes } from "@/lib/negocio/datas";
import { enfileirarAvisoPessoa } from "@/lib/telegram/avisos";
import { agendarEnvioDaFila } from "@/lib/negocio/fila";

/**
 * Rotinas: TAREFAS feitas, nunca jornada.
 * - Sem entrada, saída, duração, contagem de horas ou localização.
 * - "Manhã, tarde, noite" são rótulos de agrupamento.
 * - A hora da foto aparece só no detalhe do item; listas por pessoa levam só a data.
 * - Terceirizado: a rotina é do POSTO (combinada com a empresa contratada), não da pessoa.
 * - Envio só dentro da janela do condomínio (padrão 8h–18h).
 */
export const ROTULO_PERIODO = { manha: "Manhã", tarde: "Tarde", noite: "Noite" } as const;

type Modelo = typeof rotinaModelos.$inferSelect;

/** Ciclos por mês preservam o dia cadastrado, ajustado ao último dia dos meses curtos. */
export function modeloCaiNoDia(m: Pick<Modelo, "periodicidade" | "diasSemana" | "diaMes"> & Partial<Pick<Modelo, "mesReferencia">>, iso: string): boolean {
  if (m.periodicidade === "diaria" || m.periodicidade === "semanal") {
    const dias = m.diasSemana && m.diasSemana.length ? m.diasSemana : m.periodicidade === "diaria" ? [0, 1, 2, 3, 4, 5, 6] : [1];
    return dias.includes(diaDaSemana(iso));
  }
  const { a, m: mes, d } = partes(iso);
  if (m.periodicidade === "trimestral" && (mes - (m.mesReferencia ?? 1) + 12) % 3 !== 0) return false;
  if (m.periodicidade === "anual" && mes !== (m.mesReferencia ?? 1)) return false;
  const alvo = Math.min(m.diaMes ?? 1, ultimoDiaDoMes(a, mes));
  return d === alvo;
}

/** Gera (idempotente) os itens do dia para um condomínio. */
export async function gerarItensDoDia(organizacaoId: string, condominioId: string, iso = hojeISO()) {
  const modelos = await db
    .select()
    .from(rotinaModelos)
    .where(and(eq(rotinaModelos.organizacaoId, organizacaoId), eq(rotinaModelos.condominioId, condominioId), eq(rotinaModelos.ativo, true)));
  const novos = modelos.filter((m) => modeloCaiNoDia(m, iso));
  if (novos.length === 0) return 0;
  const r = await db
    .insert(rotinaItens)
    .values(novos.map((m) => ({ organizacaoId, condominioId, modeloId: m.id, pessoaId: m.pessoaId, posto: m.posto, data: iso })))
    .onConflictDoNothing()
    .returning({ id: rotinaItens.id });
  return r.length;
}

/** Itens do dia para um funcionário: os dele e os do posto dele. */
export async function itensDoFuncionario(p: { pessoaId: string; condominioId: string; posto: string | null; data?: string }) {
  const data = p.data ?? hojeISO();
  const filtroPessoa = p.posto ? or(eq(rotinaItens.pessoaId, p.pessoaId), eq(rotinaItens.posto, p.posto)) : eq(rotinaItens.pessoaId, p.pessoaId);
  return db
    .select({ item: rotinaItens, modelo: rotinaModelos })
    .from(rotinaItens)
    .innerJoin(rotinaModelos, eq(rotinaModelos.id, rotinaItens.modeloId))
    .where(and(eq(rotinaItens.condominioId, p.condominioId), eq(rotinaItens.data, data), filtroPessoa))
    .orderBy(asc(rotinaModelos.periodoRotulo), asc(rotinaModelos.item));
}

async function carregarItem(organizacaoId: string, itemId: string) {
  const [r] = await db
    .select({ item: rotinaItens, modelo: rotinaModelos })
    .from(rotinaItens)
    .innerJoin(rotinaModelos, eq(rotinaModelos.id, rotinaItens.modeloId))
    .where(and(eq(rotinaItens.id, itemId), eq(rotinaItens.organizacaoId, organizacaoId)))
    .limit(1);
  if (!r) throw new Error("Item não encontrado.");
  return r;
}

/** O funcionário só marca itens dele ou do posto dele. */
export async function podeMarcar(p: { itemId: string; organizacaoId: string; pessoaId: string; posto: string | null }) {
  const r = await carregarItem(p.organizacaoId, p.itemId);
  return r.item.pessoaId === p.pessoaId || (Boolean(p.posto) && r.item.posto === p.posto) ? r : null;
}

export async function marcarFeito(p: { organizacaoId: string; itemId: string; pessoaId: string; arquivoId?: string | null; agora?: Date }) {
  const r = await carregarItem(p.organizacaoId, p.itemId);
  if (r.modelo.fotoObrigatoria && !p.arquivoId) throw new Error("Este item pede foto.");
  await db
    .update(rotinaItens)
    .set({ estado: "feito", motivo: null, arquivoId: p.arquivoId ?? null, fotoRecebidaEm: p.arquivoId ? (p.agora ?? new Date()) : null, marcadoPorPessoaId: p.pessoaId })
    .where(eq(rotinaItens.id, r.item.id));
  return r;
}

/** "Não deu" com motivo: vira pendência para o síndico (nunca cobrança ao funcionário). */
export async function marcarNaoFeito(p: { organizacaoId: string; itemId: string; pessoaId: string; motivo: string }) {
  const r = await carregarItem(p.organizacaoId, p.itemId);
  await db.update(rotinaItens).set({ estado: "nao_feito", motivo: p.motivo.trim().slice(0, 300) || "sem motivo informado", marcadoPorPessoaId: p.pessoaId }).where(eq(rotinaItens.id, r.item.id));
  return r;
}

export function dentroDaJanela(c: { janelaInicio: number; janelaFim: number }, agora = new Date()): boolean {
  const h = horaLocal(agora);
  return h >= c.janelaInicio && h < c.janelaFim;
}

/**
 * Rotina do dia: lista para cada funcionário com Telegram, SÓ dentro da janela do condomínio
 * (padrão 8h–18h, nunca por pessoa); fora dela, espera a próxima chamada. Idempotente por dia e pessoa.
 */
export async function enviarRotinasDoCondominio(condominioId: string, agora = new Date()) {
  const iso = hojeISO(agora);
  const [c] = await db.select().from(condominios).where(eq(condominios.id, condominioId)).limit(1);
  if (!c) return { enfileirados: 0, foraDaJanela: false };
  await gerarItensDoDia(c.organizacaoId, c.id, iso);
  if (!dentroDaJanela(c, agora)) return { enfileirados: 0, foraDaJanela: true };
  const funcs = await db
    .select()
    .from(pessoas)
    .where(and(eq(pessoas.condominioId, c.id), eq(pessoas.papel, "funcionario"), isNull(pessoas.removidaEm), isNull(pessoas.saiuEm)));
  let enfileirados = 0;
  for (const f of funcs) {
    if (!f.telegramChatId) continue;
    const itens = await itensDoFuncionario({ pessoaId: f.id, condominioId: c.id, posto: f.posto, data: iso });
    const pendentes = itens.filter((i) => i.item.estado === "previsto");
    if (pendentes.length === 0) continue;
    const linhas = pendentes.map((i) => `• ${ROTULO_PERIODO[i.modelo.periodoRotulo]}: ${i.modelo.item}${i.modelo.fotoObrigatoria ? " (foto)" : ""}`);
    const posto = f.posto && f.empresaContratada ? ` do posto ${f.posto} (rotina combinada com a ${f.empresaContratada})` : "";
    const r = await enfileirarAvisoPessoa({
      organizacaoId: c.organizacaoId,
      pessoaId: f.id,
      categoria: "rotina",
      texto: `Tarefas de hoje${posto}\n${linhas.join("\n")}\n\nEnvie /rotina para marcar "Feito" (com foto quando pedir) ou "Não deu".`,
      chaveIdempotencia: `rotina:${f.id}:${iso}`,
    });
    enfileirados += r.enfileirados;
    if (r.enfileirados) await db.update(rotinaItens).set({ enviadoEm: agora }).where(inArray(rotinaItens.id, pendentes.map((i) => i.item.id)));
  }
  if (enfileirados) agendarEnvioDaFila(c.organizacaoId);
  return { enfileirados, foraDaJanela: false };
}

export async function enviarRotinasDoDia(agora = new Date()) {
  const conds = await db.select({ id: condominios.id }).from(condominios);
  let enfileirados = 0;
  let foraDaJanela = 0;
  for (const c of conds) {
    const r = await enviarRotinasDoCondominio(c.id, agora);
    enfileirados += r.enfileirados;
    if (r.foraDaJanela) foraDaJanela++;
  }
  return { enfileirados, foraDaJanela };
}

/** Painel: por item e por condomínio (feito, não feito, foto). Por pessoa, só a contagem de itens. */
export async function itensDoPeriodo(organizacaoId: string, condominioId: string, de: string, ate: string) {
  const l = await db
    .select({ item: rotinaItens, modelo: rotinaModelos })
    .from(rotinaItens)
    .innerJoin(rotinaModelos, eq(rotinaModelos.id, rotinaItens.modeloId))
    .where(and(eq(rotinaItens.organizacaoId, organizacaoId), eq(rotinaItens.condominioId, condominioId)));
  return l.filter((x) => x.item.data >= de && x.item.data <= ate);
}

export async function purgarFotosDeRotina(agora = new Date()) {
  const conds = await db.select({ id: condominios.id, dias: condominios.purgaFotosRotinaDias }).from(condominios);
  let n = 0;
  for (const c of conds) {
    const limite = new Date(agora.getTime() - c.dias * 86400000);
    const velhos = await db.select({ id: rotinaItens.id, arquivoId: rotinaItens.arquivoId, recebida: rotinaItens.fotoRecebidaEm }).from(rotinaItens).where(eq(rotinaItens.condominioId, c.id));
    const ids = velhos.filter((v) => v.arquivoId && v.recebida && v.recebida < limite).map((v) => v.id);
    if (ids.length) {
      await db.update(rotinaItens).set({ arquivoId: null }).where(inArray(rotinaItens.id, ids));
      n += ids.length;
    }
  }
  return n;
}
