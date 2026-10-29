import { BRAND } from "@/lib/brand";
import { ROTULO_PAPEL, mensagemSemVinculo, type Roteador, type ContextoBot } from "../roteador";
import { MENSAGEM_RECUSA, desvincularChat, resgatarConvite, trocarContexto, vinculosDoChat } from "../vinculo";
import { tecladoContexto } from "../roteador";
import { atualizarMenuDoChat } from "../menu";
import { termoDoConvite } from "@/lib/negocio/termo";
import { db } from "@/db";
import { mudancas, pessoas } from "@/db/schema";
import { eq } from "drizzle-orm";
import { hojeISO } from "@/lib/negocio/datas";

/** Comandos que todo papel tem: /start, /ajuda, /eu e /sair. */

function listaDeComandos(roteador: Roteador, ctx: ContextoBot): string {
  return roteador
    .comandosDisponiveis(ctx.pessoa)
    .map((c) => `/${c.nome} – ${c.descricao}`)
    .join("\n");
}

export function registrarComandosBase(roteador: Roteador) {
  roteador.registrarComando({
    nome: "start",
    descricao: "Começar ou vincular com um código de convite",
    permissao: "publico",
    oculto: true,
    async executar(ctx) {
      const codigo = ctx.args.split(/\s+/)[0] ?? "";
      if (!codigo) {
        if (ctx.pessoa) {
          await ctx.responder(
            `Olá, ${ctx.pessoa.nome}! Você já está conectado(a) como ${ROTULO_PAPEL[ctx.pessoa.papel].toLowerCase()} do ${ctx.pessoa.condominioNome}.\n\nEnvie /ajuda para ver o que posso fazer.`,
          );
        } else {
          await ctx.responder(mensagemSemVinculo());
        }
        return;
      }
      const r = await resgatarConvite({
        codigo,
        chatId: ctx.chatId,
        telegramUserId: ctx.de.id,
        username: ctx.de.username ?? null,
        nomeTelegram: [ctx.de.first_name, ctx.de.last_name].filter(Boolean).join(" ") || null,
      });
      if (!r.ok) {
        await ctx.responder(MENSAGEM_RECUSA[r.motivo]);
        return;
      }
      ctx.pessoa = r.pessoa;
      await atualizarMenuDoChat(roteador, ctx.chatId, r.pessoa);
      const unidade = r.pessoa.unidade ? ` (unidade ${r.pessoa.unidade})` : "";
      await ctx.responder(
        [
          `Pronto, ${r.pessoa.nome}! Seu Telegram está conectado ao ${BRAND.nome}.`,
          `Condomínio: ${r.pessoa.condominioNome}${unidade}`,
          `Perfil: ${ROTULO_PAPEL[r.pessoa.papel]}`,
          "",
          "O que você pode fazer por aqui:",
          listaDeComandos(roteador, ctx),
          "",
          "Para desconectar a qualquer momento, envie /sair.",
          (r.pessoa.vinculos ?? 1) > 1 ? "Este Telegram tem mais de um vínculo: use /condominio para trocar." : null,
        ]
          .filter((x) => x !== null)
          .join("\n"),
      );
      const [cad] = await db.select().from(pessoas).where(eq(pessoas.id, r.pessoa.id)).limit(1);
      await ctx.responder(termoDoConvite(cad), { teclado: [[{ text: "Entendi", callback_data: `tm:${r.pessoa.id}` }]] });
    },
  });

  roteador.registrarComando({
    nome: "ajuda",
    descricao: "Ver os comandos disponíveis",
    permissao: "publico",
    async executar(ctx) {
      if (!ctx.pessoa) {
        await ctx.responder(mensagemSemVinculo());
        return;
      }
      await ctx.responder(
        [`Comandos para ${ROTULO_PAPEL[ctx.pessoa.papel].toLowerCase()}:`, "", listaDeComandos(roteador, ctx)].join("\n"),
      );
    },
  });

  roteador.registrarComando({
    nome: "eu",
    descricao: "Ver com qual cadastro este Telegram está conectado",
    permissao: "vinculado",
    async executar(ctx) {
      const p = ctx.pessoa!;
      // Só os dados da própria pessoa: o bot nunca mostra dados de outro morador.
      await ctx.responder(
        [
          `Nome: ${p.nome}`,
          `Perfil: ${ROTULO_PAPEL[p.papel]}`,
          `Condomínio: ${p.condominioNome}`,
          p.unidade ? `Unidade: ${p.unidade}` : null,
        ]
          .filter(Boolean)
          .join("\n"),
      );
    },
  });

  roteador.registrarComando({
    nome: "condominio",
    descricao: "Trocar o condomínio desta conversa",
    permissao: "publico",
    async executar(ctx) {
      const opcoes = await vinculosDoChat(ctx.chatId);
      if (opcoes.length === 0) {
        await ctx.responder(mensagemSemVinculo());
        return;
      }
      if (opcoes.length === 1) {
        await ctx.responder(`Este Telegram está ligado só ao ${opcoes[0].condominioNome}.`);
        return;
      }
      const atual = ctx.pessoa ? `Agora: ${ctx.pessoa.condominioNome} · ${ROTULO_PAPEL[ctx.pessoa.papel]}.\n\n` : "";
      await ctx.responder(`${atual}Escolha o condomínio:`, { teclado: tecladoContexto(opcoes) });
    },
  });

  roteador.definirTrocaDeContexto(async (ctx, pessoa) => {
    const p = await trocarContexto(ctx.chatId, pessoa.id);
    if (p) await atualizarMenuDoChat(roteador, ctx.chatId, p);
    return p;
  });

  roteador.registrarAcao({
    prefixo: "ctx",
    permissao: "publico",
    async executar(ctx, dados) {
      const p = await trocarContexto(ctx.chatId, dados);
      if (!p) {
        await ctx.responderBotao("Esse vínculo não existe mais.");
        return;
      }
      ctx.pessoa = p;
      await atualizarMenuDoChat(roteador, ctx.chatId, p);
      await ctx.responderBotao(p.condominioNome);
      await ctx.responder(`Pronto: agora você está no ${p.condominioNome}. Envie /ajuda para ver os comandos.`);
    },
  });

  roteador.registrarAcao({
    prefixo: "tm",
    permissao: "publico",
    async executar(ctx, pessoaId) {
      const meus = await vinculosDoChat(ctx.chatId);
      if (!meus.some((v) => v.id === pessoaId)) return;
      await db.update(pessoas).set({ aceitouTermoEm: new Date() }).where(eq(pessoas.id, pessoaId));
      await ctx.responderBotao("Obrigado!");
    },
  });

  roteador.registrarComando({
    nome: "sair",
    descricao: "Desconectar este Telegram do condomínio",
    permissao: "vinculado",
    async executar(ctx) {
      await ctx.responder("Quer mesmo desconectar este Telegram? Você deixa de receber os avisos do condomínio.", {
        teclado: [
          [
            { text: "Sim, desconectar", callback_data: "sair:sim" },
            { text: "Cancelar", callback_data: "sair:nao" },
          ],
        ],
      });
    },
  });

  roteador.registrarAcao({
    prefixo: "sair",
    permissao: "vinculado",
    async executar(ctx, dados) {
      const msg = ctx.callback?.message;
      if (dados === "sim") {
        // Morador que sai pelo bot: vira o pedido "confirmar mudança" para o síndico.
        const atual = ctx.pessoa;
        if (atual?.papel === "morador") {
          const [cad] = await db.select().from(pessoas).where(eq(pessoas.id, atual.id)).limit(1);
          if (cad?.unidadeId) await db.insert(mudancas).values({ organizacaoId: atual.organizacaoId, condominioId: atual.condominioId, unidadeId: cad.unidadeId, tipo: "saida", data: hojeISO(), pessoaIds: [atual.id], origem: "bot", estado: "pedida", registradaPorRotulo: atual.nome });
        }
        await desvincularChat(ctx.chatId);
        await atualizarMenuDoChat(roteador, ctx.chatId, null);
        ctx.pessoa = null;
        await ctx.responderBotao("Desconectado.");
        const texto = "Pronto, este Telegram foi desconectado. Para voltar, peça um novo convite ao síndico ou à administradora.";
        if (msg) await ctx.saida.editarTexto(ctx.chatId, msg.message_id, texto);
        else await ctx.responder(texto);
        return;
      }
      await ctx.responderBotao("Cancelado.");
      if (msg) await ctx.saida.editarTexto(ctx.chatId, msg.message_id, "Tudo certo, você continua conectado(a).");
    },
  });
}
