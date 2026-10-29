import Link from "next/link";
import type { Metadata } from "next";
import { Logotipo } from "@/components/logo";
import { FormularioCadastro } from "@/features/auth/formularios";

export const metadata: Metadata = { title: "Criar conta" };

export default function PaginaCadastro() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <Link href="/" className="mb-6 flex justify-center">
          <Logotipo />
        </Link>
        <div className="rounded-2xl border border-borda bg-superficie p-6 shadow-sm">
          <h1 className="mb-1 text-xl font-semibold">Criar conta</h1>
          <p className="mb-6 text-sm text-suave">Uma conta para a sua administradora ou para você, síndico(a). Ela começa vazia.</p>
          <FormularioCadastro />
        </div>
      </div>
    </main>
  );
}
