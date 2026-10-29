import { and, asc, desc, eq, inArray, isNotNull, isNull, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import {
  chamadoEventos,
  chamados,
  condominios,
  envios,
  palavrasEmergenciaExtra,
  passosAutoajuda,
  pessoas,
  prestadorDocumentos,
  prestadores,
  regrasCategoria,
  unidades,
  type EstadoChamado,
  type OrigemChamado,
  type Urgencia,
} from "@/db/schema";
import { enfileirarAvisoPessoa } from "@/lib/telegram/avisos";
import type { Saida } from "@/lib/telegram/roteador";
import { agendarEnvioDaFila } from "@/lib/negocio/fila";
import { detectarEmergencia, mensagemSeguranca, type GrupoEmergencia } from "@/lib/negocio/linguagem";
import { auditar } from "@/lib/negocio/auditoria";
import { iaDisponivel, type BlocoConteudo } from "@/lib/ia/funcoes";
import { ROTULO_CATEGORIA, triagemIA4, type CategoriaChamado } from "./ia";
import { situacaoDocumentos } from "@/features/prestadores/servico";

export const ORDEM_URGENCIA: Urgencia[] = ["baixa", "media", "alta", "emergencia"];
export const ROTULO_URGENCIA: Record<Urgencia, string> = { baixa: "Baixa", media: "Média", alta: "Alta", emergencia: "Emergência" };
export const ROTULO_ESTADO: Record<EstadoChamado, string> = {
  novo: "Novo",
  com_responsavel: "Com o responsável",
  aguardando_prestador: "Aguardando prestador",
  agendado: "Agendado",
  resolvido: "Resolvido (o síndico encerra)",
  aguardando_confirmacao: "Aguardando confirmação do morador",
  encerrado: "Encerrado",
};
export const ROTULO_MOTIVO: Record<string, string> = {
  confirmado_pelo_morador: "confirmado pelo morador",
  sem_confirmacao_72h: "sem confirmação do morador",
  resolvido_na_entrada: "resolvido na entrada (autoajuda)",
  encerrado_pelo_sindico: "encerrado pelo síndico",
  registrada: "ocorrência registrada",
};

export function maiorUrgencia(...l: (Urgencia | null | undefined)[]): Urgencia {
  return l.filter(Boolean).reduce<Urgencia>((m, u) => (ORDEM_URGENCIA.indexOf(u!) > ORDEM_URGENCIA.indexOf(m) ? u! : m), "baixa");
}

/**
 * Urgência é do CÓDIGO: max(regra do síndico para a categoria, palavra de emergência, sinal da IA).
 * A IA só sobe (para "alta"), nunca baixa; emergência vem só da lista fixa de palavras.
 */
export function calcularUrgencia(p: { regra: Urgencia | null; texto: string; sinaisIa?: string[]; extras?: { grupo: GrupoEmergencia; expressao: string }[] }): { urgencia: Urgencia; motivo: string; grupo?: GrupoEmergencia } {
  const em = detectarEmergencia(p.texto, p.extras);
  if (em) return { urgencia: "emergencia", motivo: `palavra de emergência: "${em.palavra}"`, grupo: em.grupo };
  const regra = p.regra ?? "media";
  if (p.sinaisIa && p.sinaisIa.length > 0 && ORDEM_URGENCIA.indexOf("alta") > ORDEM_URGENCIA.indexOf(regra)) {
    return { urgencia: "alta", motivo: `sinal apontado pela IA (${p.sinaisIa.join(", ")}); regra da categoria: ${ROTULO_URGENCIA[regra].toLowerCase()}` };
  }
  return { urgencia: regra, motivo: `regra da categoria (${ROTULO_URGENCIA[regra].toLowerCase()})` };
}

async function proximoNumero(condominioId: string): Promise<number> {
  const [r] = await db.select({ n: sql<number>`coalesce(max(${chamados.numero}), 0)::int` }).from(chamados).where(eq(chamados.condominioId, condominioId));
  return (r?.n ?? 0) + 1;
}

export async function registrarEvento(p: { organizacaoId: string; chamadoId: string; tipo: string; texto?: string | null; autorRotulo: string; autorPessoaId?: string | null; autorUsuarioId?: string | null; arquivoIds?: string[] }) {
  await db.insert(chamadoEventos).values({
    organizacaoId: p.organizacaoId,
    chamadoId: p.chamadoId,
    tipo: p.tipo,
    texto: p.texto ?? null,
    autorRotulo: p.autorRotulo,
    autorPessoaId: p.autorPessoaId ?? null,
    autorUsuarioId: p.autorUsuarioId ?? null,
    arquivoIds: p.arquivoIds && p.arquivoIds.length ? p.arquivoIds : null,
  });
}

export type ResultadoAbertura = {
  chamado: typeof chamados.$inferSelect;
  emergencia: boolean;
  passo: typeof passosAutoajuda.$inferSelect | null;
  pergunta: string | null;
  iaUsada: boolean;
  avisosEmergencia: number;
};

/**
 * Abre um chamado (morador, funcionário em nome da unidade, síndico ou vencimento).
 * 1. Palavra de emergência → urgência "emergencia", SEM IA, SEM autoajuda; aviso na hora.
 * 2. Sem categoria escolhida e com IA → triagem IA4 (categoria, pergunta, passo aprovado).
 * 3. Sem IA → categoria por botão (ou "outra") e urgência pela regra.
 */
export async function abrirChamado(p: {
  organizacaoId: string;
  condominioId: string;
  origem: OrigemChamado;
  descricao: string;
  natureza?: "manutencao" | "ocorrencia";
  abertoPorPessoaId?: string | null;
  abertoPorUsuarioId?: string | null;
  autorRotulo: string;
  unidadeId?: string | null;
  categoria?: CategoriaChamado | null;
  categoriaOrigem?: "botao" | "sindico";
  arquivoIds?: string[];
  mediaGroupId?: string | null;
  vencimentoId?: string | null;
  prestadorId?: string | null;
  agendadoPara?: Date | null;
  foto?: BlocoConteudo | null;
  saida?: Saida | null;
  usarIa?: boolean;
}): Promise<ResultadoAbertura> {
  const descricao = p.descricao.trim().slice(0, 2000);
  if (descricao.length < 3) throw new Error("Descreva o problema.");
  const regras = await db.select().from(regrasCategoria).where(eq(regrasCategoria.condominioId, p.condominioId));
  const extras = await db.select({ grupo: palavrasEmergenciaExtra.grupo, expressao: palavrasEmergenciaExtra.expressao }).from(palavrasEmergenciaExtra).where(eq(palavrasEmergenciaExtra.condominioId, p.condominioId));
  // Emergência PRIMEIRO, antes de qualquer IA, pergunta ou autoajuda.
  const emergencia = detectarEmergencia(descricao, extras);

  let categoria: CategoriaChamado = p.categoria ?? "outra";
  let categoriaOrigem: "ia" | "botao" | "sindico" | "regra" = p.categoria ? (p.categoriaOrigem ?? "botao") : "regra";
  let sinais: string[] = [];
  let pergunta: string | null = null;
  let passoId: string | null = null;
  let resumo: string | null = null;
  let iaUsada = false;

  const passosAprovados = await db
    .select()
    .from(passosAutoajuda)
    .where(and(eq(passosAutoajuda.condominioId, p.condominioId), eq(passosAutoajuda.ativo, true)));

  if (!emergencia && !p.categoria && p.usarIa !== false && iaDisponivel()) {
    const nomes = (await db.select({ nome: pessoas.nome }).from(pessoas).where(eq(pessoas.condominioId, p.condominioId))).map((x) => x.nome);
    const t = await triagemIA4({ organizacaoId: p.organizacaoId, texto: descricao, nomes, passos: passosAprovados.map((x) => ({ id: x.id, categoria: x.categoria, titulo: x.titulo })), foto: p.foto ?? null });
    if (t.ok) {
      iaUsada = true;
      categoria = t.triagem.categoria;
      categoriaOrigem = "ia";
      sinais = t.triagem.sinais;
      pergunta = t.triagem.pergunta;
      passoId = t.triagem.passoAutoajudaId;
      resumo = t.triagem.resumo;
    }
  }
  const regraCat = regras.find((r) => r.categoria === categoria && r.ativa) ?? null;
  const { urgencia, motivo, grupo } = calcularUrgencia({ regra: regraCat?.urgenciaPadrao ?? null, texto: descricao, sinaisIa: sinais, extras });
  const passo = !emergencia && passoId ? passosAprovados.find((x) => x.id === passoId) ?? null : null;
  // Responsável padrão da categoria (sem esperar o síndico). Ocorrência e chamado com autoajuda oferecida esperam.
  const responsavelPessoa = !p.prestadorId && p.natureza !== "ocorrencia" && !passo ? (regraCat?.responsavelPessoaId ?? null) : null;
  const responsavelPrestador = p.prestadorId ?? (p.natureza !== "ocorrencia" && !passo && !responsavelPessoa ? (regraCat?.responsavelPrestadorId ?? null) : null);
  const estadoInicial: EstadoChamado = p.natureza === "ocorrencia" ? "encerrado" : responsavelPrestador ? (p.agendadoPara ? "agendado" : "aguardando_prestador") : responsavelPessoa ? "com_responsavel" : "novo";

  let chamado: typeof chamados.$inferSelect | undefined;
  for (let tentativa = 0; tentativa < 3 && !chamado; tentativa++) {
    const numero = await proximoNumero(p.condominioId);
    const r = await db
      .insert(chamados)
      .values({
        organizacaoId: p.organizacaoId,
        condominioId: p.condominioId,
        numero,
        natureza: p.natureza ?? "manutencao",
        origem: p.origem,
        abertoPorPessoaId: p.abertoPorPessoaId ?? null,
        abertoPorUsuarioId: p.abertoPorUsuarioId ?? null,
        unidadeId: p.unidadeId ?? null,
        descricao,
        categoria,
        categoriaOrigem,
        urgencia,
        urgenciaMotivo: motivo,
        emergenciaGrupo: grupo ?? null,
        estado: estadoInicial,
        responsavelPessoaId: responsavelPessoa,
        prestadorId: responsavelPrestador,
        ...(p.natureza === "ocorrencia" ? { encerradoEm: new Date(), motivoEncerramento: "registrada" as const } : {}),
        agendadoPara: p.agendadoPara ?? null,
        vencimentoId: p.vencimentoId ?? null,
        passoAutoajudaId: passo?.id ?? null,
        perguntaEsclarecimento: emergencia ? null : pergunta,
        resumoIa: resumo,
        mediaGroupId: p.mediaGroupId ?? null,
      })
      .onConflictDoNothing()
      .returning();
    chamado = r[0];
  }
  if (!chamado) throw new Error("Não consegui numerar o chamado; tente de novo.");
  await registrarEvento({
    organizacaoId: p.organizacaoId,
    chamadoId: chamado.id,
    tipo: "aberto",
    texto: `${descricao}\nCategoria: ${ROTULO_CATEGORIA[categoria]} (${categoriaOrigem === "ia" ? "sugerida pela IA" : categoriaOrigem}). Urgência: ${ROTULO_URGENCIA[urgencia]} (${motivo}).`,
    autorRotulo: p.autorRotulo,
    autorPessoaId: p.abertoPorPessoaId,
    autorUsuarioId: p.abertoPorUsuarioId,
    arquivoIds: p.arquivoIds,
  });

  let avisosEmergencia = 0;
  if (urgencia === "emergencia") avisosEmergencia = await avisarEmergencia({ chamado, saida: p.saida ?? null });
  else if (responsavelPessoa || responsavelPrestador) await avisarResponsavel(chamado);

  // Porteiro/zelador abrindo em nome da unidade: os moradores vinculados da unidade são avisados.
  if (p.origem === "funcionario_pela_unidade" && p.unidadeId) {
    const moradores = await db
      .select({ id: pessoas.id })
      .from(pessoas)
      .where(and(eq(pessoas.unidadeId, p.unidadeId), eq(pessoas.papel, "morador"), isNull(pessoas.saiuEm), isNull(pessoas.removidaEm)));
    for (const m of moradores) {
      await enfileirarAvisoPessoa({
        organizacaoId: p.organizacaoId,
        pessoaId: m.id,
        categoria: "chamado",
        texto: `A portaria abriu o chamado nº ${chamado.numero} em nome da sua unidade: "${descricao.slice(0, 200)}". Você vai receber cada mudança por aqui. Envie /meus para acompanhar.`,
        chaveIdempotencia: `chamado:${chamado.id}:aberto-unidade:${m.id}`,
      });
    }
    agendarEnvioDaFila(p.organizacaoId);
  }
  return { chamado, emergencia: urgencia === "emergencia", passo, pergunta: emergencia ? null : pergunta, iaUsada, avisosEmergencia };
}

/** Mensagem fixa de segurança (sem IA) para quem abriu, com o 193 e o contato de plantão. */
export async function mensagemEmergenciaDoCondominio(condominioId: string, grupo: GrupoEmergencia): Promise<string> {
  const [c] = await db.select().from(condominios).where(eq(condominios.id, condominioId)).limit(1);
  const plantao = await db.select({ nome: pessoas.nome, papel: pessoas.papel }).from(pessoas).where(and(eq(pessoas.condominioId, condominioId), isNull(pessoas.removidaEm), isNull(pessoas.saiuEm), sql`(${pessoas.papel} = 'sindico' or ${pessoas.contatoPlantao} = true)`));
  const nomes = [...new Set(plantao.map((x) => x.nome))].join(", ") || c?.contatoEmergenciaNome || "";
  const tel = c?.contatoEmergenciaTelefone ? ` · ${c.contatoEmergenciaTelefone}` : "";
  return mensagemSeguranca(grupo, `${nomes}${tel}`, c?.mensagensSeguranca);
}

/** Avisa o responsável padrão (funcionário ou prestador) de um chamado novo. */
export async function avisarResponsavel(ch: typeof chamados.$inferSelect) {
  const ids: string[] = [];
  if (ch.responsavelPessoaId) ids.push(ch.responsavelPessoaId);
  if (ch.prestadorId) {
    const pp = await db.select({ id: pessoas.id }).from(pessoas).where(and(eq(pessoas.prestadorId, ch.prestadorId), eq(pessoas.condominioId, ch.condominioId), isNull(pessoas.removidaEm)));
    ids.push(...pp.map((x) => x.id));
  }
  for (const id of ids) {
    await enfileirarAvisoPessoa({
      organizacaoId: ch.organizacaoId,
      pessoaId: id,
      categoria: "ordem_servico",
      texto: `Chamado nº ${ch.numero} para você (${ROTULO_URGENCIA[ch.urgencia].toLowerCase()}): ${ch.descricao.slice(0, 200)}\nEnvie ${ch.prestadorId ? "/os para ver e /concluir ao terminar" : "/chamados para ver e marcar como resolvido"} (com foto).`,
      chaveIdempotencia: `chamado:${ch.id}:responsavel:${id}:${ch.responsavelPessoaId ?? ch.prestadorId}`,
    });
  }
  if (ids.length) agendarEnvioDaFila(ch.organizacaoId);
}

/**
 * Emergência: envio DIRETO (sem fila, sem cron) ao síndico e aos contatos de plantão,
 * com 3 tentativas e registro em `envios`. Sem saída do Telegram (painel), enfileira e a fila anda na hora.
 */
export async function avisarEmergencia(p: { chamado: typeof chamados.$inferSelect; saida: Saida | null }): Promise<number> {
  const ch = p.chamado;
  const [c] = await db.select().from(condominios).where(eq(condominios.id, ch.condominioId)).limit(1);
  const destinos = await db
    .select()
    .from(pessoas)
    .where(and(eq(pessoas.condominioId, ch.condominioId), isNull(pessoas.removidaEm), isNull(pessoas.saiuEm), sql`(${pessoas.papel} = 'sindico' or ${pessoas.contatoPlantao} = true)`));
  let unidade = "";
  if (ch.unidadeId) {
    const [u] = await db.select().from(unidades).where(eq(unidades.id, ch.unidadeId)).limit(1);
    if (u) unidade = ` · unidade ${u.bloco ? `${u.bloco}-` : ""}${u.numero}`;
  }
  const texto = [
    `EMERGÊNCIA no ${c?.nome ?? "condomínio"}${unidade}`,
    `Chamado nº ${ch.numero}: "${ch.descricao.slice(0, 300)}"`,
    `Motivo: ${ch.urgenciaMotivo ?? "emergência"}.`,
    c?.contatoEmergenciaTelefone ? `Contato de emergência cadastrado: ${c.contatoEmergenciaNome ?? ""} ${c.contatoEmergenciaTelefone}`.trim() : null,
    `O sistema não liga para ninguém: em risco à vida, 193 (Bombeiros) ou 190 (Polícia).`,
  ]
    .filter(Boolean)
    .join("\n");
  let enviados = 0;
  for (const d of destinos) {
    if (!d.telegramChatId || d.botBloqueadoEm) {
      await db.insert(envios).values({ organizacaoId: ch.organizacaoId, condominioId: ch.condominioId, pessoaId: d.id, categoria: "emergencia", texto, status: "nao_enviado", erro: d.telegramChatId ? "A pessoa bloqueou o bot." : "Pessoa sem Telegram vinculado.", chaveIdempotencia: `emergencia:${ch.id}:${d.id}` }).onConflictDoNothing();
      continue;
    }
    if (p.saida) {
      let ok = false;
      let erro = "";
      for (let t = 1; t <= 3 && !ok; t++) {
        try {
          const r = await p.saida.enviarTexto({ chatId: d.telegramChatId, pessoa: null }, texto);
          ok = r !== null;
          if (!ok) erro = "A pessoa bloqueou o bot.";
        } catch (e) {
          erro = e instanceof Error ? e.message.slice(0, 200) : "falha";
        }
      }
      await db
        .insert(envios)
        .values({ organizacaoId: ch.organizacaoId, condominioId: ch.condominioId, pessoaId: d.id, chatId: d.telegramChatId, categoria: "emergencia", texto, status: ok ? "enviado" : "erro", erro: ok ? null : erro, enviadoEm: ok ? new Date() : null, tentativas: 1, chaveIdempotencia: `emergencia:${ch.id}:${d.id}` })
        .onConflictDoNothing();
      if (ok) enviados++;
    } else {
      await enfileirarAvisoPessoa({ organizacaoId: ch.organizacaoId, pessoaId: d.id, categoria: "emergencia", texto, chaveIdempotencia: `emergencia:${ch.id}:${d.id}` });
      enviados++;
    }
  }
  if (!p.saida) agendarEnvioDaFila(ch.organizacaoId);
  await registrarEvento({ organizacaoId: ch.organizacaoId, chamadoId: ch.id, tipo: "emergencia_avisada", texto: `Aviso imediato a ${enviados} contato(s) com Telegram (síndico e plantão).`, autorRotulo: "Sistema" });
  return enviados;
}

/** Avisa quem abriu (e os moradores da unidade, se aberto pela portaria) de cada mudança de estado. */
export async function avisarInteressados(ch: typeof chamados.$inferSelect, texto: string, teclado?: { text: string; callback_data: string }[][], sufixo = "estado") {
  const ids = new Set<string>();
  if (ch.abertoPorPessoaId) {
    const [quem] = await db.select({ papel: pessoas.papel }).from(pessoas).where(eq(pessoas.id, ch.abertoPorPessoaId)).limit(1);
    if (quem?.papel === "morador") ids.add(ch.abertoPorPessoaId);
  }
  if (ch.unidadeId && ch.origem === "funcionario_pela_unidade") {
    const m = await db.select({ id: pessoas.id }).from(pessoas).where(and(eq(pessoas.unidadeId, ch.unidadeId), eq(pessoas.papel, "morador"), isNull(pessoas.saiuEm), isNull(pessoas.removidaEm)));
    m.forEach((x) => ids.add(x.id));
  }
  for (const id of ids) {
    await enfileirarAvisoPessoa({ organizacaoId: ch.organizacaoId, pessoaId: id, categoria: "chamado", texto, teclado, chaveIdempotencia: `chamado:${ch.id}:${sufixo}:${id}:${Date.now()}` });
  }
  if (ids.size) agendarEnvioDaFila(ch.organizacaoId);
  return ids.size;
}

async function carregar(organizacaoId: string, chamadoId: string) {
  const [ch] = await db.select().from(chamados).where(and(eq(chamados.id, chamadoId), eq(chamados.organizacaoId, organizacaoId))).limit(1);
  if (!ch) throw new Error("Chamado não encontrado.");
  return ch;
}

/** Atribuição: a funcionário ou a prestador. Prestador com documento vencido exige justificativa. */
export async function atribuirChamado(p: { organizacaoId: string; chamadoId: string; autorRotulo: string; autorUsuarioId?: string | null; pessoaId?: string | null; prestadorId?: string | null; agendadoPara?: Date | null; justificativa?: string | null }) {
  const ch = await carregar(p.organizacaoId, p.chamadoId);
  if (ch.estado === "encerrado") throw new Error("Chamado encerrado.");
  let texto = "";
  let estado: EstadoChamado;
  if (p.prestadorId) {
    const [pr] = await db.select().from(prestadores).where(and(eq(prestadores.id, p.prestadorId), eq(prestadores.organizacaoId, p.organizacaoId))).limit(1);
    if (!pr) throw new Error("Prestador não encontrado.");
    const docs = await db.select().from(prestadorDocumentos).where(eq(prestadorDocumentos.prestadorId, pr.id));
    const sit = situacaoDocumentos(docs);
    if (!sit.emDia && !(p.justificativa && p.justificativa.trim().length >= 5)) {
      throw new Error(`${pr.razaoSocial} tem ${sit.vencidos.length} documento(s) vencido(s). Escreva a justificativa para seguir mesmo assim.`);
    }
    estado = p.agendadoPara ? "agendado" : "aguardando_prestador";
    texto = `Atribuído a ${pr.razaoSocial}${p.agendadoPara ? `, agendado para ${p.agendadoPara.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : ""}${!sit.emDia ? `. Seguiu com documento vencido: ${p.justificativa}` : ""}`;
    await db.update(chamados).set({ prestadorId: pr.id, responsavelPessoaId: null, estado, agendadoPara: p.agendadoPara ?? null, atualizadoEm: new Date() }).where(eq(chamados.id, ch.id));
  } else if (p.pessoaId) {
    const [f] = await db.select().from(pessoas).where(and(eq(pessoas.id, p.pessoaId), eq(pessoas.organizacaoId, p.organizacaoId), eq(pessoas.condominioId, ch.condominioId))).limit(1);
    if (!f || f.papel !== "funcionario") throw new Error("Funcionário não encontrado neste condomínio.");
    estado = "com_responsavel";
    texto = `Atribuído a ${f.nome}`;
    await db.update(chamados).set({ responsavelPessoaId: f.id, prestadorId: null, estado, atualizadoEm: new Date() }).where(eq(chamados.id, ch.id));
    await enfileirarAvisoPessoa({ organizacaoId: p.organizacaoId, pessoaId: f.id, categoria: "chamado", texto: `Novo chamado para você: nº ${ch.numero} – ${ch.descricao.slice(0, 200)}\nEnvie /chamados para ver e marcar como resolvido (com foto).`, chaveIdempotencia: `chamado:${ch.id}:atribuido:${f.id}:${Date.now()}` });
    agendarEnvioDaFila(p.organizacaoId);
  } else throw new Error("Escolha o funcionário ou o prestador.");
  await registrarEvento({ organizacaoId: p.organizacaoId, chamadoId: ch.id, tipo: "atribuido", texto, autorRotulo: p.autorRotulo, autorUsuarioId: p.autorUsuarioId });
  const atual = await carregar(p.organizacaoId, ch.id);
  await avisarInteressados(atual, `Chamado nº ${ch.numero}: ${ROTULO_ESTADO[estado].toLowerCase()}.`);
  if (p.prestadorId) {
    const prestPessoas = await db.select({ id: pessoas.id }).from(pessoas).where(and(eq(pessoas.prestadorId, p.prestadorId), eq(pessoas.condominioId, ch.condominioId), isNull(pessoas.removidaEm)));
    for (const pp of prestPessoas) {
      await enfileirarAvisoPessoa({ organizacaoId: p.organizacaoId, pessoaId: pp.id, categoria: "ordem_servico", texto: `Nova ordem de serviço nº ${ch.numero}: ${ch.descricao.slice(0, 200)}${p.agendadoPara ? `\nAgendado: ${p.agendadoPara.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : ""}\nEnvie /os para ver e /concluir ao terminar (com fotos).`, chaveIdempotencia: `chamado:${ch.id}:os:${pp.id}:${Date.now()}` });
    }
    agendarEnvioDaFila(p.organizacaoId);
  }
  return atual;
}

