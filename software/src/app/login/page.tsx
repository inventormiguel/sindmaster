import Link from "next/link";
import type { Metadata } from "next";
import { Logotipo } from "@/components/logo";
import { FormularioLogin } from "@/features/auth/formularios";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const { proximo } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex justify-center">
          <Logotipo />
        </Link>
        <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold">Entrar</h1>
          <p className="mb-6 text-sm text-suave">Acesse o painel do seu condomínio.</p>
          <FormularioLogin proximo={proximo} />
        </div>
      </div>
    </main>
  );
}
