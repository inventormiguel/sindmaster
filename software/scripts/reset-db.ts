import "./_ambiente";
import fs from "node:fs";
import path from "node:path";
import { diretorioDados } from "@/lib/segredos";

/**
 * Recomeça o banco local do zero sem apagar nada: a pasta atual do PGlite é
 * renomeada para .data/pglite-antigo-<data> (pode ser removida à mão depois).
 * Em seguida rode `npm run db:setup` (ou `npm run dev`).
 */
if (process.env.DATABASE_URL) {
  console.error("[db:reset] DATABASE_URL está definido: este comando só mexe no banco local (PGlite).");
  process.exit(1);
}
const atual = path.join(diretorioDados(), "pglite");
if (!fs.existsSync(atual)) {
  console.log("[db:reset] não há banco local para recomeçar.");
} else {
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
  const destino = path.join(diretorioDados(), `pglite-antigo-${carimbo}`);
  fs.renameSync(atual, destino);
  console.log(`[db:reset] banco anterior guardado em ${path.relative(process.cwd(), destino)}`);
}
console.log("[db:reset] rode `npm run db:setup` para criar o banco novo com o usuário de demonstração.");
