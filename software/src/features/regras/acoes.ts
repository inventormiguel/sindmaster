"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { condominios, palavrasEmergenciaExtra, passosAutoajuda, regrasCategoria, type Urgencia } from "@/db/schema";
import { acaoNoCondominio, texto } from "@/lib/negocio/acao";
import { lerReais } from "@/lib/negocio/dinheiro";
import { auditar } from "@/lib/negocio/auditoria";
import { GRUPOS_EMERGENCIA, type GrupoEmergencia } from "@/lib/negocio/linguagem";

export async function salvarRegraCategoria(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const categoria = texto(form, "categoria");
    const resp = texto(form, "responsavel");
    const urgencia = (["baixa", "media", "alta", "emergencia"] as const).find((x) => x === texto(form, "urgencia")) ?? "media";
    const valores = {
      urgenciaPadrao: urgencia as Urgencia,
      prazoHoras: Math.max(1, Math.min(720, Number(texto(form, "prazo")) || 72)),
      responsavelPessoaId: resp.startsWith("p:") ? resp.slice(2) : null,
      responsavelPrestadorId: resp.startsWith("x:") ? resp.slice(2) : null,
      ativa: form.get("ativa") === "on",
    };
    await db
      .insert(regrasCategoria)
      .values({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, categoria, ...valores })
      .onConflictDoUpdate({ target: [regrasCategoria.condominioId, regrasCategoria.categoria], set: valores });
    return `Regra de "${categoria}" salva.`;
  });
}

export async function novoPassoAutoajuda(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const t = texto(form, "texto");
    if (t.length < 10 || t.length > 300) throw new Error("O passo tem de 10 a 300 caracteres.");
    await db.insert(passosAutoajuda).values({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, categoria: texto(form, "categoria"), titulo: texto(form, "titulo") || t.slice(0, 40), texto: t, aprovadoPorNome: usuario.nome });
    return "Passo aprovado e incluído na biblioteca (a IA só pode oferecer passos daqui).";
  });
}

export async function alternarPasso(form: FormData) {
  await acaoNoCondominio(form, async ({ condominio }) => {
    const [p] = await db.select().from(passosAutoajuda).where(and(eq(passosAutoajuda.id, texto(form, "passoId")), eq(passosAutoajuda.condominioId, condominio.id))).limit(1);
    if (!p) throw new Error("Passo não encontrado.");
    await db.update(passosAutoajuda).set({ ativo: !p.ativo }).where(eq(passosAutoajuda.id, p.id));
    return p.ativo ? "Passo desativado." : "Passo ativado.";
  });
}

export async function novaPalavraEmergencia(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const grupo = texto(form, "grupo") as GrupoEmergencia;
    const expressao = texto(form, "expressao");
    if (!(grupo in GRUPOS_EMERGENCIA) || expressao.length < 3) throw new Error("Escolha o grupo e escreva a expressão.");
    await db.insert(palavrasEmergenciaExtra).values({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, grupo, expressao });
    return "Expressão de emergência acrescentada (as do sistema não podem ser removidas).";
  });
}

export async function salvarConfiguracoes(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const ini = Number(texto(form, "janelaInicio"));
    const fim = Number(texto(form, "janelaFim"));
    if (!(ini >= 0 && ini < fim && fim <= 24)) throw new Error("Janela de envio inválida.");
    const alcada = texto(form, "alcada") ? lerReais(texto(form, "alcada")) : null;
    const mensagens: Record<string, string> = {};
    for (const g of Object.keys(GRUPOS_EMERGENCIA)) {
      const m = texto(form, `msg_${g}`);
      if (m && m !== GRUPOS_EMERGENCIA[g as GrupoEmergencia].mensagem) mensagens[g] = m;
    }
    await db
      .update(condominios)
      .set({
        janelaInicio: ini,
        janelaFim: fim,
        modoRespostaDuvida: texto(form, "modo") === "automatico_com_citacao" ? "automatico_com_citacao" : "conferencia",
        alcadaDespesaCentavos: alcada,
        horasConfirmacaoChamado: Math.max(24, Math.min(240, Number(texto(form, "horasConfirmacao")) || 72)),
        contatoEmergenciaNome: texto(form, "contatoNome") || null,
        contatoEmergenciaTelefone: texto(form, "contatoTelefone") || null,
        mensagensSeguranca: mensagens,
      })
      .where(eq(condominios.id, condominio.id));
    await auditar({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, ator: usuario.nome, acao: "regras.configuracoes", detalhe: { janela: `${ini}-${fim}`, modo: texto(form, "modo") } });
    return "Configurações salvas.";
  });
}
