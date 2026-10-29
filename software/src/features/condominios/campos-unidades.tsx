"use client";

import { useState } from "react";
import { AreaTexto, Aviso, Campo, Rotulo, Selecao } from "@/components/ui";
import { gerarUnidades, type TipoUnidade } from "./unidades";

export function CamposUnidades() {
  const [tipo, setTipo] = useState<TipoUnidade>("apartamentos");
  const [lista, setLista] = useState("");
  const [bloco, setBloco] = useState("");
  const [andares, setAndares] = useState("");
  const [porAndar, setPorAndar] = useState("");
  let unidades: ReturnType<typeof gerarUnidades> = [];
  let erro = "";
  try {
    unidades = gerarUnidades({ tipo, lista, bloco, andares, porAndar });
  } catch (e) {
    erro = e instanceof Error ? e.message : "Confira a lista de unidades.";
  }
  return (
    <div className="md:col-span-2 space-y-3">
      <div>
        <Rotulo htmlFor="tipoUnidade">Tipo de unidade</Rotulo>
        <Selecao id="tipoUnidade" name="tipoUnidade" value={tipo} onChange={(e) => setTipo(e.target.value as TipoUnidade)}>
          <option value="apartamentos">Apartamentos</option>
          <option value="casas">Casas (sem andar)</option>
        </Selecao>
      </div>
      <div>
        <Rotulo htmlFor="bloco">Bloco (opcional)</Rotulo>
        <Campo id="bloco" name="bloco" placeholder="Ex.: A" value={bloco} onChange={(e) => setBloco(e.target.value)} />
      </div>
      {tipo === "apartamentos" ? (
        <fieldset className="grid gap-3 rounded-lg border border-borda p-3 grid-cols-2">
          <legend className="px-1 text-sm font-medium">Gerar apartamentos por andar</legend>
          <div>
            <Rotulo htmlFor="andares">Andares</Rotulo>
            <Campo id="andares" name="andares" type="number" min={1} max={80} placeholder="12" value={andares} onChange={(e) => setAndares(e.target.value)} />
          </div>
          <div>
            <Rotulo htmlFor="porAndar">Por andar</Rotulo>
            <Campo id="porAndar" name="porAndar" type="number" min={1} max={30} placeholder="4" value={porAndar} onChange={(e) => setPorAndar(e.target.value)} />
          </div>
        </fieldset>
      ) : <p className="text-sm text-suave">Casas são cadastradas sem andar. Informe os números na lista abaixo.</p>}
      <div>
        <Rotulo htmlFor="listaUnidades">Lista ou intervalo de unidades</Rotulo>
        <AreaTexto id="listaUnidades" name="listaUnidades" rows={3} maxLength={40000} placeholder={tipo === "casas" ? "Casas de 1 a 14" : "101, 102, 103\nou A - 101\nou de 101 a 104"} value={lista} onChange={(e) => setLista(e.target.value)} aria-describedby="previaUnidades" aria-invalid={Boolean(erro)} />
        <p className="mt-1 text-xs text-suave">Aceita intervalos, vírgulas ou uma unidade por linha. A lista substitui o gerador por andar.</p>
      </div>
      <div id="previaUnidades" aria-live="polite">
        {erro ? <Aviso tom="vermelho">{erro}</Aviso> : unidades.length ? (
          <Aviso tom="verde">
            <strong>{unidades.length} unidade(s) serão criadas.</strong>
            <p className="mt-1 text-sm">{unidades.slice(0, 20).map((u) => `${u.bloco ? `${u.bloco}-` : ""}${u.numero}`).join(", ")}{unidades.length > 20 ? `… e mais ${unidades.length - 20}.` : "."}</p>
          </Aviso>
        ) : <p className="text-xs text-suave">Informe a numeração para criar as unidades junto com o condomínio.</p>}
      </div>
    </div>
  );
}
