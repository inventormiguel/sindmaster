import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { chamados, pessoas } from "@/db/schema";
import { anexarFotos } from "@/features/chamados/servico";
import { itensDoFuncionario, marcarFeito } from "@/features/rotinas/servico";
import { definirEstado, limparEstado } from "../estado";
import type { ContextoBot, Roteador } from "../roteador";
import type { TecladoInline } from "../tipos";
import { obterArquivoDaMensagem, registrarNoAlbum, reservarAlbum } from "./arquivos";
import { abrirChamadoComArquivos } from "./chamados";
import { UUID } from "./util";

/**
 * Foto ou documento SEM estado de conversa: "Isso é de qual tarefa ou chamado?" (T-CE-01).
 * Álbum: só o primeiro update responde, uma vez, com todos os arquivos (T-CE-02).
 * Morador com legenda: a legenda vira a descrição do chamado.
 */
export function registrarDestinoArquivo(roteador: Roteador) {
  roteador.registrarArquivo(
    async (ctx) => {
      const a = await obterArquivoDaMensagem(ctx);
      if (!a) return true;
      const alb = await registrarNoAlbum(ctx, a.id);
      if (!alb.primeiro) return true;
      const album = alb.grupo ? await reservarAlbum(alb.grupo) : null;
      if (alb.grupo && !album) return true;
      const ids = album ? album.arquivoIds : [a.id];
      const legenda = (album ? album.legenda : ctx.mensagem?.caption)?.trim() ?? "";
      const p = ctx.pessoa!;
      if ((p.papel === "morador" || p.papel === "funcionario") && legenda.length >= 5 && p.papel === "morador") {
        await abrirChamadoComArquivos(ctx, legenda, ids.slice(0, 4));
        return true;
      }
      await definirEstado(ctx.chatId, p.id, "destino_arquivo", { dados: { arquivoIds: ids } });
      const teclado: TecladoInline = [];
      if (p.papel === "funcionario") {
        const [eu] = await db.select({ posto: pessoas.posto }).from(pessoas).where(eq(pessoas.id, p.id)).limit(1);
        const itens = (await itensDoFuncionario({ pessoaId: p.id, condominioId: p.condominioId, posto: eu?.posto ?? null })).filter((i) => i.item.estado === "previsto" && i.modelo.fotoObrigatoria);
        for (const i of itens.slice(0, 4)) teclado.push([{ text: `Tarefa: ${i.modelo.item}`.slice(0, 60), callback_data: `fd:r:${i.item.id}` }]);
      }
      if (p.papel === "morador" || p.papel === "funcionario") {
        const abertos = await db
          .select()
          .from(chamados)
          .where(and(eq(chamados.abertoPorPessoaId, p.id), inArray(chamados.estado, ["novo", "com_responsavel", "aguardando_prestador", "agendado"])))
          .limit(3);
        for (const c of abertos) teclado.push([{ text: `Chamado nº ${c.numero}`, callback_data: `fd:c:${c.id}` }]);
        teclado.push([{ text: "Novo chamado", callback_data: "fd:n" }]);
      }
      if (p.papel === "sindico") teclado.push([{ text: "É recibo, nota ou boleto", callback_data: "fd:x" }]);
      if (p.papel === "prestador") teclado.push([{ text: "É certidão ou apólice", callback_data: "fd:p" }]);
      teclado.push([{ text: "Outro assunto", callback_data: "fd:o" }]);
      await ctx.responder(`Recebi ${ids.length > 1 ? `${ids.length} arquivos` : "o arquivo"}. Isso é de qual tarefa ou chamado?`, { teclado });
      return true;
    },
    { prioridade: "inicio" },
  );

  roteador.registrarAcao({
    prefixo: "fd",
    permissao: "vinculado",
    async executar(ctx: ContextoBot, dados) {
      const e = ctx.estado;
      const ids = e?.aguardando === "destino_arquivo" ? ((e.dados?.arquivoIds as string[]) ?? []) : [];
      if (ids.length === 0) {
        await ctx.responderBotao("Mande o arquivo de novo, por favor.");
        return;
      }
      const [tipo, id] = dados.split(":");
      const p = ctx.pessoa!;
      await limparEstado(ctx.chatId);
      await ctx.responderBotao();
      if (tipo === "r" && UUID.test(id ?? "")) {
        try {
          await marcarFeito({ organizacaoId: p.organizacaoId, itemId: id, pessoaId: p.id, arquivoId: ids[0] });
          await ctx.responder("Tarefa registrada como feita, com a foto.");
        } catch (er) {
          await ctx.responder(er instanceof Error ? er.message : "Não consegui registrar.");
        }
      } else if (tipo === "c" && UUID.test(id ?? "")) {
        const [ch] = await db.select().from(chamados).where(and(eq(chamados.id, id), eq(chamados.abertoPorPessoaId, p.id))).limit(1);
        if (!ch) return;
        await anexarFotos({ organizacaoId: p.organizacaoId, chamadoId: ch.id, arquivoIds: ids.slice(0, 4), autorRotulo: p.nome, autorPessoaId: p.id });
        await ctx.responder(`Anexado ao chamado nº ${ch.numero}.`);
      } else if (tipo === "n") {
        await definirEstado(ctx.chatId, p.id, "descricao_chamado", { dados: { arquivoIds: ids } });
        await ctx.responder("Descreva o problema em uma mensagem.");
      } else if (tipo === "x" && p.papel === "sindico") {
        const { criarDespesaDeArquivo, resumoDespesa } = await import("@/features/despesas/servico");
        const r = await criarDespesaDeArquivo({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, arquivoId: ids[0], quem: p.nome });
        await ctx.responder(`${r.erroIa ? `${r.erroIa}\n` : "Lido pela IA, não conferido.\n"}${resumoDespesa(r.despesa)}\nConfira em /aprovar ou no painel.`);
      } else if (tipo === "p" && p.papel === "prestador") {
        await ctx.responder("Envie /certidao e mande o arquivo de novo, por favor.");
      } else {
        await ctx.responder("Certo. O arquivo ficou guardado para a administração do condomínio.");
      }
    },
  });
}
