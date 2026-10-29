import "./_ambiente";
import { segredoCron } from "@/lib/segredos";

/**
 * Roda uma rotina agendada à mão: npm run cron -- diario
 * Se o servidor local estiver no ar, chama a rota /api/cron/<job> (o banco local
 * aceita um processo por vez). Senão, roda aqui mesmo.
 */
const job = process.argv[2]?.trim();
const base = (process.env.POLLING_SERVIDOR ?? "http://localhost:3241").replace(/\/+$/, "");

async function main() {
  if (!job) throw new Error("Informe a rotina. Ex.: npm run cron -- diario");
  try {
    const r = await fetch(`${base}/api/cron/${encodeURIComponent(job)}`, {
      headers: { authorization: `Bearer ${segredoCron()}` },
    });
    console.log(`[cron] servidor respondeu ${r.status}`);
    console.log(JSON.stringify(await r.json(), null, 2));
    return;
  } catch {
    console.log("[cron] servidor local fora do ar; rodando neste processo.");
  }
  const { executarJob } = await import("@/lib/cron/jobs");
  const { fecharConexao } = await import("@/db");
  const r = await executarJob(job, "script");
  if (!r) throw new Error(`Rotina desconhecida: ${job}`);
  console.log(JSON.stringify(r, null, 2));
  await fecharConexao();
}

main().catch((e) => {
  console.error(`[cron] ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
