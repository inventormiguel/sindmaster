import { notFound } from "next/navigation";
import { Hammer } from "lucide-react";
import { itemPorRota } from "@/config/navegacao";
import { exigirUsuario } from "@/lib/auth/sessao";
import { Cartao } from "@/components/ui";

/**
 * Página genérica dos módulos "em construção" listados em src/config/navegacao.ts.
 * Quando o módulo existir, crie src/app/app/<rota>/page.tsx: ela tem prioridade sobre esta.
 */
export default async function ModuloEmConstrucao({ params }: { params: Promise<{ modulo: string }> }) {
  await exigirUsuario();
  const { modulo } = await params;
  const item = itemPorRota(`/app/${modulo}`);
  if (!item || item.status !== "em_construcao") notFound();
  return (
    <div className="mx-auto max-w-2xl pt-10">
      <Cartao className="text-center">
        <Hammer className="mx-auto h-8 w-8 text-destaque" aria-hidden />
        <h1 className="mt-3 text-xl font-semibold">{item.rotulo}</h1>
        <p className="mt-1 text-sm font-medium text-destaque">Em construção</p>
        {item.descricao ? <p className="mt-3 text-sm text-suave">{item.descricao}</p> : null}
        <p className="mt-4 text-sm text-suave">Este módulo ainda não está disponível nesta versão.</p>
      </Cartao>
    </div>
  );
}
