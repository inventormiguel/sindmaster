import { and, eq, inArray } from "drizzle-orm";
import { db } from "../index";
import {
  acessoCondominios,
  arquivos,
  chamadoEventos,
  chamados,
  condominios,
  despesas,
  documentos,
  duvidas,
  passosAutoajuda,
  pessoas,
  prestadorCondominios,
  prestadorDocumentos,
  prestadores,
  prestadorPagamentos,
  regrasCategoria,
  rotinaItens,
  rotinaModelos,
  servicosRegistrados,
  trechos,
  unidades,
  vencimentos,
  type Urgencia,
} from "../schema";
import { hojeISO, instanteLocal, somarDias, somarMeses } from "@/lib/negocio/datas";
import { cifrar, mascarar } from "@/lib/negocio/cifra";
import { montarLinhaBancaria } from "@/lib/negocio/boleto";
import { criarDocumento } from "@/features/documentos/servico";
import { criarVencimentosDoCondominio } from "@/features/vencimentos/servico";
import { modeloCaiNoDia } from "@/features/rotinas/servico";
import {
  CNPJ_BENEFICIARIO_DIVERGENTE,
  CONVENCAO,
  EMPRESA_PORTARIA,
  FUNCIONARIOS,
  PRESTADORES,
  PRIMEIROS_NOMES,
  REGIMENTO,
  SOBRENOMES,
} from "./dados";

/**
 * Gerador do condomínio de demonstração (o caso da caixa d'água).
 * Determinístico (sorteio com semente fixa), com datas relativas a "hoje" da criação.
 * Usado pelo seed (Jardim das Araucárias) e pelo botão "Criar condomínio de demonstração".
 */

