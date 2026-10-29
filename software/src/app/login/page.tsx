import type { Metadata } from "next";
import { LayoutAcesso } from "@/components/acesso-layout";
import { FormularioLogin } from "@/features/auth/formularios";

export const metadata: Metadata = { title: "Entrar" };

export default async function PaginaLogin({ searchParams }: { searchParams: Promise<{ proximo?: string }> }) {
  const { proximo } = await searchParams;
  return <LayoutAcesso titulo="Bom ter você por aqui." descricao="Acesse sua conta para acompanhar o que acontece nos seus condomínios."><FormularioLogin proximo={proximo} /></LayoutAcesso>;
}
