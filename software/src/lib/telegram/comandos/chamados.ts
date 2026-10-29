import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { chamados, contatosSindico, pessoas, unidades } from "@/db/schema";
import {
  abrirChamado,
  anexarFotos,
  chamadosAtribuidos,
  confirmarResolucao,
  mensagemEmergenciaDoCondominio,
  resolverChamado,
  resultadoAutoajuda,
  ROTULO_ESTADO,
} from "@/features/chamados/servico";
import { CATEGORIAS_CHAMADO, ROTULO_CATEGORIA, type CategoriaChamado } from "@/features/chamados/ia";
import { avisarSindicos } from "@/features/duvidas/servico";
import { iaDisponivel } from "@/lib/ia/funcoes";
import { detectarEmergencia, IDENTIFICACAO_IA, normalizar } from "@/lib/negocio/linguagem";
import { definirEstado, limparEstado } from "../estado";
import type { ContextoBot, PessoaVinculada, Roteador } from "../roteador";
import type { TecladoInline } from "../tipos";
import { obterArquivoDaMensagem } from "./arquivos";
import { recusarBotao, responderComo, rotuloAutor, UUID, vinculoNoCondominio } from "./util";

const MAX_FOTOS = 4;

async function unidadeDaPessoa(p: PessoaVinculada): Promise<string | null> {
  const [x] = await db.select({ u: pessoas.unidadeId }).from(pessoas).where(eq(pessoas.id, p.id)).limit(1);
  return x?.u ?? null;
}

async function acharUnidade(condominioId: string, texto: string) {
  const t = normalizar(texto).replace(/[^a-z0-9 -]/g, " ").trim();
  if (/area comum|areas comuns|garagem|hall|portaria/.test(t)) return { id: null as string | null, rotulo: "área comum" };
  const num = t.match(/\d{1,5}/)?.[0];
  if (!num) return null;
  const [u] = await db.select().from(unidades).where(and(eq(unidades.condominioId, condominioId), eq(unidades.numero, num))).limit(1);
  return u ? { id: u.id, rotulo: `unidade ${u.numero}` } : null;
}

/** Mensagens depois de abrir o chamado: número, pergunta, autoajuda (identificada como IA, com "Falar com o síndico"). */
async function responderAbertura(ctx: ContextoBot, r: Awaited<ReturnType<typeof abrirChamado>>) {
  const ch = r.chamado;
  if (r.emergencia) return;
  const linhas = [`Chamado nº ${ch.numero} aberto (${ROTULO_CATEGORIA[ch.categoria] ?? ch.categoria}). Você recebe cada mudança por aqui; /meus mostra o andamento.`];
  if (r.iaUsada) linhas.push(`\n${IDENTIFICACAO_IA.replace("a partir dos documentos do condomínio", "na triagem")}: categoria sugerida, o síndico pode trocar.`);
  if (r.pergunta) linhas.push(`\nPara ajudar: ${r.pergunta}`);
  const teclado: TecladoInline = [];
  if (r.passo) {
    linhas.push(`\nAntes de chamar alguém, tente isto (passo aprovado pelo síndico):\n${r.passo.texto}`);
    teclado.push([
      { text: "Resolveu", callback_data: `aa:s:${ch.id}` },
      { text: "Não resolveu", callback_data: `aa:n:${ch.id}` },
    ]);
  }
  if (r.iaUsada || r.passo) teclado.push([{ text: "Falar com o síndico", callback_data: `fs:c:${ch.id}` }]);
  await ctx.responder(linhas.join("\n"), teclado.length ? { teclado } : undefined);
}

async function abrirPeloBot(ctx: ContextoBot, descricao: string, extra: { unidadeId?: string | null; categoria?: CategoriaChamado; arquivoIds?: string[]; mediaGroupId?: string | null; natureza?: "manutencao" | "ocorrencia" } = {}) {
  const p = ctx.pessoa!;
  const pelaUnidade = p.papel === "funcionario" && extra.unidadeId;
  const r = await abrirChamado({
    organizacaoId: p.organizacaoId,
    condominioId: p.condominioId,
    origem: p.papel === "morador" ? "morador" : p.papel === "sindico" ? "sindico" : pelaUnidade ? "funcionario_pela_unidade" : "funcionario",
    descricao,
    natureza: extra.natureza,
    abertoPorPessoaId: p.id,
    autorRotulo: rotuloAutor(p),
    unidadeId: p.papel === "morador" ? await unidadeDaPessoa(p) : (extra.unidadeId ?? null),
    categoria: extra.categoria ?? null,
    categoriaOrigem: extra.categoria ? "botao" : undefined,
    arquivoIds: extra.arquivoIds,
    mediaGroupId: extra.mediaGroupId,
    saida: ctx.saida,
  });
  return r;
}

