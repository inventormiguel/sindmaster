import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/db";
import { pessoas, type PapelPessoa } from "@/db/schema";
import { appUrl } from "@/lib/url-publica";
import { vinculosDoChat } from "../vinculo";
import type { ContextoBot, PessoaVinculada } from "../roteador";
import type { TecladoInline } from "../tipos";

/**
 * Botões carregam o id do registro: a ação acha o condomínio pelo registro e confere se
 * esta conta tem vínculo com o papel certo NAQUELE condomínio (não usa o contexto atual).
 */
export async function vinculoNoCondominio(chatId: number, condominioId: string, papeis: PapelPessoa[]): Promise<PessoaVinculada | null> {
  const lista = await vinculosDoChat(chatId);
  return lista.find((v) => v.condominioId === condominioId && papeis.includes(v.papel)) ?? null;
}

export async function recusarBotao(ctx: ContextoBot, texto = "Esta opção não é do seu perfil neste condomínio.") {
  await ctx.responderBotao(texto);
}

/** Link "Abrir no painel" (sempre com APP_URL, nunca o endereço interno). */
export function linkPainel(caminho: string, condominioId?: string): string {
  return `${appUrl()}${caminho}${condominioId ? `${caminho.includes("?") ? "&" : "?"}c=${condominioId}` : ""}`;
}

export function botaoPainel(texto: string, caminho: string, condominioId?: string): TecladoInline[number] {
  return [{ text: texto, url: linkPainel(caminho, condominioId) }];
}

/** Envia ao vínculo certo (com o cabeçalho do condomínio dele), mesmo que o contexto do chat seja outro. */
export async function responderComo(ctx: ContextoBot, pessoa: PessoaVinculada, texto: string, teclado?: TecladoInline) {
  const { cabecalhoContexto } = await import("../roteador");
  return ctx.saida.enviarTexto({ chatId: ctx.chatId, pessoa }, cabecalhoContexto(pessoa) + texto, teclado ? { teclado } : undefined);
}

export async function pessoaCompleta(pessoaId: string) {
  const [p] = await db.select().from(pessoas).where(and(eq(pessoas.id, pessoaId), isNull(pessoas.removidaEm))).limit(1);
  return p ?? null;
}

export function rotuloAutor(p: PessoaVinculada): string {
  return p.papel === "morador" && p.unidade ? `${p.nome} (unidade ${p.unidade})` : p.nome;
}

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
