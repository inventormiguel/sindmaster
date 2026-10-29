import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { arquivos, chamados, documentos, duvidas } from "@/db/schema";
import { receberDuvida } from "@/features/duvidas/servico";
import { documentosVisiveis } from "@/features/documentos/servico";
import { registrarLeitura } from "@/features/comunicados/servico";
import { ROTULO_ESTADO } from "@/features/chamados/servico";
import { bytesDoArquivo } from "@/lib/negocio/arquivo-ia";
import { obterArmazenamento } from "@/lib/storage";
import { definirEstado, limparEstado } from "../estado";
import { vinculosDoChat } from "../vinculo";
import type { ContextoBot, Roteador } from "../roteador";
import { UUID, vinculoNoCondominio } from "./util";

const LIMITE_ENVIO_DOCUMENTO = 50 * 1024 * 1024;

/** Dúvida do morador: desvio por código, IA1 com citação conferida, ou encaminhamento ao síndico. */
export async function responderDuvidaNoBot(ctx: ContextoBot, pergunta: string) {
  const p = ctx.pessoa!;
  const r = await receberDuvida({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, pessoaId: p.id, pergunta });
  await ctx.responder(r.mensagemMorador, r.teclado ? { teclado: r.teclado } : undefined);
}

export function registrarMorador(roteador: Roteador) {
  roteador.registrarComando({
    nome: "duvida",
    descricao: "Perguntar sobre as regras do condomínio (regimento e convenção)",
    permissao: ["morador"],
    async executar(ctx) {
      if (ctx.args) return responderDuvidaNoBot(ctx, ctx.args);
      await definirEstado(ctx.chatId, ctx.pessoa!.id, "duvida");
      await ctx.responder("Qual é a sua dúvida? Escreva numa mensagem só.");
    },
  });

  roteador.registrarEstado("duvida", async (ctx) => {
    if (!ctx.texto) return false;
    await limparEstado(ctx.chatId);
    await responderDuvidaNoBot(ctx, ctx.texto);
    return true;
  });

  /* Texto livre do morador: "É uma dúvida ou um problema para consertar?" */
  roteador.registrarMensagemLivre(
    async (ctx) => {
      if (ctx.pessoa?.papel !== "morador" || !ctx.texto) return false;
      await definirEstado(ctx.chatId, ctx.pessoa.id, "tipo_mensagem_livre", { dados: { texto: ctx.texto.slice(0, 1000) } });
      await ctx.responder("É uma dúvida ou um problema para consertar?", {
        teclado: [
          [
            { text: "É uma dúvida", callback_data: "lv:d" },
            { text: "É um problema para consertar", callback_data: "lv:p" },
          ],
        ],
      });
      return true;
    },
    { prioridade: "inicio" },
  );

  roteador.registrarComando({
    nome: "meus",
    descricao: "Seus chamados e dúvidas, com o andamento",
    permissao: ["morador"],
    async executar(ctx) {
      const p = ctx.pessoa!;
      // Só o que é desta pessoa: o morador novo da unidade não vê nada do antigo.
      const chs = await db.select().from(chamados).where(and(eq(chamados.abertoPorPessoaId, p.id), eq(chamados.condominioId, p.condominioId), eq(chamados.natureza, "manutencao"))).orderBy(desc(chamados.abertoEm)).limit(8);
      const dvs = await db.select().from(duvidas).where(and(eq(duvidas.pessoaId, p.id), eq(duvidas.condominioId, p.condominioId))).orderBy(desc(duvidas.criadoEm)).limit(5);
      const rotDuvida = { aguardando_envio: "resposta em conferência", respondida_documentos: "respondida", encaminhada: "com o síndico", respondida_sindico: "respondida pelo síndico", desviada: "não respondida (dado de terceiros)" } as const;
      const linhas = [
        "Seus chamados:",
        ...(chs.length ? chs.map((c) => `• Nº ${c.numero}: ${c.descricao.slice(0, 60)} · ${ROTULO_ESTADO[c.estado]}`) : ["• nenhum"]),
        "",
        "Suas dúvidas:",
        ...(dvs.length ? dvs.map((d) => `• ${d.pergunta.slice(0, 60)} · ${rotDuvida[d.estado]}`) : ["• nenhuma"]),
      ];
      await ctx.responder(linhas.join("\n"));
    },
  });

  roteador.registrarComando({
    nome: "documentos",
    descricao: "Documentos do condomínio (regimento, convenção…), enviados como arquivo",
    permissao: ["morador"],
    async executar(ctx) {
      const p = ctx.pessoa!;
      const docs = await documentosVisiveis(p.organizacaoId, p.condominioId);
      if (docs.length === 0) {
        await ctx.responder("Ainda não há documentos disponíveis por aqui.");
        return;
      }
      await ctx.responder("Qual documento você quer receber?", { teclado: docs.slice(0, 8).map((d) => [{ text: d.titulo.slice(0, 60), callback_data: `dc:${d.id}` }]) });
    },
  });

  /* O bot ENVIA o arquivo (sendDocument), não um link. Documento só em texto vai como .txt. */
  roteador.registrarAcao({
    prefixo: "dc",
    permissao: "publico",
    async executar(ctx, id) {
      if (!UUID.test(id)) return;
      const [d] = await db.select().from(documentos).where(eq(documentos.id, id)).limit(1);
      const m = d && d.visivelMoradores ? await vinculoNoCondominio(ctx.chatId, d.condominioId, ["morador"]) : null;
      if (!d || !m) {
        await ctx.responderBotao("Documento indisponível.");
        return;
      }
      await ctx.responderBotao("Enviando…");
      if (d.arquivoId) {
        const [a] = await db.select().from(arquivos).where(eq(arquivos.id, d.arquivoId)).limit(1);
        const b = a ? await bytesDoArquivo(a.id, a.organizacaoId) : null;
        if (a && b && b.bytes.byteLength <= LIMITE_ENVIO_DOCUMENTO) {
          await ctx.saida.enviarArquivo({ chatId: ctx.chatId, pessoa: m }, { campo: "document", bytes: b.bytes, nome: a.nomeOriginal, mime: a.mimeType }, d.titulo);
          return;
        }
        if (a) {
          const url = await obterArmazenamento().urlTemporaria(a.chave, 600);
          if (url) {
            await ctx.saida.enviarTexto({ chatId: ctx.chatId, pessoa: m }, `${d.titulo}: o arquivo passa de 50 MB; baixe por este link (vale 10 minutos): ${url}`);
            return;
          }
        }
      }
      const texto = d.texto ?? "";
      const nome = `${d.titulo.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "documento"}.txt`;
      await ctx.saida.enviarArquivo({ chatId: ctx.chatId, pessoa: m }, { campo: "document", bytes: new TextEncoder().encode(texto), nome, mime: "text/plain" }, d.titulo);
    },
  });

  /* "Li o aviso": conta uma vez por vínculo. */
  roteador.registrarAcao({
    prefixo: "li",
    permissao: "publico",
    async executar(ctx, entregaId) {
      if (!UUID.test(entregaId)) return;
      const vinculos = await vinculosDoChat(ctx.chatId);
      for (const v of vinculos) {
        const r = await registrarLeitura({ entregaId, pessoaId: v.id });
        if (r === "lido") return ctx.responderBotao("Obrigado! Leitura registrada.");
        if (r === "ja_lido") return ctx.responderBotao("Leitura já registrada.");
      }
      await ctx.responderBotao("Aviso não encontrado.");
    },
  });
}
