"use client";

import { useState } from "react";
import { Campo, Rotulo, Selecao } from "@/components/ui";
import { DIAS, MESES, PERIODICIDADES, type Periodicidade } from "./periodicidade";

export function CamposPeriodicidade() {
  const [periodicidade, setPeriodicidade] = useState<Periodicidade>("diaria");
  const porSemana = periodicidade === "diaria" || periodicidade === "semanal";
  return (
    <>
      <div>
        <Rotulo htmlFor="periodicidade">Periodicidade</Rotulo>
        <Selecao id="periodicidade" name="periodicidade" value={periodicidade} onChange={(e) => setPeriodicidade(e.target.value as Periodicidade)}>
          {Object.entries(PERIODICIDADES).map(([valor, rotulo]) => <option key={valor} value={valor}>{rotulo}</option>)}
        </Selecao>
      </div>
      {porSemana ? (
        <fieldset className="md:col-span-2">
          <legend className="mb-1 text-sm font-medium">Dias da semana</legend>
          <div className="flex flex-wrap gap-3 text-sm">
            {DIAS.map((d, i) => <label key={d} className="flex items-center gap-1"><input type="checkbox" name="dias" value={i} defaultChecked={i >= 1 && i <= 6} /> {d}</label>)}
          </div>
        </fieldset>
      ) : (
        <>
          <div>
            <Rotulo htmlFor="diaMes">Dia do mês</Rotulo>
            <Campo id="diaMes" name="diaMes" type="number" min={1} max={31} defaultValue={1} required aria-describedby="regra-dia-mes" />
          </div>
          {periodicidade !== "mensal" ? <div>
            <Rotulo htmlFor="mesReferencia">{periodicidade === "anual" ? "Mês do ano" : "Mês de referência"}</Rotulo>
            <Selecao id="mesReferencia" name="mesReferencia" defaultValue="1" required>
              {MESES.map((mes, i) => <option key={mes} value={i + 1}>{mes}</option>)}
            </Selecao>
            {periodicidade === "trimestral" ? <p className="mt-1 text-xs text-suave">A cada três meses. Ex.: janeiro, abril, julho e outubro.</p> : null}
          </div> : null}
          <p id="regra-dia-mes" className="text-xs text-suave md:col-span-2">Nos meses mais curtos, o item fica para o último dia do mês.</p>
        </>
      )}
    </>
  );
}
