import { BRAND } from "@/lib/brand";

/** ViaCEP (sem chave): endereço pelo CEP. */
export type ResultadoCep = { ok: true; logradouro: string; bairro: string; cidade: string; uf: string } | { ok: false; mensagem: string };

export async function consultarCep(cep: string, fetchFn: typeof fetch = fetch): Promise<ResultadoCep> {
  const d = cep.replace(/\D/g, "");
  if (d.length !== 8) return { ok: false, mensagem: "CEP deve ter 8 dígitos." };
  try {
    const r = await fetchFn(`https://viacep.com.br/ws/${d}/json/`, { headers: { "user-agent": BRAND.userAgent }, signal: AbortSignal.timeout(10000) });
    if (!r.ok) return { ok: false, mensagem: `ViaCEP respondeu ${r.status}.` };
    const j = (await r.json()) as { erro?: boolean; logradouro?: string; bairro?: string; localidade?: string; uf?: string };
    if (j.erro) return { ok: false, mensagem: "CEP não encontrado." };
    return { ok: true, logradouro: j.logradouro ?? "", bairro: j.bairro ?? "", cidade: j.localidade ?? "", uf: j.uf ?? "" };
  } catch (e) {
    return { ok: false, mensagem: `Falha de rede: ${e instanceof Error ? e.message.slice(0, 100) : "desconhecida"}` };
  }
}