/** Arquivos do chamado: os dos eventos e os do álbum (media_group_id). */
export async function arquivosDoChamado(ch: typeof chamados.$inferSelect): Promise<string[]> {
  const ev = await db.select({ ids: chamadoEventos.arquivoIds }).from(chamadoEventos).where(eq(chamadoEventos.chamadoId, ch.id));
  const ids = new Set(ev.flatMap((e) => e.ids ?? []));
  if (ch.mediaGroupId) {
    const { arquivosDoAlbum } = await import("@/lib/telegram/comandos/arquivos");
    (await arquivosDoAlbum(ch.mediaGroupId)).forEach((x) => ids.add(x));
  }
  return [...ids];
}

export async function anexarFotos(p: { organizacaoId: string; chamadoId: string; arquivoIds: string[]; autorRotulo: string; autorPessoaId?: string | null }) {
  await registrarEvento({ organizacaoId: p.organizacaoId, chamadoId: p.chamadoId, tipo: "foto", autorRotulo: p.autorRotulo, autorPessoaId: p.autorPessoaId, arquivoIds: p.arquivoIds });
}

/**
 * Resolvido: SÓ com foto do serviço. Com morador vinculado (quem abriu ou a unidade),
 * vai para "aguardando confirmação" com os botões "Resolvido" / "Não resolvido";
 * sem resposta em 72 h (prazo do condomínio), o diário encerra "sem confirmação".
 * Sem morador vinculado, fica "resolvido" e o síndico encerra.
 */
