import type { Metadata } from "next";
import { LayoutAcesso } from "@/components/acesso-layout";
import { FormularioCadastro } from "@/features/auth/formularios";

export const metadata: Metadata = { title: "Criar conta" };

export default function PaginaCadastro() {
  return <LayoutAcesso titulo="Uma gestão mais clara começa aqui." descricao="Crie sua conta de síndico ou administradora. Depois, cadastre o primeiro condomínio."><FormularioCadastro /></LayoutAcesso>;
}
