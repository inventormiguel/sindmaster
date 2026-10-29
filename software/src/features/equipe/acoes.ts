"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pessoas } from "@/db/schema";
import { acaoNoCondominio, texto, textoOuNulo } from "@/lib/negocio/acao";

export async function cadastrarFuncionario(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const nome = texto(form, "nome");
    if (nome.length < 2) throw new Error("Informe o nome.");
    const contratada = texto(form, "empregador") === "contratada";
    const empresa = textoOuNulo(form, "empresaContratada");
    if (contratada && !empresa) throw new Error("Informe a empresa contratada (as rotinas do posto são combinadas com ela).");
    await db.insert(pessoas).values({
      organizacaoId: usuario.organizacao.id,
      condominioId: condominio.id,
      nome,
      papel: "funcionario",
      funcao: textoOuNulo(form, "funcao"),
      empregador: contratada ? "contratada" : "condominio",
      empresaContratada: contratada ? empresa : null,
      posto: contratada ? (textoOuNulo(form, "posto") ?? textoOuNulo(form, "funcao")) : null,
      contatoPlantao: form.get("plantao") === "on",
      celularDoPosto: form.get("celularDoPosto") === "on",
      telefone: textoOuNulo(form, "telefone"),
    });
    return `${nome} cadastrado(a). Gere o convite do Telegram na lista.`;
  });
}

export async function alternarPlantao(form: FormData) {
  await acaoNoCondominio(form, async ({ condominio }) => {
    const [p] = await db.select().from(pessoas).where(and(eq(pessoas.id, texto(form, "pessoaId")), eq(pessoas.condominioId, condominio.id))).limit(1);
    if (!p) throw new Error("Pessoa não encontrada.");
    await db.update(pessoas).set({ contatoPlantao: !p.contatoPlantao }).where(eq(pessoas.id, p.id));
    return p.contatoPlantao ? "Tirado do plantão." : "Agora é contato de plantão (combinado com o empregador).";
  });
}