export async function resolverChamado(p: { organizacaoId: string; chamadoId: string; arquivoIds: string[]; texto?: string | null; autorRotulo: string; autorPessoaId?: string | null; autorUsuarioId?: string | null }) {
  const ch = await carregar(p.organizacaoId, p.chamadoId);
  if (["encerrado", "resolvido", "aguardando_confirmacao"].includes(ch.estado)) throw new Error("Este chamado já foi resolvido.");
  if (p.arquivoIds.length === 0) throw new Error("Para resolver, envie ao menos uma foto do serviço feito.");
  const agora = new Date();
  await db.update(chamados).set({ estado: "resolvido", resolvidoEm: agora, atualizadoEm: agora }).where(eq(chamados.id, ch.id));
  await registrarEvento({ organizacaoId: p.organizacaoId, chamadoId: ch.id, tipo: "resolvido", texto: p.texto ?? "Serviço concluído, com foto.", autorRotulo: p.autorRotulo, autorPessoaId: p.autorPessoaId, autorUsuarioId: p.autorUsuarioId, arquivoIds: p.arquivoIds });
  const atual = await carregar(p.organizacaoId, ch.id);
  const [c] = await db.select({ h: condominios.horasConfirmacaoChamado }).from(condominios).where(eq(condominios.id, ch.condominioId)).limit(1);
  const avisados = await avisarInteressados(
    atual,
    `Chamado nº ${ch.numero} marcado como resolvido, com foto do serviço. O problema foi resolvido mesmo? Sem resposta em ${c?.h ?? 72} h, ele é encerrado como "sem confirmação do morador".`,
    [[{ text: "Resolvido", callback_data: `ch:ok:${ch.id}` }, { text: "Não resolvido", callback_data: `ch:no:${ch.id}` }]],
    "confirmacao",
  );
  if (avisados > 0) await db.update(chamados).set({ estado: "aguardando_confirmacao" }).where(eq(chamados.id, ch.id));
  return { avisados };
}

