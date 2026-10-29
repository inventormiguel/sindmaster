import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite carrega arquivos WASM do próprio pacote: não pode ser empacotado.
  serverExternalPackages: ["@electric-sql/pglite", "sharp"],
  // Upload de foto/PDF pelo painel (abaixo dos 4,5 MB do corpo da função na Vercel).
  experimental: { serverActions: { bodySizeLimit: "4.5mb" } },
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
