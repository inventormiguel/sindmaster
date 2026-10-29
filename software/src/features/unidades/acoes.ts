"use server";

import { acaoNoCondominio, texto } from "@/lib/negocio/acao";
import { lerDataBR, hojeISO } from "@/lib/negocio/datas";
import { desvincularPessoa } from "@/lib/telegram/vinculo";
import { auditar } from "@/lib/negocio/auditoria";
import { maisUmMorador, registrarEntrada, registrarSaida } from "./servico";

type Relacao = "proprietario" | "inquilino" | "dependente" | "outro";
const relacao = (v: string): Relacao => (["proprietario", "inquilino", "dependente", "outro"].includes(v) ? (v as Relacao) : "outro");

export async function maisUmMoradorAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    await maisUmMorador({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, unidadeId: texto(form, "unidadeId"), nome: texto(form, "nome"), relacao: relacao(texto(form, "relacao")) });
    return "Pessoa acrescentada à unidade. Gere o convite dela.";
  });
}

export async function registrarSaidaAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const r = await registrarSaida({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, unidadeId: texto(form, "unidadeId"), pessoaIds: form.getAll("pessoaId").map(String), data: lerDataBR(texto(form, "data")) ?? hojeISO(), quem: usuario.nome });
    return `Saída registrada: ${r.saem} pessoa(s) desvinculada(s), ${r.revogados} convite(s) revogado(s).`;
  });
}

export async function registrarEntradaAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    const nomes = texto(form, "nomes")
      .split("\n")
      .map((x) => ({ nome: x.trim(), relacao: relacao(texto(form, "relacao")) }));
    const r = await registrarEntrada({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, unidadeId: texto(form, "unidadeId"), nomes, quem: usuario.nome });
    return `Entrada registrada: ${r.length} pessoa(s). Gere os convites delas.`;
  });
}

export async function revogarVinculoAcao(form: FormData) {
  await acaoNoCondominio(form, async ({ usuario, condominio }) => {
    await desvincularPessoa(usuario.organizacao.id, texto(form, "pessoaId"));
    await auditar({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, ator: usuario.nome, acao: "vinculo.revogado", alvo: texto(form, "pessoaId") });
    return "Vínculo revogado: não recebe mais mensagens nem usa comandos (o histórico fica).";
  });
}
