import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: `${BRAND.nome} · ${BRAND.descricao}`, template: `%s · ${BRAND.nome}` },
  description: BRAND.slogan,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className="h-full antialiased" style={{
      "--cor-primaria": BRAND.cores.primaria,
      "--cor-primaria-escura": BRAND.cores.primariaEscura,
      "--cor-primaria-clara": BRAND.cores.primariaClara,
      "--cor-destaque": BRAND.cores.destaque,
      "--cor-tinta": BRAND.cores.tinta,
      "--cor-texto-suave": BRAND.cores.suave,
      "--cor-fundo": BRAND.cores.fundo,
      "--cor-superficie": BRAND.cores.superficie,
      "--cor-borda": BRAND.cores.borda,
      "--cor-navegacao": BRAND.cores.navegacao,
      "--cor-verde": BRAND.cores.verde,
      "--cor-perigo": BRAND.cores.perigo,
    } as CSSProperties}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
