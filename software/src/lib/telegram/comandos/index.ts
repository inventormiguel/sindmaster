import { criarRoteador, type Roteador } from "../roteador";
import { registrarComandosBase } from "./base";
import { registrarArquivos } from "./arquivos";
import { registrarMensagemLivrePadrao } from "./mensagem-livre";
import { registrarSindico } from "./sindico";
import { registrarChamados } from "./chamados";
import { registrarMorador } from "./morador";
import { registrarRotina } from "./rotina";
import { registrarPrestador } from "./prestador";
import { registrarDestinoArquivo } from "./destino";

/**
 * Monta o roteador do bot com todos os módulos.
 * Para um módulo novo (chamados, vencimentos, documentos…): crie
 * `comandos/<modulo>.ts` com uma função `registrar<Modulo>(roteador)` e chame aqui.
 */
export function montarRoteador(): Roteador {
  const roteador = criarRoteador();
  registrarComandosBase(roteador);
  registrarArquivos(roteador);
  registrarSindico(roteador);
  registrarChamados(roteador);
  registrarMorador(roteador);
  registrarRotina(roteador);
  registrarPrestador(roteador);
  registrarDestinoArquivo(roteador);
  registrarMensagemLivrePadrao(roteador); // sempre por último: é o tratador padrão
  return roteador;
}

let roteadorDoProcesso: Roteador | null = null;
export function roteadorPadrao(): Roteador {
  if (!roteadorDoProcesso) roteadorDoProcesso = montarRoteador();
  return roteadorDoProcesso;
}
