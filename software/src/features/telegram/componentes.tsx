"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Aviso, AreaTexto, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { adicionarPessoa, enviarAviso, gerarConvite, type EstadoAcao, type EstadoConvite } from "./acoes";

type Condominio = { id: string; nome: string };
type PessoaOpcao = { id: string; nome: string; condominioId: string; vinculada: boolean };

const ROTULOS_PAPEL = [
  ["sindico", "Síndico(a)"],
  ["funcionario", "Funcionário(a)"],
  ["morador", "Morador(a)"],
  ["prestador", "Prestador(a) de serviço"],
] as const;

/** Botão que chama uma ação de servidor e mostra o resultado ao lado. */
export function BotaoAcao({
  acao,
  rotulo,
  pendenteRotulo,
  variante = "secundario",
}: {
  acao: (prev: EstadoAcao, form: FormData) => Promise<EstadoAcao>;
  rotulo: string;
  pendenteRotulo?: string;
  variante?: "primario" | "secundario" | "perigo";
}) {
  const [estado, executar, pendente] = useActionState<EstadoAcao, FormData>(acao, null);
  return (
    <form action={executar} className="flex flex-wrap items-center gap-2">
      <Botao type="submit" variante={variante} tamanho="sm" disabled={pendente}>
        {pendente ? (pendenteRotulo ?? "Aguarde…") : rotulo}
      </Botao>
      {estado?.erro ? <span className="text-xs text-perigo">{estado.erro}</span> : null}
      {estado?.ok ? <span className="text-xs text-emerald-700">{estado.ok}</span> : null}
    </form>
  );
}

export function FormularioPessoa({ condominios }: { condominios: Condominio[] }) {
  const [estado, acao, pendente] = useActionState<EstadoAcao, FormData>(adicionarPessoa, null);
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) ref.current?.reset();
  }, [estado]);
  if (condominios.length === 0) return <Aviso tom="amarelo">Cadastre um condomínio antes de adicionar pessoas.</Aviso>;
  return (
    <form ref={ref} action={acao} className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <Rotulo htmlFor="p-cond">Condomínio</Rotulo>
        <Selecao id="p-cond" name="condominioId" defaultValue={condominios[0]?.id}>
          {condominios.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </Selecao>
      </div>
      <div className="sm:col-span-2">
        <Rotulo htmlFor="p-nome">Nome</Rotulo>
        <Campo id="p-nome" name="nome" required />
      </div>
      <div>
        <Rotulo htmlFor="p-papel">Perfil</Rotulo>
        <Selecao id="p-papel" name="papel" defaultValue="morador">
          {ROTULOS_PAPEL.map(([v, r]) => (
            <option key={v} value={v}>
              {r}
            </option>
          ))}
        </Selecao>
      </div>
      <div>
        <Rotulo htmlFor="p-unidade">Unidade (opcional)</Rotulo>
        <Campo id="p-unidade" name="unidade" placeholder="Bloco A – 101" />
      </div>
      <div className="sm:col-span-2">
        <Rotulo htmlFor="p-tel">Telefone (opcional)</Rotulo>
        <Campo id="p-tel" name="telefone" inputMode="tel" />
      </div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3">
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Adicionar pessoa"}
        </Botao>
        {estado?.erro ? <span className="text-sm text-perigo">{estado.erro}</span> : null}
        {estado?.ok ? <span className="text-sm text-emerald-700">{estado.ok}</span> : null}
      </div>
    </form>
  );
}

