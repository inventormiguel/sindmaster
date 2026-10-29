import fs from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import { diretorioDados } from "@/lib/segredos";

/**
 * Escolha do banco:
 * - DATABASE_URL definido → Postgres (Neon, Supabase, Vercel Postgres) via postgres-js.
 * - Sem DATABASE_URL → PGlite local em ./.data/pglite (zero instalação).
 * - Nos testes (VITEST) → PGlite em memória, um banco por arquivo de teste.
 *
 * PGlite é conexão única: só um processo pode abrir a pasta por vez.
 */
export type Db = PostgresJsDatabase<typeof schema>;

type Conexao = {
  db: Db;
  tipo: "postgres" | "pglite";
  fechar: () => Promise<void>;
};

function criarConexao(): Conexao {
  const url = process.env.DATABASE_URL?.trim();
  if (url) {
    const cliente = postgres(url, {
      max: process.env.VERCEL === "1" ? 1 : 5,
      prepare: false,
      connection: { application_name: "painel" },
    });
    return {
      db: drizzlePostgres(cliente, { schema }),
      tipo: "postgres",
      fechar: () => cliente.end(),
    };
  }
  let dir: string | undefined;
  if (!process.env.VITEST) {
    dir = process.env.PGLITE_DIR ?? path.join(diretorioDados(), "pglite");
    fs.mkdirSync(dir, { recursive: true });
  }
  const cliente = new PGlite(dir);
  return {
    db: drizzlePglite(cliente, { schema }) as unknown as Db,
    tipo: "pglite",
    fechar: () => cliente.close(),
  };
}

const global = globalThis as unknown as { __conexaoBanco?: Conexao };

export function obterConexao(): Conexao {
  if (!global.__conexaoBanco) global.__conexaoBanco = criarConexao();
  return global.__conexaoBanco;
}

export async function fecharConexao() {
  const c = global.__conexaoBanco;
  global.__conexaoBanco = undefined;
  if (c) await c.fechar();
}

/** Banco criado só no primeiro uso (o build do Next não abre o banco à toa). */
export const db: Db = new Proxy({} as Db, {
  get(_alvo, prop) {
    const real = obterConexao().db as unknown as Record<string | symbol, unknown>;
    const valor = real[prop];
    return typeof valor === "function" ? (valor as (...a: unknown[]) => unknown).bind(real) : valor;
  },
});

export { schema };