/** Sem IA, a categoria sai de botões (até 8). */
function tecladoCategorias(): TecladoInline {
  const cats = CATEGORIAS_CHAMADO.filter((c) => c !== "gas").slice(0, 8);
  const linhas: TecladoInline = [];
  for (let i = 0; i < cats.length; i += 2) linhas.push(cats.slice(i, i + 2).map((c) => ({ text: ROTULO_CATEGORIA[c], callback_data: `cat:${c}` })));
  return linhas;
}

async function seguirComDescricao(ctx: ContextoBot, descricao: string, unidadeId: string | null, arquivoIds?: string[]) {
  const p = ctx.pessoa!;
  if (!iaDisponivel()) {
    await definirEstado(ctx.chatId, p.id, "descricao_chamado", { dados: { descricao, unidadeId, arquivoIds: arquivoIds ?? [], categoriaPendente: true } });
    await ctx.responder("Qual é o tipo do problema?", { teclado: tecladoCategorias() });
    return;
  }
  const r = await abrirPeloBot(ctx, descricao, { unidadeId, arquivoIds });
  await responderAbertura(ctx, r);
  await definirEstado(ctx.chatId, p.id, "fotos_chamado", { refId: r.chamado.id, dados: { fotos: 0 } });
  await ctx.responder(`Se quiser, mande até ${MAX_FOTOS} fotos agora (não fotografe pessoas).`, { teclado: [[{ text: "Sem foto", callback_data: `pr:f:${r.chamado.id}` }]] });
}

