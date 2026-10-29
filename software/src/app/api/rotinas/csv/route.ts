import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pessoas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/sessao";
import { condominiosDoUsuario, podeGerir } from "@/lib/negocio/acesso";
import { itensDoPeriodo } from "@/features/rotinas/servico";
import { hojeISO, somarDias } from "@/lib/negocio/datas";
import { linhaCsv } from "@/lib/negocio/csv";

export const dynamic = "force-dynamic";

/** CSV das rotinas (30 dias): por item e data. SEM horário de chegada, sem duração, sem hora da foto. */
export async function GET(req: Request) {
  const u = await exigirUsuario();
  const c = new URLSearchParams(req.url.split("?")[1] ?? "").get("c") ?? "";
  const cond = (await condominiosDoUsuario(u)).find((x) => x.id === c);
  if (!cond || !podeGerir(cond.papel)) return new Response("Não encontrado.", { status: 404 });
  const hoje = hojeISO();
  const itens = await itensDoPeriodo(u.organizacao.id, c, somarDias(hoje, -30), hoje);
  const fs = await db.select().from(pessoas).where(and(eq(pessoas.condominioId, c), eq(pessoas.papel, "funcionario")));
  const nome = new Map(fs.map((f) => [f.id, f.nome]));
  const linhas = [linhaCsv(["data", "item", "de_quem", "estado", "motivo", "com_foto"])];
  for (const { item, modelo } of itens.sort((a, b) => a.item.data.localeCompare(b.item.data))) {
    linhas.push(linhaCsv([item.data, modelo.item, item.posto ? `posto ${item.posto}` : (nome.get(item.pessoaId ?? "") ?? ""), item.estado, item.motivo ?? "", item.arquivoId ? "sim" : "não"]));
  }
  return new Response("﻿" + linhas.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="rotinas-${hoje}.csv"`, "cache-control": "no-store" } });
}
