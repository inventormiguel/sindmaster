"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import QRCode from "qrcode";
import { z } from "zod";
import { db } from "@/db";
import { condominios, pessoas, type PapelPessoa } from "@/db/schema";
import { exigirPermissao } from "@/lib/auth/sessao";
import { segredoWebhookTelegram } from "@/lib/segredos";
import { appUrl, appUrlEhLocal, origemPublica } from "@/lib/url-publica";
import { NOMES_ALEATORIOS } from "@/db/seed/dados";
import {
  clienteDoAmbiente,
  criarConvite,
  desvincularPessoa,
  enfileirarAvisoPapel,
  enfileirarAvisoPessoa,
  linkDoConvite,
  processarFilaEnvios,
  removerToken,
  revogarConvite,
  tokenDoBot,
  usernameDoBot,
  UPDATES_PERMITIDOS,
  VALIDADES_HORAS,
} from "@/lib/telegram";
import { montarRoteador } from "@/lib/telegram/comandos";

const PAPEIS = ["sindico", "funcionario", "morador", "prestador"] as const;

export type EstadoAcao = { erro?: string; ok?: string } | null;

function texto(form: FormData, campo: string): string | null {
  const v = form.get(campo);
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

function mensagemErro(e: unknown): string {
  return removerToken(e instanceof Error ? e.message : String(e), tokenDoBot());
}

async function condominioDaOrganizacao(organizacaoId: string, condominioId: string | null) {
  if (!condominioId) return null;
  const [c] = await db
    .select({ id: condominios.id })
    .from(condominios)
    .where(and(eq(condominios.id, condominioId), eq(condominios.organizacaoId, organizacaoId)))
    .limit(1);
  return c ?? null;
}

function atualizar() {
  revalidatePath("/app/telegram");
  revalidatePath("/app");
}

/* ----------------------------- Pessoas ----------------------------- */

const esquemaPessoa = z.object({
  nome: z.string().min(2, "Informe o nome."),
  papel: z.enum(PAPEIS, { message: "Escolha o perfil." }),
  unidade: z.string().nullable(),
  telefone: z.string().nullable(),
});

export async function adicionarPessoa(_prev: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const u = await exigirPermissao("gerenciar_telegram");
  const cond = await condominioDaOrganizacao(u.organizacao.id, texto(form, "condominioId"));
  if (!cond) return { erro: "Escolha o condomínio." };
  const r = esquemaPessoa.safeParse({
    nome: texto(form, "nome") ?? "",
    papel: texto(form, "papel"),
    unidade: texto(form, "unidade"),
    telefone: texto(form, "telefone"),
  });
  if (!r.success) return { erro: r.error.issues[0].message };
  await db.insert(pessoas).values({ organizacaoId: u.organizacao.id, condominioId: cond.id, ...r.data });
  atualizar();
  return { ok: `${r.data.nome} cadastrado(a). Agora gere o convite na lista de pessoas.` };
}

/** Só na conta de demonstração: cria uma pessoa com dados fictícios plausíveis. */
export async function criarPessoaDemonstracao(_prev?: EstadoAcao, _form?: FormData): Promise<EstadoAcao> {
  const u = await exigirPermissao("gerenciar_telegram");
  if (!u.organizacao.isDemo) return { erro: "Disponível só na conta de demonstração." };
  const [cond] = await db.select({ id: condominios.id }).from(condominios).where(eq(condominios.organizacaoId, u.organizacao.id)).limit(1);
  if (!cond) return { erro: "Cadastre um condomínio antes." };
  const sorteio = (n: number) => Math.floor(Math.random() * n);
  const papel: PapelPessoa = (["morador", "morador", "morador", "funcionario"] as const)[sorteio(4)];
  const nome = `${NOMES_ALEATORIOS[sorteio(NOMES_ALEATORIOS.length)]} (fictícia)`;
  const unidade = papel === "morador" ? `Bloco ${["A", "B"][sorteio(2)]} – ${1 + sorteio(6)}0${1 + sorteio(4)}` : null;
  await db.insert(pessoas).values({
    organizacaoId: u.organizacao.id,
    condominioId: cond.id,
    nome,
    papel,
    unidade,
    telefone: `(41) 99000-0${100 + sorteio(900)}`,
  });
  atualizar();
  return { ok: `${nome} criado(a).` };
}

export async function desvincular(form: FormData) {
  const u = await exigirPermissao("gerenciar_telegram");
  const id = texto(form, "pessoaId");
  if (id) await desvincularPessoa(u.organizacao.id, id);
  atualizar();
}

/* ----------------------------- Convites ----------------------------- */

export type EstadoConvite = { erro?: string; convite?: { pessoa: string; link: string; qr: string; expiraEm: string } } | null;

export async function gerarConvite(_prev: EstadoConvite, form: FormData): Promise<EstadoConvite> {
  const u = await exigirPermissao("gerenciar_telegram");
  if (!tokenDoBot()) return { erro: "Conecte o Telegram na página Integrações antes de gerar convites." };
  const pessoaId = texto(form, "pessoaId");
  const horas = Number(texto(form, "validadeHoras") ?? 72);
  if (!pessoaId) return { erro: "Escolha a pessoa." };
  if (!(VALIDADES_HORAS as readonly number[]).includes(horas)) return { erro: "Validade inválida." };
  const [pessoa] = await db
    .select({ nome: pessoas.nome })
    .from(pessoas)
    .where(and(eq(pessoas.id, pessoaId), eq(pessoas.organizacaoId, u.organizacao.id)))
    .limit(1);
  if (!pessoa) return { erro: "Pessoa não encontrada." };
  let username: string | null;
  try {
    username = await usernameDoBot();
  } catch (e) {
    return { erro: `Não consegui consultar o bot: ${mensagemErro(e)}` };
  }
  if (!username) return { erro: "Não encontrei o @usuario do bot." };
  const { codigo, convite } = await criarConvite({
    organizacaoId: u.organizacao.id,
    pessoaId,
    validadeHoras: horas,
    criadoPorUsuarioId: u.id,
  });
  const link = linkDoConvite(username, codigo);
  const svg = await QRCode.toString(link, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  atualizar();
  return {
    convite: {
      pessoa: pessoa.nome,
      link,
      qr: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}`,
      expiraEm: convite.expiraEm.toISOString(),
    },
  };
}

export async function revogar(form: FormData) {
  const u = await exigirPermissao("gerenciar_telegram");
  const id = texto(form, "conviteId");
  if (id) await revogarConvite(u.organizacao.id, id);
  atualizar();
}

/* ----------------------------- Avisos ----------------------------- */

export async function enviarAviso(_prev: EstadoAcao, form: FormData): Promise<EstadoAcao> {
  const u = await exigirPermissao("enviar_avisos");
  const cond = await condominioDaOrganizacao(u.organizacao.id, texto(form, "condominioId"));
  if (!cond) return { erro: "Escolha o condomínio." };
  const mensagem = texto(form, "texto");
  if (!mensagem) return { erro: "Escreva o aviso." };
  const destino = texto(form, "destino") ?? "";
  try {
    let r;
    if (destino.startsWith("pessoa:")) {
      const pessoaId = destino.slice(7);
      const [p] = await db
        .select({ id: pessoas.id })
        .from(pessoas)
        .where(and(eq(pessoas.id, pessoaId), eq(pessoas.condominioId, cond.id), eq(pessoas.organizacaoId, u.organizacao.id)))
        .limit(1);
      if (!p) return { erro: "Pessoa não encontrada neste condomínio." };
      r = await enfileirarAvisoPessoa({ organizacaoId: u.organizacao.id, pessoaId, texto: mensagem, categoria: "aviso", criadoPorUsuarioId: u.id });
    } else {
      const papeis = destino === "todos" ? [...PAPEIS] : destino.startsWith("papel:") ? [destino.slice(6) as PapelPessoa] : [];
      if (papeis.length === 0 || !papeis.every((p) => (PAPEIS as readonly string[]).includes(p))) return { erro: "Escolha o destino." };
      r = await enfileirarAvisoPapel({ organizacaoId: u.organizacao.id, condominioId: cond.id, papeis, texto: mensagem, categoria: "aviso", criadoPorUsuarioId: u.id });
    }
    const cliente = clienteDoAmbiente();
    let enviados = 0;
    let erros = 0;
    if (cliente && r.enfileirados > 0) {
      const fila = await processarFilaEnvios({ cliente, organizacaoId: u.organizacao.id, prazoMs: 20000 });
      enviados = fila.enviados;
      erros = fila.erros;
    }
    atualizar();
    const partes = [`${r.enfileirados} na fila`];
    if (cliente) partes.push(`${enviados} enviado(s)`);
    else partes.push("Telegram não configurado: a fila espera a conexão");
    if (erros) partes.push(`${erros} com erro`);
    if (r.semVinculo) partes.push(`${r.semVinculo} sem Telegram vinculado`);
    if (r.bloqueados) partes.push(`${r.bloqueados} bloquearam o bot`);
    if (r.enfileirados === 0 && r.semVinculo + r.bloqueados === 0) return { erro: "Ninguém com esse perfil neste condomínio." };
    return { ok: `Aviso registrado: ${partes.join(", ")}.` };
  } catch (e) {
    return { erro: mensagemErro(e) };
  }
}

export async function enviarFilaAgora(_prev?: EstadoAcao, _form?: FormData): Promise<EstadoAcao> {
  const u = await exigirPermissao("enviar_avisos");
  const cliente = clienteDoAmbiente();
  if (!cliente) return { erro: "Conecte o Telegram na página Integrações." };
  const r = await processarFilaEnvios({ cliente, organizacaoId: u.organizacao.id, prazoMs: 25000 });
  atualizar();
  return { ok: `${r.enviados} enviado(s), ${r.erros} com erro, ${r.adiados} adiado(s), ${r.restantes} ainda na fila.` };
}

/* ----------------------------- Webhook ----------------------------- */

export async function ativarWebhook(_prev?: EstadoAcao, _form?: FormData): Promise<EstadoAcao> {
  await exigirPermissao("gerenciar_integracoes");
  const cliente = clienteDoAmbiente();
  if (!cliente) return { erro: "Conecte o Telegram na página Integrações." };
  const base = appUrlEhLocal() ? origemPublica(await headers()) : appUrl();
  if (!base.startsWith("https://")) {
    return { erro: "O Telegram só entrega em endereço público com https. Neste computador, use o modo local de escuta (polling)." };
  }
  try {
    await cliente.setWebhook({
      url: `${base}/api/telegram/webhook`,
      secret_token: segredoWebhookTelegram(),
      allowed_updates: UPDATES_PERMITIDOS,
      max_connections: 10,
    });
    await cliente.setMyCommands({ commands: montarRoteador().comandosParaMenu() });
  } catch (e) {
    return { erro: mensagemErro(e) };
  }
  atualizar();
  return { ok: `Webhook ativado em ${base}/api/telegram/webhook.` };
}

export async function removerWebhook(_prev?: EstadoAcao, _form?: FormData): Promise<EstadoAcao> {
  await exigirPermissao("gerenciar_integracoes");
  const cliente = clienteDoAmbiente();
  if (!cliente) return { erro: "Conecte o Telegram na página Integrações." };
  try {
    await cliente.deleteWebhook(false);
  } catch (e) {
    return { erro: mensagemErro(e) };
  }
  atualizar();
  return { ok: "Webhook removido. O bot volta a receber mensagens só pelo modo local de escuta (polling)." };
}