/** Resposta do morador: "Resolvido" encerra; "Não resolvido" reabre (conta uma reabertura). A IA nunca encerra chamado. */
export async function confirmarResolucao(p: { organizacaoId: string; chamadoId: string; resolvido: boolean; pessoaId: string; autorRotulo: string }) {
  const ch = await carregar(p.organizacaoId, p.chamadoId);
  if (ch.estado !== "aguardando_confirmacao" && ch.estado !== "resolvido") return { mudou: false, estado: ch.estado };
  const agora = new Date();
  if (p.resolvido) {
    await db.update(chamados).set({ estado: "encerrado", encerradoEm: agora, motivoEncerramento: "confirmado_pelo_morador", atualizadoEm: agora }).where(eq(chamados.id, ch.id));
    await registrarEvento({ organizacaoId: p.organizacaoId, chamadoId: ch.id, tipo: "confirmacao", texto: "Morador confirmou que foi resolvido.", autorRotulo: p.autorRotulo, autorPessoaId: p.pessoaId });
    return { mudou: true, estado: "encerrado" as const };
  }
  const voltaPara: EstadoChamado = ch.prestadorId ? "aguardando_prestador" : ch.responsavelPessoaId ? "com_responsavel" : "novo";
  await db.update(chamados).set({ estado: voltaPara, resolvidoEm: null, reaberturas: ch.reaberturas + 1, atualizadoEm: agora }).where(eq(chamados.id, ch.id));
  await registrarEvento({ organizacaoId: p.organizacaoId, chamadoId: ch.id, tipo: "reaberto", texto: "Morador respondeu que NÃO foi resolvido: chamado reaberto.", autorRotulo: p.autorRotulo, autorPessoaId: p.pessoaId });
  const atual = await carregar(p.organizacaoId, ch.id);
  await avisarResponsavel(atual);
  return { mudou: true, estado: voltaPara };
}

