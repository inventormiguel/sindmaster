import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { db } from "@/db";
import { migrarBanco } from "@/db/migrar";
import { condominios, organizacoes, pessoas, type PapelPessoa } from "@/db/schema";
import type { Saida } from "@/lib/telegram/roteador";
import type { TgUpdate } from "@/lib/telegram/tipos";

/** Cada arquivo de teste tem o próprio banco PGlite em memória e a própria pasta de dados. */
export async function prepararBanco() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "teste-condominio-"));
  process.env.DATA_DIR = dir;
  process.env.UPLOADS_DIR = path.join(dir, "uploads");
  await migrarBanco();
}

export async function criarCenario(nomeOrg = "Administradora Teste") {
  const [org] = await db.insert(organizacoes).values({ nome: nomeOrg, tipo: "administradora" }).returning();
  const [cond] = await db.insert(condominios).values({ organizacaoId: org.id, nome: `Condomínio de ${nomeOrg}` }).returning();
  const nova = async (nome: string, papel: PapelPessoa, extra: Partial<typeof pessoas.$inferInsert> = {}) => {
    const [p] = await db.insert(pessoas).values({ organizacaoId: org.id, condominioId: cond.id, nome, papel, ...extra }).returning();
    return p;
  };
  return { org, cond, nova };
}

export type Enviada = { chatId: number; texto: string; teclado?: unknown };

/** Saída em memória: guarda o que o bot "responderia" (o envio real é testado no cliente da API). */
export function saidaDeTeste(arquivo?: Uint8Array) {
  const enviadas: Enviada[] = [];
  const botoes: { id: string; texto?: string }[] = [];
  const editadas: Enviada[] = [];
  let proximoId = 1000;
  const saida: Saida = {
    async enviarTexto(destino, texto, opcoes) {
      enviadas.push({ chatId: destino.chatId, texto, teclado: opcoes?.teclado });
      return { messageId: proximoId++ };
    },
    async responderBotao(id, texto) {
      botoes.push({ id, texto });
    },
    async editarTexto(chatId, _messageId, texto) {
      editadas.push({ chatId, texto });
    },
    async enviarArquivo(destino, arquivo, legenda) {
      enviadas.push({ chatId: destino.chatId, texto: `[arquivo ${arquivo.nome}] ${legenda ?? ""}` });
      return { messageId: proximoId++ };
    },
    async baixarArquivo() {
      const bytes = arquivo ?? new Uint8Array([1, 2, 3]);
      return { bytes, caminho: "photos/x.jpg", tamanho: bytes.byteLength };
    },
  };
  return { saida, enviadas, botoes, editadas };
}

let contadorUpdate = 1;
export function mensagem(chatId: number, texto: string, extra: Record<string, unknown> = {}): TgUpdate {
  return {
    update_id: contadorUpdate++,
    message: {
      message_id: contadorUpdate,
      date: Math.floor(Date.now() / 1000),
      chat: { id: chatId, type: "private", first_name: "Teste" },
      from: { id: chatId, is_bot: false, first_name: "Teste", username: `user${chatId}` },
      text: texto,
      ...extra,
    },
  };
}

export function toqueBotao(chatId: number, dados: string): TgUpdate {
  return {
    update_id: contadorUpdate++,
    callback_query: {
      id: `cb${contadorUpdate}`,
      from: { id: chatId, is_bot: false, first_name: "Teste" },
      data: dados,
      message: { message_id: 55, date: 0, chat: { id: chatId, type: "private" } },
    },
  };
}
