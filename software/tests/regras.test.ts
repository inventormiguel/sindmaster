import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { montarCorpo } from "@/lib/ia/anthropic";
import { BRAND } from "@/lib/brand";
import { origemPublica } from "@/lib/url-publica";
import { normalizarEmail } from "@/lib/auth/senha";

const raiz = path.resolve(__dirname, "..");

function arquivosDoProjeto(): string[] {
  const saida = execSync("git ls-files --cached --others --exclude-standard", { cwd: raiz, encoding: "utf8" });
  return saida.split("\n").filter((f) => f && !f.startsWith("tests/") && !f.endsWith("package-lock.json") && fs.existsSync(path.join(raiz, f)));
}

describe("regras do projeto", () => {
  it("a chamada da IA nunca leva temperature, top_p nem top_k", () => {
    const corpo = montarCorpo("claude-haiku-5-5", { mensagens: [{ role: "user", content: "oi" }], maxTokens: 10, system: "s" });
    expect(Object.keys(corpo).sort()).toEqual(["max_tokens", "messages", "model", "output_config", "system"]);
    expect(corpo).toMatchObject({ max_tokens: 10 + 2048, output_config: { effort: "low" } });
    const reserva = montarCorpo("claude-haiku-4-5-20251001", { mensagens: [{ role: "user", content: "oi" }], maxTokens: 10 });
    expect(Object.keys(reserva).sort()).toEqual(["max_tokens", "messages", "model"]);
  });

  it(".env.example não tem chave nem token", () => {
    const t = fs.readFileSync(path.join(raiz, ".env.example"), "utf8");
    expect(t).not.toMatch(/sk-ant/);
    expect(t).not.toMatch(/\d{6,}:[A-Za-z0-9_-]{30,}/);
    expect(t).toMatch(/^ANTHROPIC_API_KEY=$/m);
    expect(t).toMatch(/^TELEGRAM_BOT_TOKEN=$/m);
  });

  it("o nome exibido pelo sistema fica centralizado em src/lib/brand.ts", () => {
    // A documentação pode mencionar o produto; o código deve usar BRAND.nome.
    const comNome = arquivosDoProjeto().filter((f) => f.startsWith("src/") && /\.(ts|tsx|css|json)$/.test(f) && fs.readFileSync(path.join(raiz, f), "utf8").includes(BRAND.nome));
    expect(comNome).toEqual(["src/lib/brand.ts"]);
  });

  it("sem CNPJ proibido, sem WhatsApp e sem new URL(..., req.url)", () => {
    const proibidos = ["12.345.678/0001-95", "11.222.333/0001-81", "00.000.000/0001-91", "48.372.615/0001-75", "47.039.158/0001-39"];
    for (const f of arquivosDoProjeto()) {
      const t = fs.readFileSync(path.join(raiz, f), "utf8");
      for (const c of proibidos) expect(t, f).not.toContain(c);
      expect(t, f).not.toMatch(/whats ?app|wa\.me/i);
      expect(t, f).not.toMatch(/new URL\([^)]*req\.url/);
    }
  });

  it("User-Agent é só o identificador do sistema (sem e-mail)", () => {
    expect(BRAND.userAgent).toMatch(/^[A-Za-z0-9]+\/[\d.]+$/);
  });

  it("endereço público respeita o proxy", () => {
    const h = new Headers({ host: "interno:3241", "x-forwarded-host": "condominio.exemplo.com.br", "x-forwarded-proto": "https" });
    expect(origemPublica(h)).toBe("https://condominio.exemplo.com.br");
    expect(origemPublica(new Headers({ host: "localhost:3241" }))).toBe("http://localhost:3241");
  });

  it("e-mail do login é normalizado (sem acento, minúsculas, sem espaços)", () => {
    expect(normalizarEmail(" Demonstração@InventorMiguel.com ")).toBe(BRAND.demo.email);
  });
});