/** Autoajuda: "Resolveu" encerra como resolvido na entrada; "Não resolveu" segue para o responsável. */
export async function resultadoAutoajuda(p: { organizacaoId: string; chamadoId: string; resolveu: boolean; pessoaId: string; autorRotulo: string }) {
  const ch = await carregar(p.organizacaoId, p.chamadoId);
  if (ch.estado !== "novo" || !ch.passoAutoajudaId) return { mudou: false };
  const agora = new Date();
  if (p.resolveu) {
    await db.update(chamados).set({ estado: "encerrado", resolvidoNaEntrada: true, resolvidoEm: agora, encerradoEm: agora, motivoEncerramento: "resolvido_na_entrada", atualizadoEm: agora }).where(eq(chamados.id, ch.id));
    await registrarEvento({ organizacaoId: p.organizacaoId, chamadoId: ch.id, tipo: "autoajuda_resolveu", texto: "Resolvido na entrada com o passo de autoajuda.", autorRotulo: p.autorRotulo, autorPessoaId: p.pessoaId });
    return { mudou: true };
  }
  await registrarEvento({ organizacaoId: p.organizacaoId, chamadoId: ch.id, tipo: "autoajuda_nao_resolveu", texto: "O passo de autoajuda não resolveu: segue para o responsável.", autorRotulo: p.autorRotulo, autorPessoaId: p.pessoaId });
  const [regra] = await db.select().from(regrasCategoria).where(and(eq(regrasCategoria.condominioId, ch.condominioId), eq(regrasCategoria.categoria, ch.categoria))).limit(1);
  if (regra?.responsavelPessoaId || regra?.responsavelPrestadorId) {
    await db
      .update(chamados)
      .set({ responsavelPessoaId: regra.responsavelPessoaId ?? null, prestadorId: regra.responsavelPessoaId ? null : regra.responsavelPrestadorId, estado: regra.responsavelPessoaId ? "com_responsavel" : "aguardando_prestador", atualizadoEm: agora })
      .where(eq(chamados.id, ch.id));
    await avisarResponsavel(await carregar(p.organizacaoId, ch.id));
  }
  return { mudou: true };
}

