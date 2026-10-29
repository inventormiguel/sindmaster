"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pessoas, rotinaModelos } from "@/db/schema";
import { lerPeriodicidadeRotina } from "./periodicidade";
import { acaoNoCondominio, texto, textoOuNulo } from "@/lib/negocio/acao";

export async function criarModeloRotina(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const item = texto(form, "item");
    if (item.length < 3) throw new Error("Escreva o item da rotina.");
    const dono = texto(form, "dono");
    let pessoaId: string | null = null;
    let posto: string | null = null;
    if (dono.startsWith("p:")) {
      const [p] = await db.select().from(pessoas).where(and(eq(pessoas.organizacaoId, usuario.organizacao.id), eq(pessoas.id, dono.slice(2)), eq(pessoas.condominioId, condominio.id), eq(pessoas.papel, "funcionario"))).limit(1);
      if (!p) throw new Error("Funcionário não encontrado.");
      // Funcionário de contratada: a rotina é do POSTO, combinada com a empresa.
      if (p.empregador === "contratada" && p.posto) posto = p.posto;
      else pessoaId = p.id;
    } else if (dono.startsWith("posto:")) posto = dono.slice(6);
    else throw new Error("Escolha o funcionário ou o posto.");
    const agenda = lerPeriodicidadeRotina(form);
    const hora = texto(form, "horaLimite");
    await db.insert(rotinaModelos).values({
      organizacaoId: usuario.organizacao.id,
      condominioId: condominio.id,
      pessoaId,
      posto,
      rotinaDoPosto: Boolean(posto),
      item,
      instrucao: textoOuNulo(form, "instrucao"),
      ...agenda,
      periodoRotulo: (["manha", "tarde", "noite"] as const).find((x) => x === texto(form, "periodo")) ?? "manha",
      horaLimite: /^\d{2}:\d{2}$/.test(hora) ? hora : null,
      fotoObrigatoria: form.get("foto") === "on",
    });
    return "Item de rotina criado. Entra nos itens a partir de hoje (sem aprovação).";
  });
}

export async function alternarModeloRotina(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const [m] = await db.select().from(rotinaModelos).where(and(eq(rotinaModelos.organizacaoId, usuario.organizacao.id), eq(rotinaModelos.id, texto(form, "modeloId")), eq(rotinaModelos.condominioId, condominio.id))).limit(1);
    if (!m) throw new Error("Item não encontrado.");
    await db.update(rotinaModelos).set({ ativo: !m.ativo }).where(and(eq(rotinaModelos.organizacaoId, usuario.organizacao.id), eq(rotinaModelos.id, m.id)));
    return m.ativo ? "Item desativado." : "Item ativado.";
  });
}