function sorteador(semente: string) {
  let h = 1779033703 ^ semente.length;
  for (let i = 0; i < semente.length; i++) h = Math.imul(h ^ semente.charCodeAt(i), 3432918353);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const QUEM = "José Ribeiro";

type Ctx = { org: string; cond: string; hoje: string; rnd: () => number };

async function arquivoExemplo(ctx: Ctx, nome: string, arquivo: string, mime = "image/svg+xml") {
  const [a] = await db
    .insert(arquivos)
    .values({ organizacaoId: ctx.org, condominioId: ctx.cond, origem: "painel", nomeOriginal: nome, mimeType: mime, tamanhoBytes: 1024, provedor: "seed", chave: `exemplos/${arquivo}`, recebidoComo: "seed", exemplo: true })
    .returning({ id: arquivos.id });
  return a.id;
}

/** Garante os 6 prestadores fictícios na organização (reaproveita os que já existem) e liga ao condomínio. */
async function garantirPrestadores(ctx: Ctx) {
  const ids: Record<string, string> = {};
  for (const p of PRESTADORES) {
    let [ex] = await db.select().from(prestadores).where(and(eq(prestadores.organizacaoId, ctx.org), eq(prestadores.cnpj, p.cnpj))).limit(1);
    if (!ex) {
      [ex] = await db
        .insert(prestadores)
        .values({ organizacaoId: ctx.org, razaoSocial: p.razaoSocial, cnpj: p.cnpj, categorias: p.categorias, contato: "Atendimento" })
        .returning();
      await db.insert(prestadorPagamentos).values({ organizacaoId: ctx.org, prestadorId: ex.id, tipo: "pix", dadosCifrados: cifrar(p.pix), resumo: `Chave Pix ${mascarar(p.pix)}`, alteradoPorRotulo: QUEM });
      const docs: { tipo: "cnd_federal" | "crf_fgts" | "cndt" | "apolice_rc"; emitido: number; validade: number }[] =
        p.chave === "hidro"
          ? [
              { tipo: "cnd_federal", emitido: -185, validade: -5 },
              { tipo: "crf_fgts", emitido: -11, validade: 18 },
              { tipo: "cndt", emitido: -60, validade: 120 },
            ]
          : p.chave === "altura"
            ? [
                { tipo: "apolice_rc", emitido: -353, validade: 12 },
                { tipo: "cnd_federal", emitido: -80, validade: 100 },
              ]
            : [
                { tipo: "cnd_federal", emitido: -60, validade: 120 },
                { tipo: "cndt", emitido: -40, validade: 140 },
              ];
      for (const d of docs) {
        await db.insert(prestadorDocumentos).values({
          organizacaoId: ctx.org,
          prestadorId: ex.id,
          tipo: d.tipo,
          titularCnpj: p.cnpj,
          emitidoEm: somarDias(ctx.hoje, d.emitido),
          validade: somarDias(ctx.hoje, d.validade),
          origemLeitura: "manual",
          estado: "conferido",
          conferidoPorNome: QUEM,
          conferidoEm: instanteLocal(somarDias(ctx.hoje, d.emitido + 1), 10),
        });
      }
    }
    ids[p.chave] = ex.id;
    await db.insert(prestadorCondominios).values({ prestadorId: ex.id, condominioId: ctx.cond }).onConflictDoNothing();
    await db.insert(pessoas).values({ organizacaoId: ctx.org, condominioId: ctx.cond, nome: `${p.razaoSocial.replace(" (fictícia)", "")} (contato)`, papel: "prestador", prestadorId: ex.id, semTelegram: true, exemplo: true });
  }
  return ids;
}

function nomeFicticio(rnd: () => number, usados: Set<string>) {
  for (;;) {
    const n = `${PRIMEIROS_NOMES[Math.floor(rnd() * PRIMEIROS_NOMES.length)]} ${SOBRENOMES[Math.floor(rnd() * SOBRENOMES.length)]}`;
    if (!usados.has(n)) {
      usados.add(n);
      return n;
    }
  }
}

export type OpcoesDemo = {
  organizacaoId: string;
  nome: string;
  cnpj?: string | null;
  endereco?: string | null;
  cidade?: string;
  uf?: string;
  sindicoUsuarioId?: string | null;
  conselhoUsuarioId?: string | null;
  completo: boolean;
  hoje?: string;
};

/** Cria o condomínio de demonstração. `completo` = o caso principal; senão, um condomínio pequeno para a carteira. */
export async function criarCondominioDemo(o: OpcoesDemo) {
  const hoje = o.hoje ?? hojeISO();
  const [c] = await db
    .insert(condominios)
    .values({
      organizacaoId: o.organizacaoId,
      nome: o.nome,
      cnpj: o.cnpj ?? null,
      endereco: o.endereco ?? "Endereço fictício",
      cidade: o.cidade ?? "Curitiba",
      uf: o.uf ?? "PR",
      totalUnidades: o.completo ? 48 : 16,
      isDemo: true,
      enderecoFicticio: true,
    })
    .returning();
  const ctx: Ctx = { org: o.organizacaoId, cond: c.id, hoje, rnd: sorteador(`${o.nome}`) };
  if (o.sindicoUsuarioId) await db.insert(acessoCondominios).values({ organizacaoId: ctx.org, usuarioId: o.sindicoUsuarioId, condominioId: c.id, papel: "sindico" }).onConflictDoNothing();
  if (o.conselhoUsuarioId) await db.insert(acessoCondominios).values({ organizacaoId: ctx.org, usuarioId: o.conselhoUsuarioId, condominioId: c.id, papel: "conselho" }).onConflictDoNothing();

  /* Unidades: 1 torre, 12 andares × 4 (101 a 1204) ou 8 × 2. */
  const andares = o.completo ? 12 : 8;
  const porAndar = o.completo ? 4 : 2;
  const valoresUnidades = [];
  for (let a = 1; a <= andares; a++) for (let u = 1; u <= porAndar; u++) valoresUnidades.push({ organizacaoId: ctx.org, condominioId: c.id, bloco: "", numero: `${a}0${u}`, andar: a });
  const uns = await db.insert(unidades).values(valoresUnidades).returning();
  const unidadePorNumero = new Map(uns.map((u) => [u.numero, u]));

  /* Pessoas: síndico, funcionários e moradores (sem Telegram, sem telefone). */
  const [sindico] = await db.insert(pessoas).values({ organizacaoId: ctx.org, condominioId: c.id, nome: QUEM, papel: "sindico", usuarioId: o.sindicoUsuarioId ?? null, contatoPlantao: true, semTelegram: true, exemplo: true }).returning();
  const funcs: Record<string, typeof pessoas.$inferSelect> = {};
  for (const f of o.completo ? FUNCIONARIOS : FUNCIONARIOS.slice(0, 2)) {
    const [p] = await db
      .insert(pessoas)
      .values({
        organizacaoId: ctx.org,
        condominioId: c.id,
        nome: f.nome,
        papel: "funcionario",
        funcao: f.funcao,
        posto: f.posto,
        empregador: f.empregador,
        empresaContratada: f.empregador === "contratada" ? EMPRESA_PORTARIA : null,
        contatoPlantao: f.plantao,
        celularDoPosto: f.nome.startsWith("Marcos"),
        semTelegram: true,
        exemplo: true,
      })
      .returning();
    funcs[f.nome.split(" ")[0]] = p;
  }
  const usados = new Set<string>([QUEM, "Cláudia Nunes", "Helena Bertoldi", "Rafael Mazur"]);
  const comMorador = o.completo ? uns.filter((u, i) => u.numero === "302" || u.numero === "702" || i % 7 !== 3).slice(0, 41) : uns.slice(0, 10);
  const moradores: (typeof pessoas.$inferSelect)[] = [];
  const novoMorador = async (u: (typeof uns)[number], nome: string, relacao: "proprietario" | "inquilino") => {
    const [p] = await db
      .insert(pessoas)
      .values({ organizacaoId: ctx.org, condominioId: c.id, nome, papel: "morador", unidade: u.numero, unidadeId: u.id, relacaoUnidade: relacao, semTelegram: true, exemplo: true })
      .returning();
    moradores.push(p);
  };
  for (const u of comMorador) {
    if (o.completo && u.numero === "302") {
      // A 302 tem proprietária e inquilino, cada um com o seu vínculo.
      await novoMorador(u, "Helena Bertoldi", "proprietario");
      await novoMorador(u, "Rafael Mazur", "inquilino");
      continue;
    }
    const nome = o.completo && u.numero === "702" ? "Cláudia Nunes" : nomeFicticio(ctx.rnd, usados);
    await novoMorador(u, nome, ctx.rnd() < 0.7 ? "proprietario" : "inquilino");
  }
  const moradorDa = (numero: string) => moradores.find((m) => m.unidade === numero) ?? moradores[0];

  const prest = await garantirPrestadores(ctx);

  /* Vencimentos: os 10 conferidos e ativos + PMOC disponível (não ativado). */
  await criarVencimentosDoCondominio(ctx.org, c.id, ["reservatorios", "pragas", "elevador_mensal", "extintores", "seguro", "bombeiros", "ago", "mangueiras", "mandato", "spda", "pmoc"]);
  const proximos: Record<string, number> = o.completo
    ? { reservatorios: -12, pragas: 2, elevador_mensal: 5, extintores: 9, seguro: 21, bombeiros: 75, ago: 120, mangueiras: 140, mandato: 190, spda: 400 }
    : { elevador_mensal: 20, extintores: 60, seguro: 150, ago: 90 };
  const vencs = await db.select().from(vencimentos).where(eq(vencimentos.condominioId, c.id));
  const vencPorChave = new Map(vencs.map((v) => [v.modeloChave!, v]));
  for (const v of vencs) {
    const dias = proximos[v.modeloChave ?? ""];
    if (dias === undefined) continue;
    await db
      .update(vencimentos)
      .set({ proximo: somarDias(hoje, dias), estadoConferencia: "ativo", conferidoPorNome: QUEM, conferidoEm: instanteLocal(somarDias(hoje, -40), 9, 30) })
      .where(eq(vencimentos.id, v.id));
  }

  if (!o.completo) return c;

  /* Histórico de 12 meses: 16 serviços, 14 dentro do prazo cadastrado (pragas 9 dias depois, mangueiras 4 dias depois). */
  const comprovante = await arquivoExemplo(ctx, "comprovante-exemplo.svg", "comprovante.svg");
  const historico: { chave: string; servico: string; anterior: string; proximo: string; prest?: string }[] = [];
  const proxElev = somarDias(hoje, 5);
  for (let i = 1; i <= 11; i++) {
    const servico = somarDias(somarMeses(proxElev, -i), -2);
    historico.push({ chave: "elevador_mensal", servico, anterior: somarMeses(proxElev, -i), proximo: somarMeses(proxElev, -i + 1), prest: "altura" });
  }
  const prox = (k: string) => somarDias(hoje, proximos[k]);
  historico.push({ chave: "reservatorios", servico: somarMeses(prox("reservatorios"), -6), anterior: somarDias(somarMeses(prox("reservatorios"), -6), 3), proximo: prox("reservatorios"), prest: "hidro" });
  historico.push({ chave: "pragas", servico: somarMeses(prox("pragas"), -6), anterior: somarDias(somarMeses(prox("pragas"), -6), -9), proximo: prox("pragas"), prest: "dedetiza" });
  historico.push({ chave: "extintores", servico: somarMeses(prox("extintores"), -12), anterior: somarDias(somarMeses(prox("extintores"), -12), 5), proximo: prox("extintores"), prest: "fogo" });
  historico.push({ chave: "mangueiras", servico: somarMeses(prox("mangueiras"), -12), anterior: somarDias(somarMeses(prox("mangueiras"), -12), -4), proximo: prox("mangueiras"), prest: "fogo" });
  historico.push({ chave: "seguro", servico: somarMeses(prox("seguro"), -12), anterior: somarDias(somarMeses(prox("seguro"), -12), 1), proximo: prox("seguro") });
  for (const h of historico) {
    const v = vencPorChave.get(h.chave)!;
    await db.insert(servicosRegistrados).values({
      organizacaoId: ctx.org,
      condominioId: c.id,
      vencimentoId: v.id,
      dataServico: h.servico,
      validadeImpressa: h.chave === "seguro" ? h.proximo : null,
      prestadorId: h.prest ? prest[h.prest] : null,
      arquivoId: comprovante,
      origemLeitura: "manual",
      estado: "conferido",
      exemplo: true,
      proximoAnterior: h.anterior,
      proximoCalculado: h.proximo,
      dentroDoPrazo: h.servico <= h.anterior,
      conferidoPorNome: QUEM,
      conferidoEm: instanteLocal(h.servico, 16),
    });
  }

  /* Documentos: regimento (10 artigos) e convenção (6), conferidos. */
  for (const d of [
    { tipo: "regimento" as const, titulo: "Regimento Interno (fictício)", texto: REGIMENTO },
    { tipo: "convencao" as const, titulo: "Convenção do Condomínio (fictícia)", texto: CONVENCAO },
  ]) {
    const r = await criarDocumento({ organizacaoId: ctx.org, condominioId: c.id, tipo: d.tipo, titulo: d.titulo, texto: d.texto, quem: QUEM });
    await db.update(documentos).set({ divisaoConferidaPorNome: QUEM, divisaoConferidaEm: instanteLocal(somarDias(hoje, -45), 10) }).where(eq(documentos.id, r.doc.id));
  }
  const trs = await db.select().from(trechos).where(eq(trechos.condominioId, c.id));
  const trecho = (art: string, doc = "Regimento Interno") => trs.find((t) => t.rotulo === `${doc}, art. ${art}`)!;

  /* Regras por categoria (urgência, prazo, responsável padrão) e biblioteca de autoajuda aprovada. */
  const antonioId = funcs["Antônio"].id;
  const regras: [string, Urgencia, number, string | null, string | null][] = [
    ["hidraulica", "media", 48, null, prest.hidro],
    ["eletrica", "alta", 24, null, prest.eletro],
    ["elevador", "alta", 12, null, prest.altura],
    ["iluminacao", "baixa", 72, antonioId, null],
    ["limpeza", "baixa", 72, antonioId, null],
    ["portoes", "media", 48, null, prest.eletro],
    ["gas", "emergencia", 2, null, null],
    ["interfone", "baixa", 72, antonioId, null],
    ["area_comum", "baixa", 72, antonioId, null],
    ["infiltracao", "media", 72, antonioId, null],
    ["seguranca", "alta", 24, null, null],
    ["outra", "media", 72, antonioId, null],
  ];
  await db.insert(regrasCategoria).values(regras.map(([categoria, u, prazoHoras, pessoaId, prestadorId]) => ({ organizacaoId: ctx.org, condominioId: c.id, categoria, urgenciaPadrao: u, prazoHoras, responsavelPessoaId: pessoaId, responsavelPrestadorId: prestadorId })));
  const passos = await db
    .insert(passosAutoajuda)
    .values(
      [
        ["hidraulica", "Água amarelada depois de limpeza ou obra", "Depois de limpeza de reservatório, deixe a torneira aberta por 2 minutos. Se continuar amarelada, toque em \"Não resolveu\"."],
        ["eletrica", "Disjuntor do salão de festas", "Confira se o disjuntor do salão está ligado no quadro do corredor. Se desarmar de novo, não insista e toque em \"Não resolveu\"."],
        ["interfone", "Interfone sem tom", "Tire o interfone do gancho por 10 segundos e tente de novo."],
        ["hidraulica", "Pia da cozinha entupida", "Use um desentupidor de borracha por 1 minuto, com um pouco de água na pia. Não use soda cáustica."],
        ["iluminacao", "Luz do corredor apagada", "As luzes do corredor acendem pelo sensor de presença: aproxime-se do sensor perto do elevador. Se não acender, toque em \"Não resolveu\"."],
        ["portoes", "Controle do portão não abre", "Troque a pilha do controle (modelo CR2032) e tente a 2 metros do portão."],
      ].map(([categoria, titulo, texto]) => ({ organizacaoId: ctx.org, condominioId: c.id, categoria, titulo, texto, aprovadoPorNome: QUEM })),
    )
    .returning();

  /* Rotinas: empregados do condomínio (tarefa da pessoa) e portaria terceirizada (rotina do posto). */
  const seg_sab = [1, 2, 3, 4, 5, 6];
  const seg_sex = [1, 2, 3, 4, 5];
  const todos = [0, 1, 2, 3, 4, 5, 6];
  const modelosDef = [
    { p: "Antônio", item: "Conferir nível da caixa d'água e boia", periodo: "manha", foto: true, dias: seg_sab, foto_arquivo: "caixa" },
    { p: "Antônio", item: "Medir cloro e pH da piscina", periodo: "manha", foto: true, dias: seg_sab, foto_arquivo: "piscina" },
    { p: "Antônio", item: "Verificar bomba de recalque", periodo: "manha", foto: false, dias: seg_sab },
    { p: "Antônio", item: "Conferir iluminação das áreas comuns", periodo: "tarde", foto: false, dias: seg_sab },
    { p: "Antônio", item: "Varrer a garagem", periodo: "tarde", foto: false, dias: seg_sab },
    { p: "Antônio", item: "Recolher o lixo reciclável", periodo: "tarde", foto: false, dias: seg_sab },
    { p: "Rosa", item: "Limpar o hall de entrada", periodo: "manha", foto: false, dias: seg_sex },
    { p: "Rosa", item: "Limpar os elevadores", periodo: "manha", foto: false, dias: seg_sex },
    { p: "Rosa", item: "Limpar as escadas", periodo: "tarde", foto: false, dias: seg_sex },
    { p: "Rosa", item: "Limpar o salão de festas", periodo: "tarde", foto: true, dias: seg_sex, foto_arquivo: "servico" },
    { p: "Rosa", item: "Repor material dos banheiros da área comum", periodo: "tarde", foto: false, dias: seg_sex },
    { posto: "Portaria diurna", item: "Conferir o livro de visitantes", periodo: "manha", foto: false, dias: todos },
    { posto: "Portaria diurna", item: "Testar o portão da garagem", periodo: "manha", foto: false, dias: todos },
    { posto: "Portaria diurna", item: "Conferir câmeras e monitor", periodo: "tarde", foto: false, dias: todos },
    { posto: "Portaria noturna", item: "Ronda das áreas comuns", periodo: "noite", foto: false, dias: todos },
    { posto: "Portaria noturna", item: "Conferir portões trancados", periodo: "noite", foto: false, dias: todos },
  ] as const;
  const fotos = { caixa: await arquivoExemplo(ctx, "foto-caixa-dagua.svg", "caixa-dagua.svg"), piscina: await arquivoExemplo(ctx, "foto-piscina.svg", "piscina.svg"), servico: await arquivoExemplo(ctx, "foto-servico.svg", "servico.svg") };
  const modelos: { m: typeof rotinaModelos.$inferSelect; foto?: string }[] = [];
  for (const d of modelosDef) {
    const pessoa = "p" in d ? funcs[d.p] : null;
    const [m] = await db
      .insert(rotinaModelos)
      .values({ organizacaoId: ctx.org, condominioId: c.id, pessoaId: pessoa?.id ?? null, posto: "posto" in d ? d.posto : null, rotinaDoPosto: "posto" in d, funcao: "posto" in d ? "Porteiro" : (pessoa?.funcao ?? null), item: d.item, periodicidade: "diaria", diasSemana: [...d.dias], periodoRotulo: d.periodo, fotoObrigatoria: d.foto })
      .returning();
    modelos.push({ m, foto: "foto_arquivo" in d ? fotos[d.foto_arquivo] : undefined });
  }
  for (const [item, dia] of [
    ["Teste do gerador", 5],
    ["Teste da bomba de incêndio", 20],
  ] as const) {
    const [m] = await db
      .insert(rotinaModelos)
      .values({ organizacaoId: ctx.org, condominioId: c.id, pessoaId: funcs["Antônio"].id, item, periodicidade: "mensal", diaMes: dia, periodoRotulo: "manha", fotoObrigatoria: true, horaLimite: "10:00" })
      .returning();
    modelos.push({ m, foto: fotos.servico });
  }
  const itensHistorico = [];
  for (let d = 30; d >= 1; d--) {
    const data = somarDias(hoje, -d);
    for (const { m, foto } of modelos) {
      if (!modeloCaiNoDia(m, data)) continue;
      itensHistorico.push({ m, foto, data });
    }
  }
  const naoFeitos = new Set<number>();
  const alvo = Math.round(itensHistorico.length * 0.055);
  while (naoFeitos.size < alvo) naoFeitos.add(Math.floor(ctx.rnd() * itensHistorico.length));
  const motivos = ["Chuva forte, deixei para amanhã", "Material em falta", "Equipamento em manutenção", "Prioridade para um vazamento"];
  const linhasItens = itensHistorico.map((x, i) => {
    const feito = !naoFeitos.has(i);
    const comFoto = feito && x.m.fotoObrigatoria;
    return {
      organizacaoId: ctx.org,
      condominioId: c.id,
      modeloId: x.m.id,
      pessoaId: x.m.pessoaId,
      posto: x.m.posto,
      data: x.data,
      estado: feito ? ("feito" as const) : ("nao_feito" as const),
      motivo: feito ? null : motivos[i % motivos.length],
      arquivoId: comFoto ? (x.foto ?? fotos.servico) : null,
      fotoRecebidaEm: comFoto ? instanteLocal(x.data, x.m.periodoRotulo === "manha" ? 8 : 14, 10 + (i % 40)) : null,
      marcadoPorPessoaId: x.m.pessoaId,
      exemplo: true,
    };
  });
  for (let i = 0; i < linhasItens.length; i += 200) await db.insert(rotinaItens).values(linhasItens.slice(i, i + 200));

  /* Chamados de manutenção (30 dias, 14): 11 encerrados, 3 abertos. Histórico com exemplo = true. */
  const antonio = funcs["Antônio"];
  type Def = { desc: string; cat: string; urg: Urgencia; horas: number | null; diasAtras: number; un: string | null; auto?: string; emerg?: boolean; estado?: "novo" | "com_responsavel" | "agendado"; motivo?: "confirmado_pelo_morador" | "sem_confirmacao_72h" | "resolvido_na_entrada" | "encerrado_pelo_sindico"; prest?: string; origem?: "morador" | "funcionario" | "funcionario_pela_unidade"; por?: string; reaberto?: boolean };
  const defs: Def[] = [
    { desc: "Disjuntor do salão de festas caiu durante a festa", cat: "eletrica", urg: "media", horas: 0.5, diasAtras: 27, un: "305", auto: "Disjuntor", motivo: "resolvido_na_entrada" },
    { desc: "Água saindo amarelada na cozinha depois da obra da companhia na rua", cat: "hidraulica", urg: "media", horas: 1.2, diasAtras: 24, un: "903", auto: "Água amarelada", motivo: "resolvido_na_entrada" },
    { desc: "Interfone do apartamento sem tom", cat: "interfone", urg: "baixa", horas: 3.0, diasAtras: 22, un: "1101", auto: "Interfone", motivo: "resolvido_na_entrada" },
    { desc: "Cheiro de gás no 4º andar, perto da escada", cat: "gas", urg: "emergencia", horas: 5.5, diasAtras: 20, un: "402", emerg: true, motivo: "confirmado_pelo_morador", origem: "funcionario_pela_unidade", por: "Sérgio" },
    { desc: "Vazamento na casa de bombas", cat: "hidraulica", urg: "media", horas: 8.0, diasAtras: 19, un: null, motivo: "encerrado_pelo_sindico", origem: "funcionario", por: "Antônio" },
    { desc: "Vazamento pequeno na torneira do jardim", cat: "hidraulica", urg: "media", horas: 18.0, diasAtras: 17, un: "601", motivo: "confirmado_pelo_morador", prest: "hidro" },
    { desc: "Elevador social parando desnivelado no 6º andar", cat: "elevador", urg: "alta", horas: 22.0, diasAtras: 15, un: "604", motivo: "confirmado_pelo_morador", prest: "altura" },
    { desc: "Ralo da área da piscina entupido", cat: "area_comum", urg: "baixa", horas: 26.0, diasAtras: 13, un: "902", motivo: "sem_confirmacao_72h" },
    { desc: "Porta corta-fogo do 9º não fecha sozinha", cat: "area_comum", urg: "baixa", horas: 30.0, diasAtras: 11, un: "904", motivo: "confirmado_pelo_morador" },
    { desc: "Infiltração no teto da garagem, perto da coluna 3", cat: "infiltracao", urg: "media", horas: 49.0, diasAtras: 9, un: "101", motivo: "confirmado_pelo_morador", reaberto: true },
    { desc: "Grama alta e galhos no playground", cat: "area_comum", urg: "baixa", horas: 70.0, diasAtras: 8, un: "502", motivo: "confirmado_pelo_morador" },
    { desc: "Pintura descascando no hall do 8º andar", cat: "area_comum", urg: "baixa", horas: null, diasAtras: 3, un: "801", estado: "novo" },
    { desc: "Lâmpada da escada do 3º andar queimada (veio da ocorrência)", cat: "iluminacao", urg: "baixa", horas: null, diasAtras: 2, un: null, estado: "com_responsavel", origem: "funcionario", por: "Marcos" },
    { desc: "Portão da garagem com ruído ao abrir", cat: "portoes", urg: "media", horas: null, diasAtras: 1, un: "1004", estado: "agendado", prest: "eletro" },
  ];
  let numero = 1;
  const fotoServico = fotos.servico;
  for (const d of defs) {
    const aberto = d.emerg ? instanteLocal(somarDias(hoje, -d.diasAtras), 21, 38) : instanteLocal(somarDias(hoje, -d.diasAtras), 9 + (numero % 9), 15);
    const resolvido = d.horas !== null ? new Date(aberto.getTime() + d.horas * 3600000) : null;
    const passo = d.auto ? passos.find((p) => p.titulo.startsWith(d.auto!)) : null;
    const abridor = d.por ? funcs[d.por] : d.un ? moradorDa(d.un) : antonio;
    const encerrado = resolvido ? new Date(resolvido.getTime() + (d.motivo === "sem_confirmacao_72h" ? 72 * 3600000 : 3600000)) : null;
    const [ch] = await db
      .insert(chamados)
      .values({
        organizacaoId: ctx.org,
        condominioId: c.id,
        numero: numero++,
        origem: d.origem ?? "morador",
        abertoPorPessoaId: abridor.id,
        unidadeId: d.un ? (unidadePorNumero.get(d.un)?.id ?? null) : null,
        descricao: d.desc,
        categoria: d.cat,
        categoriaOrigem: d.emerg ? "regra" : "ia",
        urgencia: d.urg,
        urgenciaMotivo: d.emerg ? 'palavra de emergência: "cheiro de gas"' : "regra da categoria",
        emergenciaGrupo: d.emerg ? "fogo_gas" : null,
        estado: d.estado ?? "encerrado",
        responsavelPessoaId: d.estado === "com_responsavel" || (!d.prest && !d.auto && d.horas !== null) ? antonio.id : null,
        prestadorId: d.prest ? prest[d.prest] : null,
        agendadoPara: d.estado === "agendado" ? instanteLocal(somarDias(hoje, 1), 9) : null,
        resolvidoNaEntrada: Boolean(d.auto),
        passoAutoajudaId: passo?.id ?? null,
        reaberturas: d.reaberto ? 1 : 0,
        abertoEm: aberto,
        resolvidoEm: resolvido,
        encerradoEm: encerrado,
        motivoEncerramento: d.motivo ?? null,
        exemplo: true,
        atualizadoEm: encerrado ?? aberto,
      })
      .returning();
    const ev = (tipo: string, texto: string, quando: Date, autor = "Sistema", arquivoIds?: string[]) =>
      db.insert(chamadoEventos).values({ organizacaoId: ctx.org, chamadoId: ch.id, tipo, texto, autorRotulo: autor, criadoEm: quando, arquivoIds: arquivoIds ?? null, exemplo: true });
    await ev("aberto", d.desc, aberto, d.por ? `${abridor.nome}${d.un ? ` (pela unidade ${d.un})` : ""}` : `Morador (unidade ${d.un})`);
    if (d.emerg) {
      await ev("emergencia_seguranca", "Mensagem fixa de segurança enviada na hora (193 e plantão).", new Date(aberto.getTime() + 5000));
      await ev("emergencia_avisada", "Aviso direto ao síndico e ao contato de plantão às 21:40.", new Date(aberto.getTime() + 120000));
    }
    if (d.auto && resolvido) await ev("autoajuda_resolveu", "Resolvido na entrada com o passo de autoajuda.", resolvido, `Morador (unidade ${d.un})`);
    else if (resolvido) {
      if (d.reaberto) {
        const meio = new Date(aberto.getTime() + 20 * 3600000);
        await ev("resolvido", "Serviço concluído, com foto.", meio, "Antônio Pereira", [fotoServico]);
        await ev("reaberto", "Morador respondeu que NÃO foi resolvido: chamado reaberto.", new Date(meio.getTime() + 7200000), `Morador (unidade ${d.un})`);
      }
      await ev("resolvido", "Serviço concluído, com foto.", resolvido, d.prest ? "Prestador" : "Antônio Pereira", [fotoServico]);
      const textos = { confirmado_pelo_morador: "Morador confirmou que foi resolvido.", sem_confirmacao_72h: "Encerrado sem confirmação do morador (sem resposta em 72 h).", encerrado_pelo_sindico: "Sem morador para confirmar (área comum): encerrado pelo síndico.", resolvido_na_entrada: "" };
      await ev(d.motivo === "confirmado_pelo_morador" ? "confirmacao" : d.motivo === "sem_confirmacao_72h" ? "sem_confirmacao" : "encerrado_sindico", textos[d.motivo!], encerrado!, d.motivo === "encerrado_pelo_sindico" ? QUEM : "Sistema");
    }
    if (d.estado === "com_responsavel") await ev("atribuido", "Responsável padrão da categoria: Antônio Pereira", new Date(aberto.getTime() + 60000));
    if (d.estado === "agendado") await ev("atribuido", "Responsável padrão da categoria: Eletro Ponto Instalações (fictícia), agendado para amanhã às 09:00", new Date(aberto.getTime() + 3600000), QUEM);
  }

  /* Ocorrências (chamados de natureza "ocorrência", 30 dias, 9). */
  const ocorrencias = [
    ["barulho", "Som alto depois das 22h vindo do 5º andar", 26],
    ["barulho", "Festa com barulho depois das 22h no salão", 21],
    ["barulho", "Arrastar de móveis depois das 23h", 12],
    ["garagem", "Objeto guardado em vaga (caixas)", 18],
    ["garagem", "Bicicleta deixada em vaga", 6],
    ["seguranca", "Portão de pedestres deixado aberto", 14],
    ["seguranca", "Portão da garagem ficou aberto depois da entrada de um carro", 4],
    ["animais", "Cachorro sem guia na área da piscina", 10],
    ["area_comum", "Lâmpada queimada na escada do 3º andar (virou o chamado nº 13)", 2],
  ] as const;
  for (const [cat, texto, dias] of ocorrencias) {
    const quando = instanteLocal(somarDias(hoje, -dias), 22, 30);
    const [o2] = await db
      .insert(chamados)
      .values({ organizacaoId: ctx.org, condominioId: c.id, numero: numero++, natureza: "ocorrencia", origem: "funcionario", abertoPorPessoaId: (funcs["Sérgio"] ?? antonio).id, descricao: texto, categoria: cat, categoriaOrigem: "ia", urgencia: "baixa", urgenciaMotivo: "ocorrência registrada", estado: "encerrado", motivoEncerramento: "registrada", abertoEm: quando, encerradoEm: quando, atualizadoEm: quando, exemplo: true })
      .returning();
    await db.insert(chamadoEventos).values({ organizacaoId: ctx.org, chamadoId: o2.id, tipo: "ocorrencia", texto, autorRotulo: "Portaria", criadoEm: quando, exemplo: true });
  }


  /* Dúvidas (30 dias): 15 respondidas pelos documentos, 8 encaminhadas (6 respondidas pelo síndico, 4 salvas; 2 esperando). */
  const respondidas: [string, string, string, string][] = [
    ["Até que horas pode fazer barulho?", "5", "O horário de silêncio é das 22h às 7h, todos os dias.", "O horário de silêncio é das 22h às 7h, todos os dias."],
    ["Pode ter cachorro no prédio?", "9", "Animais de estimação circulam nas áreas comuns no colo ou na guia, e só pelo elevador de serviço.", "Animais de estimação circulam nas áreas comuns no colo ou na guia"],
    ["Posso fazer obra no sábado?", "12", "Aos sábados, obras são permitidas das 8h às 12h.", "aos sábados, das 8h às 12h"],
    ["Preciso avisar antes de reformar o banheiro?", "12", "Sim: avise a administração com 3 dias úteis de antecedência.", "O morador deve avisar a administração com 3 dias úteis de antecedência"],
    ["Como agendo a mudança?", "15", "A mudança é agendada na portaria com 48 horas de antecedência.", "com agendamento na portaria com 48 horas de antecedência"],
    ["A piscina abre segunda?", "18", "Não. Às segundas-feiras a piscina fica fechada para limpeza.", "Às segundas-feiras ela fica fechada para limpeza."],
    ["Quantos convidados posso levar na piscina?", "18", "Cada unidade pode levar até 2 convidados por dia, acompanhados de um morador.", "Cada unidade pode levar até 2 convidados por dia"],
    ["Qual a taxa do salão de festas?", "21", "A taxa de limpeza do salão é de R$ 150,00, com uso até as 22h.", "taxa de limpeza de R$ 150,00"],
    ["Até que horas posso usar o salão?", "21", "O uso do salão de festas vai até as 22h.", "com uso até as 22h"],
    ["Posso guardar caixas na minha vaga?", "24", "Não: é proibido guardar objetos nas vagas.", "é proibido guardar objetos nas vagas"],
    ["Onde deixo a bicicleta?", "27", "As bicicletas ficam no bicicletário do subsolo.", "Bicicletas ficam no bicicletário do subsolo."],
    ["Que horas posso levar o lixo?", "30", "O lixo vai à lixeira do térreo das 7h às 22h, separado em reciclável e orgânico.", "levado à lixeira do térreo, das 7h às 22h"],
    ["Onde faço uma reclamação?", "33", "Pelos canais oficiais do condomínio: o bot ou a administração.", "Reclamações e sugestões são feitas pelos canais oficiais do condomínio"],
    ["A piscina funciona até que horas no domingo?", "18", "A piscina funciona de terça a domingo, das 9h às 21h.", "A piscina funciona de terça a domingo, das 9h às 21h."],
    ["Mudança pode ser no domingo?", "15", "Mudanças podem ser feitas de segunda a sábado, das 8h às 18h.", "Mudanças podem ser feitas de segunda a sábado, das 8h às 18h"],
  ];
  let i = 0;
  for (const [pergunta, art, resposta, literal] of respondidas) {
    const tr = trecho(art);
    const quando = instanteLocal(somarDias(hoje, -(28 - i)), 19, 5);
    await db.insert(duvidas).values({
      organizacaoId: ctx.org,
      condominioId: c.id,
      pessoaId: moradores[(i * 5) % moradores.length].id,
      pergunta,
      estado: "respondida_documentos",
      resposta,
      citacoes: [{ trechoId: tr.id, rotulo: tr.rotulo, textoLiteral: literal }],
      origemResposta: "ia",
      exemplo: true,
      respondidaPorNome: QUEM,
      respondidaEm: new Date(quando.getTime() + 3600000),
      enviadaEm: new Date(quando.getTime() + 3600000),
      criadoEm: quando,
    });
    i++;
  }
  const encaminhadas: [string, string | null, boolean][] = [
    ["Posso pagar o condomínio por Pix?", "Sim. A chave Pix do condomínio está no boleto do mês; mande o comprovante para a administração.", true],
    ["Quando vai ser a próxima dedetização?", "A próxima dedetização está prevista para o começo do mês que vem; o aviso sai por aqui.", true],
    ["O condomínio tem seguro para o meu carro na garagem?", "O seguro do condomínio cobre as partes comuns; veículos dependem da apólice. Envio o resumo da apólice se precisar.", true],
    ["Posso instalar rede de proteção na sacada?", "Pode, desde que siga o padrão aprovado em assembleia (cor branca). Fale com a portaria antes da instalação.", true],
    ["O condomínio paga o conserto da infiltração que vem do apartamento de cima?", "Vou avaliar o seu caso com o morador de cima e te retorno esta semana.", false],
    ["Posso trocar a fechadura da porta de entrada da minha unidade?", "Pode, a porta da unidade é sua. Só não altere a fachada do corredor.", false],
    ["O portão da garagem vai ser trocado?", null, false],
    ["Posso usar a churrasqueira do salão sem reservar?", null, false],
  ];
  for (const [pergunta, resposta, salvar] of encaminhadas) {
    const quando = instanteLocal(somarDias(hoje, -(20 - i)), 20, 10);
    let trechoId: string | null = null;
    if (resposta && salvar) {
      const [t] = await db
        .insert(trechos)
        .values({ organizacaoId: ctx.org, condominioId: c.id, rotulo: `Resposta do condomínio (${QUEM}, ${new Date(quando.getTime() + 86400000).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })})`, texto: `Pergunta: ${pergunta}\nResposta: ${resposta}`, origem: "resposta_sindico", autorRotulo: QUEM })
        .returning({ id: trechos.id });
      trechoId = t.id;
    }
    await db.insert(duvidas).values({
      organizacaoId: ctx.org,
      condominioId: c.id,
      pessoaId: moradores[(i * 3) % moradores.length].id,
      pergunta,
      estado: resposta ? "respondida_sindico" : "encaminhada",
      resposta,
      motivoEncaminhamento: resposta === null || !salvar ? "não está nos documentos" : "não está nos documentos",
      respondidaPorNome: resposta ? QUEM : null,
      respondidaEm: resposta ? new Date(quando.getTime() + 86400000) : null,
      enviadaEm: resposta ? new Date(quando.getTime() + 86400000) : null,
      salvaComoTrechoId: trechoId,
      origemResposta: resposta ? "sindico" : null,
      assumidaEm: resposta ? new Date(quando.getTime() + 6 * 3600000) : null,
      exemplo: true,
      criadoEm: resposta ? quando : instanteLocal(somarDias(hoje, -1), 21, 15 + i),
    });
    i++;
  }

  /* Despesas (30 dias), 19 documentos lidos pela IA: 16 lançadas (R$ 23.418,70), 1 estornada, 1 para conferir (boleto), 1 recusada. */
  const lancadas: [string | null, string, number, string][] = [
    ["altura", "elevador", 185000, "Manutenção mensal dos elevadores"],
    ["fogo", "incendio", 248000, "Recarga de extintores do subsolo"],
    ["dedetiza", "controle_pragas", 98000, "Desinsetização das áreas comuns"],
    ["jardim", "jardinagem", 120000, "Manutenção mensal do jardim"],
    ["eletro", "manutencao_eletrica", 76000, "Troca de reatores da garagem"],
    ["hidro", "manutencao_hidraulica", 54000, "Reparo na bomba de recalque"],
    ["eletro", "manutencao_eletrica", 132000, "Revisão do quadro geral"],
    ["altura", "elevador", 89000, "Troca de botoeira do elevador social"],
    [null, "consumo", 597000, "Conta de água do mês (áreas comuns)"],
    [null, "consumo", 268000, "Conta de luz do mês (áreas comuns)"],
    [null, "limpeza", 63470, "Material de limpeza"],
    ["eletro", "manutencao_eletrica", 42000, "Troca de lâmpadas da escada"],
    ["jardim", "jardinagem", 38000, "Poda de galhos do playground"],
    [null, "seguranca", 156000, "Manutenção do circuito de câmeras"],
    ["hidro", "manutencao_hidraulica", 47400, "Troca de registro do jardim"],
    [null, "outros", 128000, "Conserto da porta corta-fogo do 9º"],
  ];
  const prestPorChave = (k: string | null) => (k ? PRESTADORES.find((p) => p.chave === k)! : null);
  let dia = 29;
  const base = (k: string | null, data: string) => {
    const p = prestPorChave(k);
    return { organizacaoId: ctx.org, condominioId: c.id, fornecedorNome: p?.razaoSocial ?? "Fornecedor local (fictício)", cnpj: p?.cnpj ?? null, prestadorId: k ? prest[k] : null, dataEmissao: data, arquivoId: comprovante, origem: "ia" as const, criadoPorRotulo: QUEM, exemplo: true, criadoEm: instanteLocal(data, 11) };
  };
  for (const [k, categoria, valor, descricao] of lancadas) {
    const data = somarDias(hoje, -dia);
    await db.insert(despesas).values({ ...base(k, data), estado: "lancada", tipoDocumento: k ? "nota_fiscal" : "recibo", valorCentavos: valor, descricao, categoria, conferidoPorNome: QUEM, conferidoEm: instanteLocal(data, 18), aprovadoPorNome: QUEM, aprovadoEm: instanteLocal(data, 18) });
    dia = Math.max(2, dia - 2);
  }
  // Estornada: a mesma nota da Dedetiza lançada duas vezes (nada se apaga; estorno com motivo).
  const dataDup = somarDias(hoje, -26);
  await db.insert(despesas).values({ ...base("dedetiza", dataDup), estado: "estornada", tipoDocumento: "nota_fiscal", valorCentavos: 98000, descricao: "Desinsetização das áreas comuns", categoria: "controle_pragas", conferidoPorNome: QUEM, conferidoEm: instanteLocal(dataDup, 18), aprovadoPorNome: QUEM, aprovadoEm: instanteLocal(dataDup, 18), estornoMotivo: "lançada duas vezes", estornadoPorNome: QUEM, estornadoEm: instanteLocal(somarDias(hoje, -25), 9) });
  // Para conferir: boleto da Jardim Verde Vivo, R$ 640,00, vencimento D+9, linha com DVs válidos (banco 341).
  const fatorDe = (iso: string) => 1000 + Math.round((Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(2025, 1, 22)) / 86400000);
  const vencJardim = somarDias(hoje, 9);
  await db.insert(despesas).values({
    ...base("jardim", somarDias(hoje, -1)),
    estado: "para_conferir",
    tipoDocumento: "boleto",
    vencimento: vencJardim,
    valorCentavos: 64000,
    descricao: "Plantio de mudas no canteiro da entrada",
    categoria: "jardinagem",
    linhaDigitavel: montarLinhaBancaria({ banco: "341", fator: fatorDe(vencJardim), valorCentavos: 64000, campoLivre: "1090000012345678901234000" }),
    bancoEmissor: "Itaú",
    valorLinhaCentavos: 64000,
    vencimentoLinha: vencJardim,
    beneficiarioImpressoNome: PRESTADORES[5].razaoSocial,
    beneficiarioImpressoCnpj: PRESTADORES[5].cnpj,
    conferencia: { linha: { valida: true, erros: [], banco: "Itaú", valor: "R$ 640,00", vencimento: vencJardim, tipo: "bancario" } },
    divergencias: [],
  });
  // Recusada: boleto "da Eletro Ponto" com beneficiário impresso de outro CNPJ (lido pela IA, sugestão).
  const vencEp = somarDias(hoje, 8);
  await db.insert(despesas).values({
    ...base("eletro", somarDias(hoje, -6)),
    estado: "recusada",
    tipoDocumento: "boleto",
    vencimento: vencEp,
    valorCentavos: 186000,
    descricao: "Boleto de serviço no portão",
    categoria: "manutencao_eletrica",
    linhaDigitavel: montarLinhaBancaria({ banco: "237", fator: fatorDe(vencEp), valorCentavos: 186000, campoLivre: "4410000098765432109876500" }),
    bancoEmissor: "Bradesco",
    valorLinhaCentavos: 186000,
    vencimentoLinha: vencEp,
    beneficiarioImpressoNome: "EP Serviços Elétricos Ltda",
    beneficiarioImpressoCnpj: CNPJ_BENEFICIARIO_DIVERGENTE,
    divergencias: [`Beneficiário impresso diferente do prestador (lido pela IA): ${CNPJ_BENEFICIARIO_DIVERGENTE} no boleto, ${PRESTADORES[4].cnpj} no cadastro. Registre a decisão.`],
    decisaoMotivo: "recusado: confirmei por telefone com a Eletro Ponto que não emitiu este boleto",
    conferidoPorNome: QUEM,
    conferidoEm: instanteLocal(somarDias(hoje, -5), 10),
  });


  // Vencimento da caixa d'água: chamado/serviço ainda não agendado (é o ponto de partida do caso).
  void sindico;
  void inArray;
  return c;
}