/** Diário: aguardando confirmação há mais que o prazo (padrão 72 h) → encerrado "sem confirmação do morador". */
export async function fecharSemConfirmacao(agora = new Date()) {
  const lista = await db
    .select({ ch: chamados, horas: condominios.horasConfirmacaoChamado })
    .from(chamados)
    .innerJoin(condominios, eq(condominios.id, chamados.condominioId))
    .where(and(eq(chamados.estado, "aguardando_confirmacao"), isNotNull(chamados.resolvidoEm)));
  let n = 0;
  for (const { ch, horas } of lista) {
    if (ch.resolvidoEm!.getTime() + horas * 3600000 > agora.getTime()) continue;
    await db.update(chamados).set({ estado: "encerrado", encerradoEm: agora, motivoEncerramento: "sem_confirmacao_72h", atualizadoEm: agora }).where(eq(chamados.id, ch.id));
    await registrarEvento({ organizacaoId: ch.organizacaoId, chamadoId: ch.id, tipo: "sem_confirmacao", texto: `Encerrado sem confirmação do morador (sem resposta em ${horas} h).`, autorRotulo: "Sistema" });
    n++;
  }
  return n;
}

/** Sem morador vinculado (área comum, unidade sem Telegram): o síndico encerra o chamado resolvido. */
export async function encerrarPeloSindico(p: { organizacaoId: string; chamadoId: string; motivo: string; autorRotulo: string; autorUsuarioId?: string | null }) {
  const ch = await carregar(p.organizacaoId, p.chamadoId);
  if (ch.estado !== "resolvido") throw new Error("Só um chamado resolvido (com foto) e sem morador para confirmar pode ser encerrado pelo síndico.");
  if (p.motivo.trim().length < 5) throw new Error("Escreva o motivo do encerramento.");
  const agora = new Date();
  await db.update(chamados).set({ estado: "encerrado", encerradoEm: agora, motivoEncerramento: "encerrado_pelo_sindico", atualizadoEm: agora }).where(eq(chamados.id, ch.id));
  await registrarEvento({ organizacaoId: p.organizacaoId, chamadoId: ch.id, tipo: "encerrado_sindico", texto: p.motivo, autorRotulo: p.autorRotulo, autorUsuarioId: p.autorUsuarioId });
  await auditar({ organizacaoId: p.organizacaoId, condominioId: ch.condominioId, ator: p.autorRotulo, acao: "chamado.encerrado_pelo_sindico", alvo: ch.id });
}

