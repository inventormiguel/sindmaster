import "server-only";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { exigirCondominioAcao } from "./acesso";

/** Caminho de volta seguro (só páginas do painel). */
function caminhoVoltar(form: FormData): string {
  const v = String(form.get("voltar") ?? "/app");
  return v.startsWith("/app") ? v : "/app";
}

function comParametro(caminho: string, chave: string, valor: string) {
  const [base, query = ""] = caminho.split("?");
  const p = new URLSearchParams(query);
  p.delete("ok");
  p.delete("erro");
  p.set(chave, valor.slice(0, 300));
  return `${base}?${p.toString()}`;
}

function ehRedirect(e: unknown) {
  return typeof e === "object" && e !== null && "digest" in e && String((e as { digest: unknown }).digest).startsWith("NEXT_REDIRECT");
}

/**
 * Ação de formulário do painel: confere o acesso ao condomínio do formulário (campo "c"),
 * roda e volta para a página com ?ok=… ou ?erro=… (mensagem sem dado pessoal).
 */
export async function acaoNoCondominio(form: FormData, fn: (ctx: Awaited<ReturnType<typeof exigirCondominioAcao>>) => Promise<string>, nivel: "gestao" | "leitura" = "gestao") {
  const voltar = caminhoVoltar(form);
  let destino: string;
  try {
    const ctx = await exigirCondominioAcao(String(form.get("c") ?? ""), nivel);
    const ok = await fn(ctx);
    destino = comParametro(voltar, "ok", ok);
  } catch (e) {
    if (ehRedirect(e)) throw e;
    destino = comParametro(voltar, "erro", e instanceof Error ? e.message : "Não foi possível concluir.");
  }
  revalidatePath(voltar.split("?")[0]);
  redirect(destino);
}

export function texto(form: FormData, campo: string): string {
  const v = form.get(campo);
  return typeof v === "string" ? v.trim() : "";
}

export function textoOuNulo(form: FormData, campo: string): string | null {
  return texto(form, campo) || null;
}
