import { after } from "next/server";
import { compararSegredo, segredoCron } from "@/lib/segredos";
import { ALIAS_JOBS, executarJob, JOBS } from "@/lib/cron/jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Rotinas agendadas. Protegida por `Authorization: Bearer <CRON_SECRET>`
 * (a Vercel manda esse header sozinha quando CRON_SECRET está definido).
 * O `frequente` responde 200 na hora e trabalha depois da resposta (agendadores
 * externos têm timeout curto).
 */
async function tratar(req: Request, { params }: { params: Promise<{ job: string }> }) {
  const { job } = await params;
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!compararSegredo(token, segredoCron())) {
    return Response.json({ ok: false, erro: "Não autorizado." }, { status: 401 });
  }
  const nome = ALIAS_JOBS[job] ?? job;
  if (!JOBS[nome]) return Response.json({ ok: false, erro: "Rotina desconhecida." }, { status: 404 });
  const origem = req.headers.get("user-agent")?.includes("vercel-cron") ? "cron" : "script";
  if (nome === "frequente") {
    after(() => executarJob(nome, origem));
    return Response.json({ ok: true, agendado: true });
  }
  const r = await executarJob(nome, origem);
  return Response.json(r, { status: r?.ok ? 200 : 500 });
}

export const GET = tratar;
export const POST = tratar;