export function registrarChamados(roteador: Roteador) {
  /* Emergência primeiro: antes do estado, da IA e de qualquer pergunta. */
  roteador.registrarAntesDoEstado(async (ctx) => {
    const p = ctx.pessoa;
    if (!p || (p.papel !== "morador" && p.papel !== "funcionario") || !ctx.texto) return false;
    const em = detectarEmergencia(ctx.texto);
    if (!em) return false;
    const unidadeId = ctx.estado?.aguardando === "descricao_chamado" ? ((ctx.estado.dados?.unidadeId as string | null) ?? null) : null;
    await limparEstado(ctx.chatId);
    // A mensagem fixa de segurança sai antes de qualquer outra coisa.
    await ctx.responder(await mensagemEmergenciaDoCondominio(p.condominioId, em.grupo));
    const r = await abrirPeloBot(ctx, ctx.texto, { unidadeId });
    await ctx.responder(
      r.avisosEmergencia > 0
        ? `Chamado de emergência nº ${r.chamado.numero} aberto. ${r.avisosEmergencia === 1 ? "1 pessoa do plantão recebeu" : `${r.avisosEmergencia} pessoas do plantão receberam`} o alerta pelo Telegram agora.`
        : `Chamado de emergência nº ${r.chamado.numero} aberto, mas ninguém do plantão está com o Telegram conectado. Ligue para a portaria ou o síndico; em risco à vida, 193.`,
    );
    return true;
  });

  roteador.registrarComando({
    nome: "chamado",
    descricao: "Abrir um chamado (problema para consertar), com até 4 fotos",
    permissao: ["morador", "funcionario"],
    async executar(ctx) {
      const p = ctx.pessoa!;
      if (p.papel === "funcionario") {
        await definirEstado(ctx.chatId, p.id, "unidade_chamado");
        await ctx.responder('Para qual unidade? Digite o número (ex.: 302) ou "área comum".');
        return;
      }
      await definirEstado(ctx.chatId, p.id, "descricao_chamado");
      await ctx.responder("Descreva o problema em uma mensagem (onde é e o que está acontecendo).");
    },
  });

  roteador.registrarEstado("unidade_chamado", async (ctx) => {
    if (!ctx.texto) return false;
    const u = await acharUnidade(ctx.pessoa!.condominioId, ctx.texto);
    if (!u) {
      await ctx.responder('Não achei essa unidade. Digite só o número (ex.: 302) ou "área comum".');
      return true;
    }
    await definirEstado(ctx.chatId, ctx.pessoa!.id, "descricao_chamado", { dados: { unidadeId: u.id } });
    await ctx.responder(`Chamado para a ${u.rotulo}. Agora descreva o problema.`);
    return true;
  });

  roteador.registrarEstado("descricao_chamado", async (ctx) => {
    if (!ctx.texto) return false;
    // Sem IA, a descrição já foi dada e falta a categoria (botões).
    if (ctx.estado?.dados?.categoriaPendente) {
      await ctx.responder("Toque no tipo do problema nos botões acima.");
      return true;
    }
    await limparEstado(ctx.chatId);
    await seguirComDescricao(ctx, ctx.texto, (ctx.estado?.dados?.unidadeId as string | null) ?? null, (ctx.estado?.dados?.arquivoIds as string[] | undefined) ?? undefined);
    return true;
  });

  roteador.registrarAcao({
    prefixo: "cat",
    permissao: ["morador", "funcionario"],
    async executar(ctx, chave) {
      const e = ctx.estado;
      if (!e || e.aguardando !== "descricao_chamado" || !e.dados?.descricao || !(CATEGORIAS_CHAMADO as readonly string[]).includes(chave)) {
        await ctx.responderBotao("Envie /chamado de novo.");
        return;
      }
      await limparEstado(ctx.chatId);
      await ctx.responderBotao(ROTULO_CATEGORIA[chave]);
      const r = await abrirPeloBot(ctx, String(e.dados.descricao), { unidadeId: (e.dados.unidadeId as string | null) ?? null, categoria: chave as CategoriaChamado, arquivoIds: (e.dados.arquivoIds as string[] | undefined) ?? undefined });
      await responderAbertura(ctx, r);
      await definirEstado(ctx.chatId, ctx.pessoa!.id, "fotos_chamado", { refId: r.chamado.id, dados: { fotos: 0 } });
      await ctx.responder(`Se quiser, mande até ${MAX_FOTOS} fotos agora.`, { teclado: [[{ text: "Sem foto", callback_data: `pr:f:${r.chamado.id}` }]] });
    },
  });

  roteador.registrarEstado("fotos_chamado", async (ctx) => {
    const e = ctx.estado!;
    if (!ctx.mensagem?.photo?.length && !ctx.mensagem?.document) return false;
    const a = await obterArquivoDaMensagem(ctx);
    if (!a || !e.refId) return true;
    const fotos = Number(e.dados?.fotos ?? 0) + 1;
    await anexarFotos({ organizacaoId: ctx.pessoa!.organizacaoId, chamadoId: e.refId, arquivoIds: [a.id], autorRotulo: rotuloAutor(ctx.pessoa!), autorPessoaId: ctx.pessoa!.id });
    if (fotos >= MAX_FOTOS) {
      await limparEstado(ctx.chatId);
      await ctx.responder("Recebi as fotos. Obrigado!");
    } else {
      await definirEstado(ctx.chatId, ctx.pessoa!.id, "fotos_chamado", { refId: e.refId, dados: { fotos } });
      if (!ctx.mensagem.media_group_id) await ctx.responder(`Foto ${fotos} recebida.`, { teclado: [[{ text: "Pronto", callback_data: `pr:f:${e.refId}` }]] });
    }
    return true;
  });

  /* "Pronto" / "Sem foto" (pr:f) e "Pronto" da conclusão (pr:c). */
  roteador.registrarAcao({
    prefixo: "pr",
    permissao: "vinculado",
    async executar(ctx, dados) {
      const [tipo, id] = dados.split(":");
      if (!UUID.test(id ?? "")) return;
      if (tipo === "f") {
        await limparEstado(ctx.chatId);
        await ctx.responderBotao("Ok.");
        return;
      }
      if (tipo === "c") {
        const e = ctx.estado;
        const [ch] = await db.select().from(chamados).where(eq(chamados.id, id)).limit(1);
        const quem = ch && (await vinculoNoCondominio(ctx.chatId, ch.condominioId, ["funcionario", "prestador"]));
        if (!ch || !quem) return recusarBotao(ctx);
        const fotos = ((e?.dados?.fotos as string[]) ?? []).filter(Boolean);
        try {
          const r = await resolverChamado({ organizacaoId: ch.organizacaoId, chamadoId: ch.id, arquivoIds: fotos, autorRotulo: quem.nome, autorPessoaId: quem.id });
          await limparEstado(ctx.chatId);
          await ctx.responderBotao("Resolvido.");
          await responderComo(ctx, quem, `Chamado nº ${ch.numero} resolvido, com ${fotos.length} foto(s). ${r.avisados ? "O morador vai confirmar." : "O síndico encerra (sem morador para confirmar)."}`);
        } catch (er) {
          await ctx.responderBotao(er instanceof Error ? er.message.slice(0, 190) : "Não deu.");
        }
      }
    },
  });

  /* Funcionário: /chamados e "Resolvido" (pede a foto). */
  roteador.registrarComando({
    nome: "chamados",
    descricao: "Chamados atribuídos a você; \"Resolvido\" pede a foto",
    permissao: ["funcionario"],
    async executar(ctx) {
      const p = ctx.pessoa!;
      const lista = await chamadosAtribuidos({ pessoaId: p.id, condominioId: p.condominioId });
      if (lista.length === 0) {
        await ctx.responder("Nenhum chamado com você agora.");
        return;
      }
      for (const ch of lista.slice(0, 8)) {
        await ctx.responder(`Nº ${ch.numero} · ${ROTULO_ESTADO[ch.estado]}\n${ch.descricao}`, { teclado: [[{ text: "Resolvido", callback_data: `ch:r:${ch.id}` }]] });
      }
    },
  });

  roteador.registrarAcao({
    prefixo: "ch",
    permissao: "publico",
    async executar(ctx, dados) {
      const [tipo, id] = dados.split(":");
      if (!UUID.test(id ?? "")) return;
      const [ch] = await db.select().from(chamados).where(eq(chamados.id, id)).limit(1);
      if (!ch) return recusarBotao(ctx);
      if (tipo === "r") {
        // Com vários vínculos no mesmo chat (ex.: funcionário e prestador), vale o papel atual da conversa.
        const atual = ctx.pessoa && ctx.pessoa.condominioId === ch.condominioId && (ctx.pessoa.papel === "funcionario" || ctx.pessoa.papel === "prestador") ? ctx.pessoa : null;
        const f = atual ?? (await vinculoNoCondominio(ctx.chatId, ch.condominioId, ["funcionario", "prestador"]));
        if (!f) return recusarBotao(ctx);
        await definirEstado(ctx.chatId, f.id, "conclusao", { refId: ch.id, dados: { fotos: [] } });
        await ctx.responderBotao();
        await responderComo(ctx, f, `Mande a(s) foto(s) do serviço feito no chamado nº ${ch.numero} e toque em "Pronto".`, [[{ text: "Pronto", callback_data: `pr:c:${ch.id}` }]]);
        return;
      }
      // Morador confirma: "Resolvido" (ok) / "Não resolvido" (no).
      const m = await vinculoNoCondominio(ctx.chatId, ch.condominioId, ["morador"]);
      if (!m || (ch.abertoPorPessoaId !== m.id && !(ch.unidadeId && ch.unidadeId === (await unidadeDaPessoa(m))))) return recusarBotao(ctx);
      const r = await confirmarResolucao({ organizacaoId: ch.organizacaoId, chamadoId: ch.id, resolvido: tipo === "ok", pessoaId: m.id, autorRotulo: rotuloAutor(m) });
      await ctx.responderBotao(r.mudou ? "Obrigado!" : "Este chamado já foi encerrado.");
      if (r.mudou) await responderComo(ctx, m, tipo === "ok" ? `Chamado nº ${ch.numero} encerrado. Obrigado por confirmar.` : `Chamado nº ${ch.numero} reaberto. O responsável foi avisado.`);
    },
  });

  roteador.registrarEstado("conclusao", async (ctx) => {
    const e = ctx.estado!;
    if (!ctx.mensagem?.photo?.length && !ctx.mensagem?.document) {
      if (ctx.texto) await ctx.responder('Mande as fotos do serviço e toque em "Pronto".');
      return true;
    }
    const a = await obterArquivoDaMensagem(ctx);
    if (!a || !e.refId) return true;
    const p = ctx.pessoa!;
    const legenda = normalizar(ctx.mensagem.caption ?? "");
    const ehPdf = a.mimeType === "application/pdf";
    // Nota, recibo ou boleto → despesa para conferir; PDF → comprovante do serviço; foto → foto do serviço.
    if (/nota|recibo|boleto|fatura/.test(legenda) || (ehPdf && /nota|nf/.test(normalizar(a.nome)))) {
      const { criarDespesaDeArquivo } = await import("@/features/despesas/servico");
      const [ch] = await db.select().from(chamados).where(eq(chamados.id, e.refId)).limit(1);
      await criarDespesaDeArquivo({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, arquivoId: a.id, quem: p.nome, prestadorId: ch?.prestadorId ?? null });
      await ctx.responder("Nota recebida: vai para o síndico conferir.");
      return true;
    }
    if (ehPdf) {
      const [ch] = await db.select().from(chamados).where(eq(chamados.id, e.refId)).limit(1);
      await anexarFotos({ organizacaoId: p.organizacaoId, chamadoId: e.refId, arquivoIds: [a.id], autorRotulo: p.nome, autorPessoaId: p.id });
      if (ch?.vencimentoId) {
        const { lerDocumentoIA3 } = await import("@/features/prestadores/ia");
        const { registrarServico } = await import("@/features/vencimentos/servico");
        const l = await lerDocumentoIA3({ organizacaoId: p.organizacaoId, arquivoId: a.id, esperado: "comprovante_servico" });
        await registrarServico({ organizacaoId: p.organizacaoId, vencimentoId: ch.vencimentoId, dataServico: l.ok ? l.dataServico : null, validadeImpressa: l.ok ? l.validade : null, prestadorId: ch.prestadorId, arquivoId: a.id, origemLeitura: l.ok ? "ia" : "manual", leituraIa: l.ok ? l.leitura : null, chamadoId: ch.id });
        await ctx.responder("Comprovante recebido: o síndico confere e o vencimento é recalculado.");
      } else await ctx.responder("Comprovante anexado ao chamado.");
      return true;
    }
    const fotos = [...((e.dados?.fotos as string[]) ?? []), a.id];
    await definirEstado(ctx.chatId, p.id, "conclusao", { refId: e.refId, dados: { fotos } });
    if (!ctx.mensagem.media_group_id) await ctx.responder(`Foto ${fotos.length} recebida.`, { teclado: [[{ text: "Pronto", callback_data: `pr:c:${e.refId}` }]] });
    return true;
  });

  /* Autoajuda e "Falar com o síndico". */
  roteador.registrarAcao({
    prefixo: "aa",
    permissao: "publico",
    async executar(ctx, dados) {
      const [tipo, id] = dados.split(":");
      if (!UUID.test(id ?? "")) return;
      const [ch] = await db.select().from(chamados).where(eq(chamados.id, id)).limit(1);
      const m = ch && (await vinculoNoCondominio(ctx.chatId, ch.condominioId, ["morador", "funcionario"]));
      if (!ch || !m || ch.abertoPorPessoaId !== m.id) return recusarBotao(ctx);
      const r = await resultadoAutoajuda({ organizacaoId: ch.organizacaoId, chamadoId: ch.id, resolveu: tipo === "s", pessoaId: m.id, autorRotulo: rotuloAutor(m) });
      await ctx.responderBotao(r.mudou ? "Registrado." : "Este chamado já seguiu.");
      if (r.mudou) await responderComo(ctx, m, tipo === "s" ? `Que bom! Chamado nº ${ch.numero} encerrado como resolvido na entrada.` : `Certo: o chamado nº ${ch.numero} segue para o responsável.`);
    },
  });

  roteador.registrarAcao({
    prefixo: "fs",
    permissao: "publico",
    async executar(ctx, dados) {
      const [tipo, id] = dados.split(":");
      if (!UUID.test(id ?? "") || (tipo !== "c" && tipo !== "d")) return;
      let condominioId: string | null = null;
      let organizacaoId = "";
      let descricao = "";
      if (tipo === "c") {
        const [ch] = await db.select().from(chamados).where(eq(chamados.id, id)).limit(1);
        if (ch) [condominioId, organizacaoId, descricao] = [ch.condominioId, ch.organizacaoId, `o chamado nº ${ch.numero}`];
      } else {
        const { duvidas } = await import("@/db/schema");
        const [d] = await db.select().from(duvidas).where(eq(duvidas.id, id)).limit(1);
        if (d) [condominioId, organizacaoId, descricao] = [d.condominioId, d.organizacaoId, `a dúvida "${d.pergunta.slice(0, 120)}"`];
      }
      const m = condominioId ? await vinculoNoCondominio(ctx.chatId, condominioId, ["morador", "funcionario"]) : null;
      if (!m || !condominioId) return recusarBotao(ctx);
      const [ja] = await db.select().from(contatosSindico).where(and(eq(contatosSindico.origemId, id), isNull(contatosSindico.assumidoEm))).limit(1);
      if (!ja) {
        await db.insert(contatosSindico).values({ organizacaoId, condominioId, pessoaId: m.id, origemTipo: tipo === "c" ? "chamado" : "duvida", origemId: id });
        if (tipo === "d") {
          const { pedirSindico } = await import("@/features/duvidas/servico");
          await pedirSindico({ organizacaoId, duvidaId: id });
        } else await avisarSindicos(organizacaoId, condominioId, `Um morador pediu para falar com você sobre ${descricao}.`, `falar-sindico:${id}`);
      }
      await ctx.responderBotao("Pedido enviado ao síndico.");
      await responderComo(ctx, m, "Pronto: o síndico foi avisado e vai falar com você.");
    },
  });

  /* Funcionário: /ocorrencia (livro de ocorrências como chamado de natureza "ocorrência"). */
  roteador.registrarComando({
    nome: "ocorrencia",
    descricao: "Registrar uma ocorrência (barulho, portão aberto, objeto na vaga…)",
    permissao: ["funcionario"],
    async executar(ctx) {
      await definirEstado(ctx.chatId, ctx.pessoa!.id, "ocorrencia");
      await ctx.responder("Descreva a ocorrência (pode mandar uma foto com legenda). Não identifique moradores pelo nome; o registro fica só com o síndico.");
    },
  });

  roteador.registrarEstado("ocorrencia", async (ctx) => {
    const texto = ctx.texto ?? ctx.mensagem?.caption;
    if (!texto) return false;
    const a = ctx.mensagem?.photo?.length || ctx.mensagem?.document ? await obterArquivoDaMensagem(ctx) : null;
    await limparEstado(ctx.chatId);
    const n = normalizar(texto);
    const natureza = /barulh|som|music|festa|grit/.test(n) ? "barulho" : /vaga|carro|moto|garag/.test(n) ? "garagem" : /cachorr|gato|animal|pet/.test(n) ? "animais" : /vazament|agua|infiltr/.test(n) ? "vazamento" : /portao|porta|seguranc|estranh/.test(n) ? "seguranca" : /hall|elevador|escada|piscina|salao|lampada/.test(n) ? "area_comum" : "outra";
    const r = await abrirChamado({
      organizacaoId: ctx.pessoa!.organizacaoId,
      condominioId: ctx.pessoa!.condominioId,
      origem: "funcionario",
      natureza: "ocorrencia",
      descricao: texto,
      abertoPorPessoaId: ctx.pessoa!.id,
      autorRotulo: ctx.pessoa!.nome,
      categoria: natureza as CategoriaChamado,
      categoriaOrigem: "botao",
      arquivoIds: a ? [a.id] : undefined,
      usarIa: false,
      saida: ctx.saida,
    });
    await ctx.responder(`Ocorrência nº ${r.chamado.numero} registrada (${ROTULO_CATEGORIA[natureza] ?? natureza}). O síndico vê no painel.`);
    return true;
  });

  /* Morador: o que ele escreveu sem comando (do texto livre) vira chamado. */
  roteador.registrarAcao({
    prefixo: "lv",
    permissao: ["morador"],
    async executar(ctx, tipo) {
      const e = ctx.estado;
      const texto = e?.aguardando === "tipo_mensagem_livre" ? String(e.dados?.texto ?? "") : "";
      if (!texto) {
        await ctx.responderBotao("Escreva de novo, por favor.");
        return;
      }
      await limparEstado(ctx.chatId);
      await ctx.responderBotao();
      if (tipo === "p") return seguirComDescricao(ctx, texto, null);
      const { responderDuvidaNoBot } = await import("./morador");
      await responderDuvidaNoBot(ctx, texto);
    },
  });

  void desc;
}

/** Abre o chamado de um arquivo (ou álbum) com legenda: usado pelo tratador de arquivos sem estado. */
export async function abrirChamadoComArquivos(ctx: ContextoBot, descricao: string, arquivoIds: string[]) {
  const r = await abrirPeloBot(ctx, descricao, { arquivoIds });
  if (r.emergencia) {
    await ctx.responder(await mensagemEmergenciaDoCondominio(ctx.pessoa!.condominioId, r.chamado.emergenciaGrupo as "fogo_gas"));
    await ctx.responder(`Chamado de emergência nº ${r.chamado.numero} aberto.`);
    return r;
  }
  await responderAbertura(ctx, r);
  await ctx.responder(`${arquivoIds.length} foto(s) no chamado nº ${r.chamado.numero}.`);
  return r;
}