/** Gera o convite de uma pessoa: mostra o link e o QR code uma única vez. */
export function GerarConvite({ pessoaId, desabilitado }: { pessoaId: string; desabilitado?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoConvite, FormData>(gerarConvite, null);
  const [copiado, setCopiado] = useState(false);
  if (desabilitado) {
    return (
      <Botao type="button" variante="secundario" tamanho="sm" disabled title={desabilitado}>
        Conectar Telegram
      </Botao>
    );
  }
  return (
    <div className="min-w-0">
      <form action={acao} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="pessoaId" value={pessoaId} />
        <Selecao name="validadeHoras" defaultValue="72" className="!w-auto !py-1 text-xs" aria-label="Validade do convite">
          <option value="24">vale 24 h</option>
          <option value="72">vale 3 dias</option>
          <option value="168">vale 7 dias</option>
        </Selecao>
        <Botao type="submit" tamanho="sm" disabled={pendente}>
          {pendente ? "Gerando…" : estado?.convite ? "Gerar outro" : "Gerar convite"}
        </Botao>
      </form>
      {estado?.erro ? <p className="mt-2 text-xs text-perigo">{estado.erro}</p> : null}
      {estado?.convite ? (
        <div className="mt-3 flex flex-wrap gap-4 rounded-lg border border-primaria/30 bg-primaria-clara/30 p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={estado.convite.qr} alt="QR code do convite" width={140} height={140} className="rounded bg-white" />
          <div className="min-w-0 flex-1 text-xs">
            <p className="font-medium text-tinta">Convite de {estado.convite.pessoa}</p>
            <p className="mt-1 text-suave">
              Uso único, vale até {new Date(estado.convite.expiraEm).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}. O link aparece só agora: copie e envie à pessoa.
            </p>
            <p className="mt-2 break-all rounded bg-white px-2 py-1 font-mono">{estado.convite.link}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Botao
                type="button"
                variante="secundario"
                tamanho="sm"
                onClick={async () => {
                  await navigator.clipboard.writeText(estado.convite!.link);
                  setCopiado(true);
                }}
              >
                {copiado ? "Copiado" : "Copiar link"}
              </Botao>
              <a href={estado.convite.link} target="_blank" rel="noopener noreferrer" className="inline-flex items-center px-2 text-xs font-medium text-primaria hover:underline">
                Abrir no Telegram
              </a>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function FormularioAviso({ condominios, pessoas, desabilitado }: { condominios: Condominio[]; pessoas: PessoaOpcao[]; desabilitado?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoAcao, FormData>(enviarAviso, null);
  const [condominioId, setCondominioId] = useState(condominios[0]?.id ?? "");
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (estado?.ok) (ref.current?.elements.namedItem("texto") as HTMLTextAreaElement | null)?.form?.reset();
  }, [estado]);
  if (condominios.length === 0) return <Aviso tom="amarelo">Cadastre um condomínio antes.</Aviso>;
  const doCondominio = pessoas.filter((p) => p.condominioId === condominioId);
  return (
    <form ref={ref} action={acao} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Rotulo htmlFor="a-cond">Condomínio</Rotulo>
          <Selecao id="a-cond" name="condominioId" value={condominioId} onChange={(e) => setCondominioId(e.target.value)}>
            {condominios.map((c) => (
              <option key={c.id} value={c.id}>
                {c.nome}
              </option>
            ))}
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="a-dest">Para</Rotulo>
          <Selecao id="a-dest" name="destino" defaultValue="papel:morador">
            <optgroup label="Por perfil">
              <option value="todos">Todos do condomínio</option>
              {ROTULOS_PAPEL.map(([v, r]) => (
                <option key={v} value={`papel:${v}`}>
                  Todos: {r}
                </option>
              ))}
            </optgroup>
            <optgroup label="Uma pessoa">
              {doCondominio.map((p) => (
                <option key={p.id} value={`pessoa:${p.id}`}>
                  {p.nome}
                  {p.vinculada ? "" : " (sem Telegram)"}
                </option>
              ))}
            </optgroup>
          </Selecao>
        </div>
      </div>
      <div>
        <Rotulo htmlFor="a-texto">Mensagem</Rotulo>
        <AreaTexto id="a-texto" name="texto" rows={3} maxLength={4096} required placeholder="Ex.: A limpeza da caixa d'água será na terça, das 8h às 12h." />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Botao type="submit" disabled={pendente || !!desabilitado} title={desabilitado}>
          {desabilitado ? "Conectar Telegram" : pendente ? "Enviando…" : "Enviar aviso"}
        </Botao>
        {estado?.erro ? <span className="text-sm text-perigo">{estado.erro}</span> : null}
        {estado?.ok ? <span className="text-sm text-emerald-700">{estado.ok}</span> : null}
      </div>
      <p className="text-xs text-suave">Cada pessoa recebe a mensagem individualmente, sem ver quem mais recebeu.</p>
    </form>
  );
}
