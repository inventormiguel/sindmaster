import { sql } from "drizzle-orm";
import { db, obterConexao } from "@/db";

export const dynamic = "force-dynamic";

/** Verificação simples: o servidor está de pé e o banco responde. */
export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({ ok: true, banco: obterConexao().tipo });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}
