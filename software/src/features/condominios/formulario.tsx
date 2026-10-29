"use client";

import { useActionState, useRef, useState } from "react";
import { Aviso, Botao, Campo, Rotulo } from "@/components/ui";
import { criarCondominio, type EstadoCondominio } from "./acoes";
import { CamposUnidades } from "./campos-unidades";

export function FormularioCondominio() {
  const ref = useRef<HTMLFormElement>(null);
  const [versaoUnidades, setVersaoUnidades] = useState(0);
  const [estado, acao, pendente] = useActionState<EstadoCondominio, FormData>(async (anterior, form) => {
    const resultado = await criarCondominio(anterior, form);
    if (resultado?.ok) {
      ref.current?.reset();
      setVersaoUnidades((versao) => versao + 1);
    }
    return resultado;
  }, null);
  return (
    <form ref={ref} action={acao} className="grid gap-4 md:grid-cols-2">
      <div className="md:col-span-2">
        <Rotulo htmlFor="nome">Nome do condomínio</Rotulo>
        <Campo id="nome" name="nome" required />
      </div>
      <div>
        <Rotulo htmlFor="cnpj">CNPJ (opcional, consultado na BrasilAPI)</Rotulo>
        <Campo id="cnpj" name="cnpj" inputMode="numeric" placeholder="00.000.000/0000-00" />
      </div>
      <div>
        <Rotulo htmlFor="cep">CEP (opcional, ViaCEP)</Rotulo>
        <Campo id="cep" name="cep" inputMode="numeric" placeholder="00000-000" />
      </div>
      <div className="md:col-span-2">
        <Rotulo htmlFor="endereco">Endereço (opcional)</Rotulo>
        <Campo id="endereco" name="endereco" />
      </div>
      <div>
        <Rotulo htmlFor="cidade">Município</Rotulo>
        <Campo id="cidade" name="cidade" />
      </div>
      <div>
        <Rotulo htmlFor="uf">UF</Rotulo>
        <Campo id="uf" name="uf" maxLength={2} placeholder="PR" />
      </div>
      <CamposUnidades key={versaoUnidades} />
      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Salvando…" : "Criar condomínio"}
        </Botao>
        {estado?.erro ? <Aviso tom="vermelho">{estado.erro}</Aviso> : null}
        {estado?.ok ? <Aviso tom="verde">{estado.ok}</Aviso> : null}
      </div>
    </form>
  );
}
