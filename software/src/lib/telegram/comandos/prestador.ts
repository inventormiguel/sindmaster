import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pessoas, prestadorDocumentos, prestadores } from "@/db/schema";
import { chamadosAtribuidos, ROTULO_ESTADO } from "@/features/chamados/servico";
import { lerDocumentoIA3 } from "@/features/prestadores/ia";
import { ROTULO_DOC, titularConfere } from "@/features/prestadores/servico";
import { avisarSindicos } from "@/features/duvidas/servico";
import { dataBR } from "@/lib/negocio/datas";
import { definirEstado, limparEstado } from "../estado";
import type { ContextoBot, Roteador } from "../roteador";
import { obterArquivoDaMensagem } from "./arquivos";

async function prestadorDaPessoa(pessoaId: string) {
  const [p] = await db.select({ id: pessoas.prestadorId }).from(pessoas).where(eq(pessoas.id, pessoaId)).limit(1);
  return p?.id ?? null;
}

/** Prestador: /os, /concluir e /certidao. O prestador nunca abre chamado nem paga nada. */
export function registrarPrestador(roteador: Roteador) {
  roteador.registrarComando({
    nome: "os",
    descricao: "Serviços atribuídos a você neste condomínio",
    permissao: ["prestador"],
    async executar(ctx) {
      const p = ctx.pessoa!;
      const prestadorId = await prestadorDaPessoa(p.id);
      const lista = prestadorId ? await chamadosAtribuidos({ prestadorId, condominioId: p.condominioId }) : [];
      if (lista.length === 0) {
        await ctx.responder("Nenhum serviço atribuído agora.");
        return;
      }
      for (const ch of lista.slice(0, 8)) {
        const ag = ch.agendadoPara ? `\nAgendado: ${ch.agendadoPara.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" })}` : "";
        await ctx.responder(`OS nº ${ch.numero} · ${ROTULO_ESTADO[ch.estado]}\n${ch.descricao}${ag}`, { teclado: [[{ text: "Concluir", callback_data: `ch:r:${ch.id}` }]] });
      }
    },
  });

  roteador.registrarComando({
    nome: "concluir",
    descricao: "Concluir um serviço: fotos, comprovante (PDF) e nota",
    permissao: ["prestador"],
    async executar(ctx) {
      const p = ctx.pessoa!;
      const prestadorId = await prestadorDaPessoa(p.id);
      const lista = prestadorId ? await chamadosAtribuidos({ prestadorId, condominioId: p.condominioId }) : [];
      if (lista.length === 0) {
        await ctx.responder("Nenhum serviço para concluir.");
        return;
      }
      await ctx.responder("Qual serviço você concluiu?", { teclado: lista.slice(0, 8).map((ch) => [{ text: `Nº ${ch.numero}: ${ch.descricao}`.slice(0, 60), callback_data: `ch:r:${ch.id}` }]) });
    },
  });

  roteador.registrarComando({
    nome: "certidao",
    descricao: "Enviar certidão ou apólice (PDF ou foto)",
    permissao: ["prestador"],
    async executar(ctx) {
      await definirEstado(ctx.chatId, ctx.pessoa!.id, "certidao");
      await ctx.responder("Mande a certidão (CND federal, CRF do FGTS, CNDT) ou a apólice, em PDF ou foto. O síndico confere antes de valer.");
    },
  });

  roteador.registrarEstado("certidao", async (ctx: ContextoBot) => {
    const p = ctx.pessoa!;
    if (!ctx.mensagem?.photo?.length && !ctx.mensagem?.document) {
      await ctx.responder("Mande o PDF ou a foto do documento.");
      return true;
    }
    const a = await obterArquivoDaMensagem(ctx);
    if (!a) return true;
    await limparEstado(ctx.chatId);
    const prestadorId = await prestadorDaPessoa(p.id);
    const [pr] = prestadorId ? await db.select().from(prestadores).where(eq(prestadores.id, prestadorId)).limit(1) : [];
    if (!pr) {
      await ctx.responder("Seu cadastro não está ligado a um prestador. Fale com o síndico.");
      return true;
    }
    const l = await lerDocumentoIA3({ organizacaoId: p.organizacaoId, arquivoId: a.id, esperado: "documento_prestador", cnpjPrestador: pr.cnpj });
    const tipo = l.ok && (["cnd_federal", "crf_fgts", "cndt", "apolice_rc", "alvara"] as const).includes(l.leitura.tipo as "cndt") ? (l.leitura.tipo as "cndt") : "outro";
    await db.insert(prestadorDocumentos).values({
      organizacaoId: p.organizacaoId,
      prestadorId: pr.id,
      tipo,
      titularCnpj: l.ok ? l.leitura.titularCnpj : null,
      emitidoEm: l.ok ? l.emitidoEm : null,
      validade: l.ok ? l.validade : null,
      arquivoId: a.id,
      origemLeitura: l.ok ? "ia" : "manual",
      leituraIa: l.ok ? l.leitura : null,
      estado: "para_conferir",
      enviadoPor: "telegram",
    });
    const titular = l.ok ? titularConfere(tipo, l.leitura.titularCnpj, pr.cnpj) : null;
    await avisarSindicos(p.organizacaoId, p.condominioId, `${pr.razaoSocial} mandou ${ROTULO_DOC[tipo]} para conferir. Envie /aprovar.`, `certidao:${a.id}`);
    await ctx.responder(
      l.ok
        ? `Recebido. Lido pela IA (não conferido): ${ROTULO_DOC[tipo]}${l.validade ? `, validade ${dataBR(l.validade)}` : ", validade não encontrada"}${titular === false ? ". Atenção: o titular lido não confere com o CNPJ do cadastro" : ""}. O síndico confere antes de valer.`
        : `Recebido. ${l.mensagem} O síndico confere à mão.`,
    );
    void and;
    return true;
  });
}
