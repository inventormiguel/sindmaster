import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { despesas } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/sessao";
import { condominiosDoUsuario } from "@/lib/negocio/acesso";
import { linhaCsv } from "@/lib/negocio/csv";
import { ROTULO_CATEGORIA_DESPESA } from "@/features/despesas/servico";

export const dynamic = "force-dynamic";

/** CSV das despesas do mês (lançadas, estornadas e recusadas). Não é balancete contábil. */
export async function GET(req: Request) {
  const u = await exigirUsuario();
  const p = new URLSearchParams(req.url.split("?")[1] ?? "");
  const c = p.get("c") ?? "";
  const mes = /^\d{4}-\d{2}$/.test(p.get("mes") ?? "") ? p.get("mes")! : new Date().toISOString().slice(0, 7);
  const cond = (await condominiosDoUsuario(u)).find((x) => x.id === c);
  if (!cond) return new Response("Não encontrado.", { status: 404 });
  const lista = await db.select().from(despesas).where(and(eq(despesas.condominioId, c)));
  const linhas = [linhaCsv(["data_emissao", "fornecedor", "cnpj", "categoria", "valor", "estado", "conferida_por", "motivo", "arquivo_id", "dado_de_exemplo"])];
  for (const d of lista.filter((x) => (x.dataEmissao ?? "").startsWith(mes) && ["lancada", "estornada", "recusada"].includes(x.estado))) {
    if (cond.papel === "conselho" && d.estado !== "lancada") continue;
    linhas.push(linhaCsv([d.dataEmissao, d.fornecedorNome, d.cnpj, ROTULO_CATEGORIA_DESPESA[d.categoria] ?? d.categoria, ((d.valorCentavos ?? 0) / 100).toFixed(2).replace(".", ","), d.estado, d.conferidoPorNome, d.estornoMotivo ?? d.decisaoMotivo, d.arquivoId, d.exemplo ? "sim" : "não"]));
  }
  return new Response("﻿" + linhas.join("\n") + "\n# Não é balancete contábil.", { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="despesas-${mes}.csv"`, "cache-control": "no-store" } });
}
