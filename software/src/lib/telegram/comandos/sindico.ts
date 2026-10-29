import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { db } from "@/db";
import { alertas, contatosSindico, despesas, duvidas, mudancas, pessoas, prestadorDocumentos, prestadores, servicosRegistrados, vencimentos } from "@/db/schema";
import { montarResumoDiario } from "@/features/resumos/servico";
import { conferirELancar, criarDespesaDeArquivo, recusarDespesa, resumoDespesa } from "@/features/despesas/servico";
import { enviarRespostaConferida, montarMensagemResposta } from "@/features/duvidas/servico";
import { conferirDocumento, prestadoresDoCondominio, recusarDocumento, ROTULO_DOC } from "@/features/prestadores/servico";
import { conferirServico, recusarServico, situacaoVencimento } from "@/features/vencimentos/servico";
import { numerosHoje } from "@/features/carteira/consultas";
import { dataBR } from "@/lib/negocio/datas";
import { iaDisponivel } from "@/lib/ia/funcoes";
import { enfileirarAvisoPessoa } from "../avisos";
import { agendarEnvioDaFila } from "@/lib/negocio/fila";
import { definirEstado, limparEstado } from "../estado";
import type { ContextoBot, Roteador } from "../roteador";
import { obterArquivoDaMensagem } from "./arquivos";
import { botaoPainel, recusarBotao, responderComo, UUID, vinculoNoCondominio } from "./util";