/** Mudar a urgência pelo síndico, sempre com motivo (evento novo). */
export async function mudarUrgencia(p: { organizacaoId: string; chamadoId: string; urgencia: Urgencia; motivo: string; autorRotulo: string; autorUsuarioId?: string | null }) {
  const ch = await carregar(p.organizacaoId, p.chamadoId);
  if (p.motivo.trim().length < 5) throw new Error("Escreva o motivo da mudança de urgência.");
  await db.update(chamados).set({ urgencia: p.urgencia, urgenciaMotivo: `síndico: ${p.motivo.trim()}`, atualizadoEm: new Date() }).where(eq(chamados.id, ch.id));
  await registrarEvento({ organizacaoId: p.organizacaoId, chamadoId: ch.id, tipo: "urgencia", texto: `Urgência ${ROTULO_URGENCIA[ch.urgencia].toLowerCase()} → ${ROTULO_URGENCIA[p.urgencia].toLowerCase()}: ${p.motivo.trim()}`, autorRotulo: p.autorRotulo, autorUsuarioId: p.autorUsuarioId });
}

export async function chamadosDaPessoa(pessoaId: string, condominioId: string) {
  return db.select().from(chamados).where(and(eq(chamados.abertoPorPessoaId, pessoaId), eq(chamados.condominioId, condominioId))).orderBy(desc(chamados.abertoEm)).limit(10);
}

export async function chamadosAtribuidos(p: { pessoaId?: string; prestadorId?: string; condominioId: string }) {
  const filtro = p.prestadorId ? eq(chamados.prestadorId, p.prestadorId) : eq(chamados.responsavelPessoaId, p.pessoaId!);
  return db
    .select()
    .from(chamados)
    .where(and(filtro, eq(chamados.condominioId, p.condominioId), inArray(chamados.estado, ["com_responsavel", "aguardando_prestador", "agendado", "novo"])))
    .orderBy(asc(chamados.abertoEm));
}

export async function chamadosSemAtribuicaoAntigos(condominioId: string, horas: number, agora = new Date()) {
  return db
    .select()
    .from(chamados)
    .where(and(eq(chamados.condominioId, condominioId), eq(chamados.natureza, "manutencao"), eq(chamados.estado, "novo"), lt(chamados.abertoEm, new Date(agora.getTime() - horas * 3600000))));
}
