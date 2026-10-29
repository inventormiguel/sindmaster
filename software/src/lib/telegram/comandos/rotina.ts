import { eq } from "drizzle-orm";
import { db } from "@/db";
import { pessoas, rotinaItens } from "@/db/schema";
import { gerarItensDoDia, itensDoFuncionario, marcarFeito, marcarNaoFeito, podeMarcar, ROTULO_PERIODO } from "@/features/rotinas/servico";
import { fraseTarefaNaoJornada } from "@/lib/negocio/linguagem";
import { BRAND } from "@/lib/brand";
import { definirEstado, limparEstado } from "../estado";
import type { ContextoBot, Roteador } from "../roteador";
import { obterArquivoDaMensagem } from "./arquivos";
import { recusarBotao, responderComo, UUID, vinculoNoCondominio } from "./util";

async function posto(pessoaId: string) {
  const [p] = await db.select({ posto: pessoas.posto }).from(pessoas).where(eq(pessoas.id, pessoaId)).limit(1);
  return p?.posto ?? null;
}

/** Rotina: tarefa feita (com foto quando pedir) ou "Não deu" com motivo. Nunca entrada, saída ou horas. */
export function registrarRotina(roteador: Roteador) {
  roteador.registrarComando({
    nome: "rotina",
    descricao: "Tarefas de hoje: \"Feito\" (com foto quando pedir) ou \"Não deu\"",
    permissao: ["funcionario"],
    async executar(ctx) {
      const p = ctx.pessoa!;
      await gerarItensDoDia(p.organizacaoId, p.condominioId);
      const itens = await itensDoFuncionario({ pessoaId: p.id, condominioId: p.condominioId, posto: await posto(p.id) });
      if (itens.length === 0) {
        await ctx.responder("Nenhuma tarefa para hoje.");
        return;
      }
      const feitos = itens.filter((i) => i.item.estado !== "previsto");
      const pendentes = itens.filter((i) => i.item.estado === "previsto");
      await ctx.responder(
        `Tarefas de hoje: ${feitos.length} de ${itens.length} registradas.${feitos.length ? `\n${feitos.map((i) => `• ${i.modelo.item}: ${i.item.estado === "feito" ? "feito" : "não deu"}`).join("\n")}` : ""}\n\n${fraseTarefaNaoJornada(BRAND.nome)}`,
      );
      for (let k = 0; k < pendentes.length; k += 4) {
        const bloco = pendentes.slice(k, k + 4);
        await ctx.responder(bloco.map((i) => `• ${ROTULO_PERIODO[i.modelo.periodoRotulo]}: ${i.modelo.item}${i.modelo.fotoObrigatoria ? " (foto)" : ""}${i.modelo.instrucao ? `\n  ${i.modelo.instrucao}` : ""}`).join("\n"), {
          teclado: bloco.map((i) => [
            { text: `Feito: ${i.modelo.item}`.slice(0, 40), callback_data: `rt:f:${i.item.id}` },
            { text: "Não deu", callback_data: `rt:n:${i.item.id}` },
          ]),
        });
      }
    },
  });

  roteador.registrarAcao({
    prefixo: "rt",
    permissao: "publico",
    async executar(ctx, dados) {
      const [tipo, id] = dados.split(":");
      if (!UUID.test(id ?? "")) return;
      const [it] = await db.select().from(rotinaItens).where(eq(rotinaItens.id, id)).limit(1);
      const f = it && (await vinculoNoCondominio(ctx.chatId, it.condominioId, ["funcionario"]));
      const ok = f && (await podeMarcar({ itemId: id, organizacaoId: f.organizacaoId, pessoaId: f.id, posto: await posto(f.id) }));
      if (!it || !f || !ok) return recusarBotao(ctx, "Esta tarefa não é sua.");
      if (it.estado !== "previsto") return ctx.responderBotao("Esta tarefa já foi registrada.");
      if (tipo === "f") {
        if (ok.modelo.fotoObrigatoria) {
          await definirEstado(ctx.chatId, f.id, "foto_rotina", { refId: id });
          await ctx.responderBotao();
          await responderComo(ctx, f, `Mande a foto de "${ok.modelo.item}".`);
          return;
        }
        await marcarFeito({ organizacaoId: f.organizacaoId, itemId: id, pessoaId: f.id });
        await ctx.responderBotao("Feito!");
        return;
      }
      await definirEstado(ctx.chatId, f.id, "motivo_rotina", { refId: id });
      await ctx.responderBotao();
      await responderComo(ctx, f, `Por que não deu para fazer "${ok.modelo.item}"? (vira pendência do item para o síndico)`);
    },
  });

  roteador.registrarEstado("foto_rotina", async (ctx: ContextoBot) => {
    const e = ctx.estado!;
    if (!ctx.mensagem?.photo?.length && !ctx.mensagem?.document) {
      await ctx.responder("Mande a foto da tarefa (ou envie /rotina para voltar à lista).");
      return true;
    }
    const a = await obterArquivoDaMensagem(ctx);
    if (!a || !e.refId) return true;
    await marcarFeito({ organizacaoId: ctx.pessoa!.organizacaoId, itemId: e.refId, pessoaId: ctx.pessoa!.id, arquivoId: a.id });
    await limparEstado(ctx.chatId);
    await ctx.responder("Tarefa registrada como feita, com a foto. Obrigado!");
    return true;
  });

  roteador.registrarEstado("motivo_rotina", async (ctx) => {
    const e = ctx.estado!;
    if (!ctx.texto || !e.refId) return false;
    await marcarNaoFeito({ organizacaoId: ctx.pessoa!.organizacaoId, itemId: e.refId, pessoaId: ctx.pessoa!.id, motivo: ctx.texto });
    await limparEstado(ctx.chatId);
    await ctx.responder("Registrado. O síndico vê a pendência do item.");
    return true;
  });
}
