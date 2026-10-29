import type { Metadata } from "next";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { FormDiagnostico } from "@/features/duvidas/diagnostico-form";
import { Aviso, CabecalhoPagina } from "@/components/ui";
import { SemCondominio } from "@/components/negocio";

export const metadata: Metadata = { title: "Diagnóstico" };

export default async function Diagnostico({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  if (!gestao) return <Aviso tom="amarelo">Diagnóstico fica com o síndico.</Aviso>;
  return (
    <>
      <CabecalhoPagina titulo="Diagnóstico em 5 minutos" descricao={`Perguntas comuns respondidas com o regimento e a convenção do ${condominio.nome}, com a citação literal. Nada é gravado (só o uso da IA).`} />
      <FormDiagnostico c={condominio.id} />
    </>
  );
}
