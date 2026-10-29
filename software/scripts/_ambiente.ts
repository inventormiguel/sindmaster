/**
 * Carrega o .env.local (e os outros .env do Next) nos scripts de linha de comando.
 * Importe este arquivo antes de qualquer outro módulo do sistema.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production", { info: () => {}, error: console.error });
