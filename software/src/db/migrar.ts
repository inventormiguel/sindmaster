import path from "node:path";
import { migrate as migrarPglite } from "drizzle-orm/pglite/migrator";
import { migrate as migrarPostgres } from "drizzle-orm/postgres-js/migrator";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { obterConexao } from "./index";

export async function migrarBanco() {
  const { db, tipo } = obterConexao();
  const migrationsFolder = path.join(process.cwd(), "drizzle");
  if (tipo === "pglite") {
    await migrarPglite(db as unknown as PgliteDatabase<Record<string, never>>, { migrationsFolder });
  } else {
    await migrarPostgres(db, { migrationsFolder });
  }
}
