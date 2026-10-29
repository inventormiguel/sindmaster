"use client";

import Link from "next/link";
import { useActionState, useRef } from "react";
import { BRAND } from "@/lib/brand";
import { Aviso, Botao, Campo, Rotulo, Selecao } from "@/components/ui";
import { cadastrar, entrar, type EstadoForm } from "./acoes";

/** Caixa "Entrar como demonstração": só no login e no cadastro. */
function CaixaDemonstracao({ aoPreencher, aoEntrar }: { aoPreencher?: () => void; aoEntrar?: () => void }) {
  return (
    <div className="rounded-xl border border-primaria/30 bg-primaria-clara/40 p-4">
      <p className="text-sm font-semibold text-tinta">Entrar como demonstração</p>
      <p className="mt-1 text-sm text-suave">
        E-mail: <span className="font-mono">{BRAND.demo.email}</span>
        <br />
        Senha: <span className="font-mono">{BRAND.demo.senha}</span>
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {aoPreencher ? (
          <Botao type="button" variante="secundario" tamanho="sm" onClick={aoPreencher}>
            Preencher
          </Botao>
        ) : null}
        {aoEntrar ? (
          <Botao type="button" tamanho="sm" onClick={aoEntrar}>
            Entrar na demonstração
          </Botao>
        ) : null}
      </div>
    </div>
  );
}

export function FormularioLogin({ proximo }: { proximo?: string }) {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(entrar, null);
  const formRef = useRef<HTMLFormElement>(null);
  const preencher = () => {
    const f = formRef.current;
    if (!f) return;
    (f.elements.namedItem("email") as HTMLInputElement).value = BRAND.demo.email;
    (f.elements.namedItem("senha") as HTMLInputElement).value = BRAND.demo.senha;
  };
  return (
    <div className="space-y-6">
      <form ref={formRef} action={acao} className="space-y-4">
        <input type="hidden" name="proximo" value={proximo ?? "/app"} />
        <div>
          <Rotulo htmlFor="email">E-mail</Rotulo>
          <Campo id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Rotulo htmlFor="senha">Senha</Rotulo>
          <Campo id="senha" name="senha" type="password" autoComplete="current-password" required />
        </div>
        {estado?.erro ? <Aviso tom="vermelho">{estado.erro}</Aviso> : null}
        <Botao type="submit" className="w-full" disabled={pendente}>
          {pendente ? "Entrando…" : "Entrar"}
        </Botao>
      </form>
      <CaixaDemonstracao
        aoPreencher={preencher}
        aoEntrar={() => {
          preencher();
          formRef.current?.requestSubmit();
        }}
      />
      <p className="text-center text-sm text-suave">
        Ainda não tem conta?{" "}
        <Link href="/cadastro" className="font-medium text-primaria hover:underline">
          Criar conta
        </Link>
      </p>
    </div>
  );
}

export function FormularioCadastro() {
  const [estado, acao, pendente] = useActionState<EstadoForm, FormData>(cadastrar, null);
  const [estadoDemo, acaoDemo, pendenteDemo] = useActionState<EstadoForm, FormData>(entrar, null);
  const demoRef = useRef<HTMLFormElement>(null);
  return (
    <div className="space-y-6">
      <form action={acao} className="space-y-4">
        <div>
          <Rotulo htmlFor="nome">Seu nome</Rotulo>
          <Campo id="nome" name="nome" autoComplete="name" required />
        </div>
        <div>
          <Rotulo htmlFor="tipo">Você é</Rotulo>
          <Selecao id="tipo" name="tipo" defaultValue="administradora">
            <option value="administradora">Administradora de condomínios</option>
            <option value="sindico_profissional">Síndico(a) profissional</option>
            <option value="sindico_morador">Síndico(a) morador(a)</option>
          </Selecao>
        </div>
        <div>
          <Rotulo htmlFor="conta">Nome da administradora ou do síndico</Rotulo>
          <Campo id="conta" name="conta" required placeholder="Ex.: Administradora Bom Lar" />
        </div>
        <div>
          <Rotulo htmlFor="email">E-mail</Rotulo>
          <Campo id="email" name="email" type="email" autoComplete="email" required />
        </div>
        <div>
          <Rotulo htmlFor="senha">Senha (mínimo 6 caracteres)</Rotulo>
          <Campo id="senha" name="senha" type="password" autoComplete="new-password" required minLength={6} />
        </div>
        {estado?.erro ? <Aviso tom="vermelho">{estado.erro}</Aviso> : null}
        <Botao type="submit" className="w-full" disabled={pendente}>
          {pendente ? "Criando…" : "Criar conta"}
        </Botao>
      </form>

      <form ref={demoRef} action={acaoDemo} className="hidden">
        <input type="hidden" name="email" value={BRAND.demo.email} />
        <input type="hidden" name="senha" value={BRAND.demo.senha} />
        <button type="submit">Entrar na demonstração</button>
      </form>
      <CaixaDemonstracao aoEntrar={() => demoRef.current?.requestSubmit()} />
      {pendenteDemo ? <p className="text-center text-sm text-suave">Entrando na demonstração…</p> : null}
      {estadoDemo?.erro ? <Aviso tom="vermelho">{estadoDemo.erro}</Aviso> : null}
      <p className="text-center text-sm text-suave">
        Já tem conta?{" "}
        <Link href="/login" className="font-medium text-primaria hover:underline">
          Entrar
        </Link>
      </p>
    </div>
  );
}