/** Comandos do síndico: /hoje, /aprovar, /pendencias, /recibo (+ /condominio da base). */
export function registrarSindico(roteador: Roteador) {
  roteador.registrarComando({
    nome: "hoje",
    descricao: "Resumo do condomínio atual (vencimentos, chamados, dúvidas, itens para conferir)",
    permissao: ["sindico"],
    async executar(ctx) {
      const p = ctx.pessoa!;
      const r = await montarResumoDiario(p.organizacaoId, p.condominioId);
      await ctx.responder(r.texto, {
        teclado: [
          [
            { text: "Vencimentos", callback_data: `hj:v:${p.condominioId}` },
            { text: "Prestadores", callback_data: `hj:p:${p.condominioId}` },
          ],
          botaoPainel("Abrir no painel", "/app/hoje", p.condominioId),
        ],
      });
    },
  });

  roteador.registrarAcao({
    prefixo: "hj",
    permissao: "publico",
    async executar(ctx, dados) {
      const [tipo, condId] = dados.split(":");
      if (!UUID.test(condId ?? "")) return;
      const p = await vinculoNoCondominio(ctx.chatId, condId, ["sindico"]);
      if (!p) return recusarBotao(ctx);
      if (tipo === "v") {
        const vs = await db.select().from(vencimentos).where(and(eq(vencimentos.condominioId, condId), eq(vencimentos.estadoConferencia, "ativo"))).orderBy(asc(vencimentos.proximo));
        const linhas = vs.slice(0, 12).map((v) => `• ${v.nome}: ${situacaoVencimento(v.proximo).texto.toLowerCase()}${v.proximo ? ` (${dataBR(v.proximo)})` : ""}`);
        await responderComo(ctx, p, `Vencimentos ativos (prazo cadastrado e conferido):\n${linhas.join("\n") || "nenhum"}`, [botaoPainel("Abrir vencimentos", "/app/vencimentos", condId)]);
      } else {
        const ps = await prestadoresDoCondominio(p.organizacaoId, condId);
        const com = ps.filter((x) => !x.situacao.emDia || x.situacao.vencendo.length);
        if (com.length === 0) {
          await responderComo(ctx, p, "Todos os prestadores com documentos em dia.");
          return;
        }
        for (const x of com.slice(0, 6)) {
          const t = [...x.situacao.vencidos.map((d) => `${ROTULO_DOC[d.tipo]} vencida desde ${dataBR(d.validade)}`), ...x.situacao.vencendo.map((d) => `${ROTULO_DOC[d.tipo]} vence em ${dataBR(d.validade)}`)].join("; ");
          await responderComo(ctx, p, `${x.razaoSocial}: ${t}`, [[{ text: "Pedir documento", callback_data: `pd:${x.id}` }]]);
        }
      }
    },
  });

  roteador.registrarAcao({
    prefixo: "pd",
    permissao: "publico",
    async executar(ctx, prestadorId) {
      if (!UUID.test(prestadorId)) return;
      const contatos = await db.select().from(pessoas).where(and(eq(pessoas.prestadorId, prestadorId), isNull(pessoas.removidaEm)));
      const [pr] = await db.select().from(prestadores).where(eq(prestadores.id, prestadorId)).limit(1);
      for (const c of contatos) {
        const s = await vinculoNoCondominio(ctx.chatId, c.condominioId, ["sindico"]);
        if (!s) continue;
        await enfileirarAvisoPessoa({ organizacaoId: c.organizacaoId, pessoaId: c.id, categoria: "pedido_documento", texto: `O condomínio pediu a certidão ou apólice atualizada. Envie por aqui com /certidao (PDF ou foto).`, chaveIdempotencia: `pedido-doc:${prestadorId}:${c.id}:${new Date().toISOString().slice(0, 10)}` });
        agendarEnvioDaFila(c.organizacaoId);
        await ctx.responderBotao("Pedido enviado.");
        await responderComo(ctx, s, `Pedido de documento enviado para ${pr?.razaoSocial ?? "o prestador"}.`);
        return;
      }
      await recusarBotao(ctx);
    },
  });

  /* ------------------------------ /aprovar ------------------------------ */
  roteador.registrarComando({
    nome: "aprovar",
    descricao: "Itens para conferir e aprovar: respostas da IA, recibos, certidões",
    permissao: ["sindico"],
    async executar(ctx) {
      const p = ctx.pessoa!;
      const cond = p.condominioId;
      let n = 0;
      const dvs = await db.select().from(duvidas).where(and(eq(duvidas.condominioId, cond), eq(duvidas.estado, "aguardando_envio"))).limit(5);
      for (const d of dvs) {
        n++;
        await ctx.responder(`Dúvida de morador: "${d.pergunta}"\n\nResposta proposta:\n${montarMensagemResposta({ resposta: d.resposta ?? "", citacoes: d.citacoes ?? [] })}`, {
          teclado: [
            [
              { text: "Enviar", callback_data: `ap:d:${d.id}` },
              { text: "Responder eu mesmo", callback_data: `rs:d:${d.id}` },
            ],
            botaoPainel("Editar no painel", "/app/duvidas", cond),
          ],
        });
      }
      const ds = await db.select().from(despesas).where(and(eq(despesas.condominioId, cond), inArray(despesas.estado, ["para_conferir", "bloqueada"]))).limit(5);
      for (const d of ds) {
        n++;
        const botoes = d.estado === "bloqueada" ? [] : d.linhaDigitavel ? [{ text: "Conferi o beneficiário no app do banco", callback_data: `bf:${d.id}` }] : [{ text: "Conferir e lançar", callback_data: `cf:x:${d.id}` }];
        await ctx.responder(`${d.estado === "bloqueada" ? "Bloqueada pela conferência do código" : "Para conferir"}: ${resumoDespesa(d)}`, {
          teclado: [[...botoes, { text: "Recusar", callback_data: `rc:x:${d.id}` }], botaoPainel("Conferir no painel", "/app/despesas", cond)],
        });
      }
      const docs = await db
        .select({ d: prestadorDocumentos, nome: prestadores.razaoSocial })
        .from(prestadorDocumentos)
        .innerJoin(prestadores, eq(prestadores.id, prestadorDocumentos.prestadorId))
        .innerJoin(pessoas, and(eq(pessoas.prestadorId, prestadores.id), eq(pessoas.condominioId, cond)))
        .where(eq(prestadorDocumentos.estado, "para_conferir"))
        .limit(5);
      const vistos = new Set<string>();
      for (const { d, nome } of docs) {
        if (vistos.has(d.id)) continue;
        vistos.add(d.id);
        n++;
        await ctx.responder(`Documento de ${nome} (lido pela IA, não conferido): ${ROTULO_DOC[d.tipo]}${d.validade ? `, validade impressa ${dataBR(d.validade)}` : ", validade não lida"}${d.titularCnpj ? `, titular ${d.titularCnpj}` : ""}.`, {
          teclado: [d.validade ? [{ text: "Conferi", callback_data: `cf:p:${d.id}` }, { text: "Recusar", callback_data: `rc:p:${d.id}` }] : [{ text: "Recusar", callback_data: `rc:p:${d.id}` }], botaoPainel("Conferir no painel", "/app/prestadores", cond)],
        });
      }
      const servs = await db
        .select({ s: servicosRegistrados, nome: vencimentos.nome })
        .from(servicosRegistrados)
        .innerJoin(vencimentos, eq(vencimentos.id, servicosRegistrados.vencimentoId))
        .where(and(eq(servicosRegistrados.condominioId, cond), eq(servicosRegistrados.estado, "para_conferir")))
        .limit(5);
      for (const { s, nome } of servs) {
        n++;
        await ctx.responder(`Comprovante de serviço (lido pela IA, não conferido): ${nome}. Data do serviço: ${dataBR(s.dataServico)}${s.validadeImpressa ? `; validade impressa ${dataBR(s.validadeImpressa)}` : ""}. Conferido, o vencimento é recalculado.`, {
          teclado: [s.dataServico || s.validadeImpressa ? [{ text: "Conferi", callback_data: `cf:s:${s.id}` }, { text: "Recusar", callback_data: `rc:s:${s.id}` }] : [{ text: "Recusar", callback_data: `rc:s:${s.id}` }], botaoPainel("Conferir no painel", "/app/vencimentos", cond)],
        });
      }
      const mus = await db.select().from(mudancas).where(and(eq(mudancas.condominioId, cond), eq(mudancas.estado, "pedida"))).limit(3);
      for (const m of mus) {
        n++;
        await ctx.responder(`Pedido de mudança pelo bot (saída em ${dataBR(m.data)}). Confirme no painel.`, { teclado: [botaoPainel("Abrir a unidade", `/app/unidades/${m.unidadeId}`, cond)] });
      }
      if (n === 0) await ctx.responder("Nada para conferir ou aprovar agora.");
    },
  });

  const seSindico = async (ctx: ContextoBot, condominioId: string) => vinculoNoCondominio(ctx.chatId, condominioId, ["sindico"]);

  roteador.registrarAcao({
    prefixo: "ap",
    permissao: "publico",
    async executar(ctx, dados) {
      const [tipo, id] = dados.split(":");
      if (!UUID.test(id ?? "")) return;
      if (tipo === "d") {
        const [d] = await db.select().from(duvidas).where(eq(duvidas.id, id)).limit(1);
        const s = d && (await seSindico(ctx, d.condominioId));
        if (!d || !s) return recusarBotao(ctx);
        try {
          await enviarRespostaConferida({ organizacaoId: d.organizacaoId, duvidaId: d.id, quem: s.nome });
          await ctx.responderBotao("Resposta enviada ao morador.");
        } catch (e) {
          await ctx.responderBotao(e instanceof Error ? e.message.slice(0, 190) : "Não deu.");
        }

      }
    },
  });

  roteador.registrarAcao({
    prefixo: "rs",
    permissao: "publico",
    async executar(ctx, dados) {
      const id = dados.split(":")[1];
      if (!UUID.test(id ?? "")) return;
      const [d] = await db.select().from(duvidas).where(eq(duvidas.id, id)).limit(1);
      const s = d && (await seSindico(ctx, d.condominioId));
      if (!d || !s) return recusarBotao(ctx);
      await definirEstado(ctx.chatId, s.id, "resposta_sindico", { refId: d.id });
      await ctx.responderBotao();
      await responderComo(ctx, s, `Escreva a sua resposta para: "${d.pergunta}"`);
    },
  });

  roteador.registrarEstado("resposta_sindico", async (ctx) => {
    if (!ctx.texto || !ctx.estado?.refId) return false;
    const { responderPeloSindico } = await import("@/features/duvidas/servico");
    try {
      await responderPeloSindico({ organizacaoId: ctx.pessoa!.organizacaoId, duvidaId: ctx.estado.refId, quem: ctx.pessoa!.nome, resposta: ctx.texto, salvarComoResposta: false });
      await limparEstado(ctx.chatId);
      await ctx.responder('Resposta enviada ao morador. Para salvá-la como "resposta do condomínio", use o painel (Dúvidas).');
    } catch (e) {
      await ctx.responder(e instanceof Error ? e.message : "Não consegui enviar.");
    }
    return true;
  });

  const conferirDespesaBotao = async (ctx: ContextoBot, id: string, beneficiario: boolean) => {
    const [d] = await db.select().from(despesas).where(eq(despesas.id, id)).limit(1);
    const s = d && (await seSindico(ctx, d.condominioId));
    if (!d || !s) return recusarBotao(ctx);
    try {
      const r = await conferirELancar({ organizacaoId: d.organizacaoId, despesaId: d.id, quem: s.nome, beneficiarioConferido: beneficiario });
      await ctx.responderBotao(r.estado === "lancada" ? "Conferida e lançada." : "Conferida; aguardando aprovação (acima da alçada).");
    } catch (e) {
      await ctx.responderBotao(e instanceof Error ? e.message.slice(0, 190) : "Não deu.");
    }
  };
  roteador.registrarAcao({
    prefixo: "bf",
    permissao: "publico",
    async executar(ctx, id) {
      if (UUID.test(id)) await conferirDespesaBotao(ctx, id, true);
    },
  });

  roteador.registrarAcao({
    prefixo: "cf",
    permissao: "publico",
    async executar(ctx, dados) {
      const [tipo, id] = dados.split(":");
      if (!UUID.test(id ?? "")) return;
      if (tipo === "x") return conferirDespesaBotao(ctx, id, false);
      if (tipo === "p") {
        const [d] = await db.select().from(prestadorDocumentos).where(eq(prestadorDocumentos.id, id)).limit(1);
        const contato = d ? (await db.select().from(pessoas).where(eq(pessoas.prestadorId, d.prestadorId))) : [];
        let s = null;
        for (const c of contato) s = s ?? (await seSindico(ctx, c.condominioId));
        if (!d || !s) return recusarBotao(ctx);
        try {
          await conferirDocumento({ organizacaoId: d.organizacaoId, documentoId: d.id, quem: s.nome });
          await ctx.responderBotao("Documento conferido.");
        } catch (e) {
          await ctx.responderBotao(e instanceof Error ? e.message.slice(0, 190) : "Não deu.");
        }
      }
      if (tipo === "s") {
        const [r] = await db.select().from(servicosRegistrados).where(eq(servicosRegistrados.id, id)).limit(1);
        const s = r && (await seSindico(ctx, r.condominioId));
        if (!r || !s) return recusarBotao(ctx);
        try {
          const x = await conferirServico({ organizacaoId: r.organizacaoId, registroId: r.id, quem: s.nome });
          await ctx.responderBotao("Conferido.");
          await responderComo(ctx, s, `Comprovante conferido. Próximo vencimento: ${dataBR(x.proximo)} (${x.dentro === false ? "serviço feito fora do prazo cadastrado" : "dentro do prazo cadastrado"}).`);
        } catch (e) {
          await ctx.responderBotao(e instanceof Error ? e.message.slice(0, 190) : "Não deu.");
        }
      }
    },
  });

  roteador.registrarAcao({
    prefixo: "rc",
    permissao: "publico",
    async executar(ctx, dados) {
      const [tipo, id] = dados.split(":");
      if (!UUID.test(id ?? "")) return;
      if (tipo === "x") {
        const [d] = await db.select().from(despesas).where(eq(despesas.id, id)).limit(1);
        const s = d && (await seSindico(ctx, d.condominioId));
        if (!d || !s) return recusarBotao(ctx);
        await recusarDespesa({ organizacaoId: d.organizacaoId, despesaId: d.id, quem: s.nome, motivo: "recusada pelo síndico no Telegram" }).catch(() => undefined);
        await ctx.responderBotao("Recusada.");
      } else if (tipo === "p") {
        const [d] = await db.select().from(prestadorDocumentos).where(eq(prestadorDocumentos.id, id)).limit(1);
        const contato = d ? await db.select().from(pessoas).where(eq(pessoas.prestadorId, d.prestadorId)) : [];
        let s = null;
        for (const c of contato) s = s ?? (await seSindico(ctx, c.condominioId));
        if (!d || !s) return recusarBotao(ctx);
        await recusarDocumento({ organizacaoId: d.organizacaoId, documentoId: d.id, quem: s.nome });
        await ctx.responderBotao("Recusado.");
      } else if (tipo === "s") {
        const [r] = await db.select().from(servicosRegistrados).where(eq(servicosRegistrados.id, id)).limit(1);
        const s = r && (await seSindico(ctx, r.condominioId));
        if (!r || !s) return recusarBotao(ctx);
        await recusarServico({ organizacaoId: r.organizacaoId, registroId: r.id, quem: s.nome });
        await ctx.responderBotao("Recusado.");
      }
    },
  });

  /* ------------------------------ /pendencias ------------------------------ */
  roteador.registrarComando({
    nome: "pendencias",
    descricao: "Dúvidas encaminhadas, pedidos para falar com você, chamados parados e alertas",
    permissao: ["sindico"],
    async executar(ctx) {
      const p = ctx.pessoa!;
      const n = await numerosHoje(p.organizacaoId, p.condominioId);
      const pedidos = await db.select().from(contatosSindico).where(and(eq(contatosSindico.condominioId, p.condominioId), isNull(contatosSindico.assumidoEm)));
      const ab = await db.select().from(alertas).where(and(eq(alertas.condominioId, p.condominioId), isNull(alertas.fechadoEm)));
      const linhas = [
        `• ${n.duvidasEsperando.length} dúvida(s) encaminhada(s) esperando você`,
        `• ${pedidos.length} pedido(s) "Falar com o síndico"`,
        `• ${n.chamadosParados.length} chamado(s) parado(s) acima do prazo da categoria`,
        `• ${n.chamadosAbertos.filter((c) => c.estado === "novo").length} chamado(s) sem responsável`,
        `• ${ab.length} alerta(s) aberto(s)`,
      ];
      await ctx.responder(`Pendências:\n${linhas.join("\n")}`, { teclado: [botaoPainel("Abrir no painel", "/app/hoje", p.condominioId)] });
    },
  });

  /* ------------------------------ /recibo ------------------------------ */
  roteador.registrarComando({
    nome: "recibo",
    descricao: "Mandar foto ou PDF de recibo, nota ou boleto para conferir",
    permissao: ["sindico"],
    async executar(ctx) {
      await definirEstado(ctx.chatId, ctx.pessoa!.id, "recibo");
      await ctx.responder(iaDisponivel() ? "Mande a foto ou o PDF do recibo, da nota ou do boleto. A IA lê os campos e eu devolvo para você conferir." : "Mande a foto ou o PDF. A IA não está conectada: a despesa entra para você preencher no painel.");
    },
  });

  roteador.registrarEstado("recibo", async (ctx) => {
    const p = ctx.pessoa!;
    if (!ctx.mensagem?.photo?.length && !ctx.mensagem?.document) {
      await ctx.responder("Mande a foto ou o PDF (ou envie outro comando para cancelar).");
      return true;
    }
    const a = await obterArquivoDaMensagem(ctx);
    if (!a) return true;
    await limparEstado(ctx.chatId);
    const r = await criarDespesaDeArquivo({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, arquivoId: a.id, quem: p.nome });
    const d = r.despesa;
    const botoes = d.estado === "bloqueada" ? [] : d.linhaDigitavel ? [{ text: "Conferi o beneficiário no app do banco", callback_data: `bf:${d.id}` }] : [{ text: "Conferir e lançar", callback_data: `cf:x:${d.id}` }];
    await ctx.responder(`${r.erroIa ? `${r.erroIa}\n` : "Lido pela IA, não conferido.\n"}${resumoDespesa(d)}`, {
      teclado: [[...botoes, { text: "Recusar", callback_data: `rc:x:${d.id}` }], botaoPainel("Conferir no painel", "/app/despesas", p.condominioId)],
    });
    return true;
  });

}
