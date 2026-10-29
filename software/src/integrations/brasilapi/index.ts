import { BRAND } from "@/lib/brand";

/** BrasilAPI (sem chave): razão social e situação cadastral por CNPJ. CNPJ fictício do seed devolve 404 (esperado). */
export type ResultadoCnpj = { ok: true; razaoSocial: string; situacao: string } | { ok: false; status: number; mensagem: string };

export async function consultarCnpj(cnpj: string, fetchFn: typeof fetch = fetch): Promise<ResultadoCnpj> {
  const d = cnpj.replace(/\D/g, "");
  if (d.length !== 14) return { ok: false, status: 400, mensagem: "CNPJ deve ter 14 dígitos." };
  try {
    const r = await fetchFn(`https://brasilapi.com.br/api/cnpj/v1/${d}`, { headers: { "user-agent": BRAND.userAgent }, signal: AbortSignal.timeout(10000) });
    if (r.status === 404) return { ok: false, status: 404, mensagem: "CNPJ não encontrado na BrasilAPI." };
    if (!r.ok) return { ok: false, status: r.status, mensagem: `BrasilAPI respondeu ${r.status}.` };
    const j = (await r.json()) as { razao_social?: string; descricao_situacao_cadastral?: string };
    return { ok: true, razaoSocial: j.razao_social ?? "", situacao: j.descricao_situacao_cadastral ?? "" };
  } catch (e) {
    return { ok: false, status: 0, mensagem: `Falha de rede: ${e instanceof Error ? e.message.slice(0, 100) : "desconhecida"}` };
  }
}
