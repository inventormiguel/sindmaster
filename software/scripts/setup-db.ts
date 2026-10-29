import "./_ambiente";
import { fecharConexao, obterConexao } from "@/db";
import { migrarBanco } from "@/db/migrar";
import { semear } from "@/db/seed";

async function main() {
  const { tipo } = obterConexao();
  console.log(`[db:setup] banco: ${tipo === "pglite" ? "local (PGlite em .data/pglite)" : "Postgres (DATABASE_URL)"}`);
  await migrarBanco();
  console.log("[db:setup] migrações aplicadas");
  const r = await semear();
  console.log(`[db:setup] usuário de demonstração pronto${r.criouDados ? "; dados de exemplo criados" : ""}`);
  await fecharConexao();
}

main().catch(async (e) => {
  console.error("[db:setup] falhou:", e instanceof Error ? e.message : e);
  await fecharConexao().catch(() => undefined);
  process.exit(1);
});
