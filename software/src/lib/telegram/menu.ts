import { clienteDoAmbiente } from "./api";
import type { Roteador, PessoaVinculada } from "./roteador";
import { permitido } from "./roteador";
import { vinculosDoChat } from "./vinculo";

/**
 * Menu do Telegram por papel (setMyCommands com escopo do chat): a lista do papel do
 * contexto atual, mais /condominio quando a conta tem 2 ou mais vínculos. Sem Telegram
 * configurado (testes, painel sem token), não faz nada.
 */
export function comandosDoMenu(roteador: Roteador, pessoa: PessoaVinculada | null, vinculos: number) {
  return roteador
    .comandosDisponiveis(pessoa)
    .filter((c) => c.nome !== "condominio" || vinculos > 1)
    .filter((c) => permitido(c.permissao, pessoa))
    .map((c) => ({ command: c.nome, description: c.descricao.slice(0, 256) }));
}

export async function atualizarMenuDoChat(roteador: Roteador, chatId: number, pessoa: PessoaVinculada | null) {
  const cliente = clienteDoAmbiente();
  if (!cliente) return;
  try {
    const vinculos = (await vinculosDoChat(chatId)).length;
    await cliente.setMyCommands({ commands: comandosDoMenu(roteador, pessoa, vinculos), scope: { type: "chat", chat_id: chatId } });
  } catch (e) {
    console.warn("[telegram] setMyCommands do chat falhou:", e instanceof Error ? e.message.slice(0, 120) : e);
  }
}
