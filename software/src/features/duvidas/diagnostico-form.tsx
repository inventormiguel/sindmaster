"use client";

import { useActionState } from "react";
import { Aviso, Botao, Campo, Cartao, Selo } from "@/components/ui";
import { rodarDiagnostico, type EstadoDiagnostico } from "./diagnostico";

const SUGERIDAS = ["Até que horas pode fazer obra?", "Pode ter cachorro?", "Quando abre a piscina?", "Como agendar mudança?", "Pode guardar coisa na vaga?"];

export function FormDiagnostico({ c }: { c: string }) {
  const [estado, acao, pendente] = useActionState<EstadoDiagnostico, FormData>(rodarDiagnostico, null);
  const ok = estado?.resultados?.filter((r) => r.achou).length ?? 0;
  return (
    <div className="space-y-6">
      <form action={acao} className="space-y-2">
        <input type="hidden" name="c" value={c} />
        {SUGERIDAS.map((s) => (
          <Campo key={s} name="pergunta" defaultValue={s} />
        ))}
        <Botao type="submit" disabled={pendente}>
          {pendente ? "Perguntando…" : "Perguntar aos documentos"}
        </Botao>
      </form>
      {estado?.erro ? <Aviso tom="vermelho">{estado.erro}</Aviso> : null}
      {estado?.resultados ? (
        <>
          <Aviso tom="verde">{`${ok} de ${estado.resultados.length} perguntas respondidas pelos documentos, com o artigo. Nada foi gravado.`}</Aviso>
          {estado.resultados.map((r) => (
            <Cartao key={r.pergunta}>
              <p className="font-medium">
                {r.pergunta} <Selo tom={r.achou ? "verde" : "amarelo"}>{r.achou ? "respondida" : "iria para você"}</Selo>
              </p>
              <p className="mt-2 whitespace-pre-line text-sm text-suave">{r.texto}</p>
            </Cartao>
          ))}
        </>
      ) : null}
    </div>
  );
}
