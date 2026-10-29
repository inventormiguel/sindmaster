"use server";

import { revalidatePath } from "next/cache";
import { exigirPermissao } from "@/lib/auth/sessao";
import { testarIntegracao } from "@/lib/integracoes";
import { descreverResumo, executarJob, JOBS } from "@/lib/cron/jobs";

export type EstadoTeste = { ok?: string; erro?: string } | null;

export async function testarAnthropic(_prev?: EstadoTeste, _form?: FormData): Promise<EstadoTeste> {
  await exigirPermissao("gerenciar_integracoes");
  const r = await testarIntegracao("anthropic");
  revalidatePath("/app/integracoes");
  return r.ok ? { ok: r.detalhe } : { erro: r.detalhe };
}

export async function testarTelegram(_prev?: EstadoTeste, _form?: FormData): Promise<EstadoTeste> {
  await exigirPermissao("gerenciar_integracoes");
  const r = await testarIntegracao("telegram");
  revalidatePath("/app/integracoes");
  revalidatePath("/app");
  return r.ok ? { ok: r.detalhe } : { erro: r.detalhe };
}

/** "Rodar agora" das rotinas agendadas. */
export async function rodarJobAgora(_prev: EstadoTeste, form: FormData): Promise<EstadoTeste> {
  await exigirPermissao("gerenciar_integracoes");
  const job = String(form.get("job") ?? "");
  if (!JOBS[job]) return { erro: "Rotina desconhecida." };
  const r = await executarJob(job, "manual");
  revalidatePath("/app/integracoes");
  if (!r || !r.ok) return { erro: r?.ok === false ? r.erro : "Falhou." };
  return { ok: `Concluída: ${descreverResumo(r.resumo)}.` };
}

/** Testes sem chave (chamada real): BrasilAPI, ViaCEP e armazenamento (gravar e abrir 1 KB). */
export async function testarSimples(_prev: EstadoTeste, form: FormData): Promise<EstadoTeste> {
  await exigirPermissao("gerenciar_integracoes");
  const servico = String(form.get("servico") ?? "");
  if (servico === "brasilapi") {
    const { consultarCnpj } = await import("@/integrations/brasilapi");
    const r = await consultarCnpj("90.407.238/0001-29");
    // O CNPJ do seed é fictício: 404 prova que a API respondeu.
    return r.ok || r.status === 404 ? { ok: `BrasilAPI respondeu (${r.ok ? r.razaoSocial : "404 para o CNPJ fictício do seed, como esperado"}).` } : { erro: r.mensagem };
  }
  if (servico === "viacep") {
    const { consultarCep } = await import("@/integrations/viacep");
    const r = await consultarCep("80240-000");
    return r.ok ? { ok: `ViaCEP respondeu: ${r.cidade}-${r.uf}.` } : { erro: r.mensagem };
  }
  if (servico === "armazenamento") {
    try {
      const { obterArmazenamento } = await import("@/lib/storage");
      const a = obterArmazenamento();
      const chave = `teste/${crypto.randomUUID()}.txt`;
      await a.salvar(chave, new Uint8Array(1024).fill(65), "text/plain");
      const lido = await a.abrir(chave);
      const url = await a.urlTemporaria(chave, 60);
      return lido ? { ok: `Gravou e abriu 1 KB (${a.provedor === "blob" ? `nuvem privada${url ? ", URL assinada gerada" : ""}` : "pasta local"}).` } : { erro: "Gravou, mas não conseguiu abrir." };
    } catch (e) {
      return { erro: e instanceof Error ? e.message : "Falhou." };
    }
  }
  return { erro: "Serviço desconhecido." };
}
