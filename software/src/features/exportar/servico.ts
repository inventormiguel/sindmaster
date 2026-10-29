import { eq, getTableColumns, getTableName } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { zipSync, strToU8 } from "fflate";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { linhaCsv } from "@/lib/negocio/csv";

/** Colunas que nunca saem no "Exportar tudo" (segredos e dados cifrados). */
const COLUNAS_FORA = new Set(["senhaHash", "codigoHash", "dadosCifrados"]);

/** Tabelas da organização (todas têm organizacao_id). */
function tabelasDaOrganizacao(): PgTable[] {
  const lista: PgTable[] = [];
  for (const v of Object.values(schema)) {
    if (v && typeof v === "object" && "organizacaoId" in (v as object) && typeof (v as { getSQL?: unknown }).getSQL === "function") lista.push(v as unknown as PgTable);
  }
  return lista;
}

/**
 * "Exportar tudo": ZIP só com CSVs de todas as tabelas da organização (um CSV por tabela).
 * Os arquivos binários aparecem listados (nome, tipo, tamanho, id) no CSV de arquivos.
 */
export async function exportarOrganizacao(organizacaoId: string): Promise<{ zip: Uint8Array; tabelas: string[] }> {
  const arquivos: Record<string, Uint8Array> = {};
  const nomes: string[] = [];
  for (const t of tabelasDaOrganizacao()) {
    const nome = getTableName(t);
    const colunas = Object.entries(getTableColumns(t)).filter(([k]) => !COLUNAS_FORA.has(k));
    const col = (t as unknown as Record<string, unknown>).organizacaoId as Parameters<typeof eq>[0];
    const linhas = (await db.select().from(t).where(eq(col, organizacaoId))) as Record<string, unknown>[];
    const csv = [linhaCsv(colunas.map(([, c]) => c.name)), ...linhas.map((l) => linhaCsv(colunas.map(([k]) => l[k])))].join("\n");
    arquivos[`${nome}.csv`] = strToU8("﻿" + csv);
    nomes.push(nome);
  }
  arquivos["LEIA-ME.txt"] = strToU8("Exportação completa da organização: um CSV por tabela (separador ;). Os arquivos (fotos, PDFs) estão listados em arquivos.csv; o conteúdo binário fica no armazenamento. Senhas, códigos de convite e dados de pagamento cifrados não são exportados.\n");
  return { zip: zipSync(arquivos, { level: 6 }), tabelas: nomes.sort() };
}
