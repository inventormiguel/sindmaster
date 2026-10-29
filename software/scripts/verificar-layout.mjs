/**
 * Verificação de layout (Playwright, Chromium headless próprio): faz login com o usuário
 * de demonstração, abre as páginas a 1440, 1280 e 390 px, salva capturas em .layout/ e falha
 * se houver rolagem horizontal da página, botão/link/selo com conteúdo cortado, botão
 * fora do contêiner com overflow, ou página com erro.
 *
 * Uso: com o servidor no ar (npm run dev ou npm start), `npm run check:layout`.
 * Primeira vez: `npx playwright install chromium`.
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = (process.env.LAYOUT_BASE ?? "http://localhost:3241").replace(/\/+$/, "");
const LARGURAS = [1440, 1280, 390];
const PUBLICAS = ["/", "/login", "/cadastro"];
const PAINEL = [
  "/app",
  "/app/hoje",
  "/app/valor",
  "/app/chamados",
  "/app/chamados?aba=ocorrencias",
  "/app/rotinas",
  "/app/vencimentos",
  "/app/duvidas",
  "/app/duvidas?f=encaminhadas",
  "/app/despesas",
  "/app/despesas?f=lancada",
  "/app/condominios",
  "/app/unidades",
  "/app/equipe",
  "/app/prestadores",
  "/app/documentos",
  "/app/diagnostico",
  "/app/regras",
  "/app/telegram",
  "/app/integracoes",
  "/app/auditoria",
  "/app/lgpd",
];

fs.mkdirSync(".layout", { recursive: true });
const browser = await chromium.launch({ headless: true });
const problemas = [];

async function verificar(page, rota, largura) {
  const resp = await page.goto(BASE + rota, { waitUntil: "networkidle" });
  const status = resp?.status() ?? 0;
  if (status >= 400) problemas.push(`${rota} @${largura}: HTTP ${status}`);
  const erroNaTela = await page.locator("text=/Application error|Unhandled Runtime Error|This page couldn.t load/i").count();
  if (erroNaTela) problemas.push(`${rota} @${largura}: erro na página`);
  const achados = await page.evaluate(() => {
    const r = [];
    const doc = document.documentElement;
    if (doc.scrollWidth > window.innerWidth + 1) r.push(`rolagem horizontal (${doc.scrollWidth} > ${window.innerWidth})`);
    const visivel = (el) => {
      const s = getComputedStyle(el);
      const b = el.getBoundingClientRect();
      return s.display !== "none" && s.visibility !== "hidden" && b.width > 0 && b.height > 0;
    };
    for (const el of document.querySelectorAll("button, a, [class*='rounded-full'], select, input[type=submit]")) {
      if (!visivel(el)) continue;
      if (el.closest("table") || el.closest(".overflow-x-auto")) continue;
      const s = getComputedStyle(el);
      if (el.scrollWidth > el.clientWidth + 1 && s.overflow !== "visible" && s.textOverflow !== "ellipsis" && el.tagName !== "SELECT") r.push(`conteúdo cortado: <${el.tagName.toLowerCase()}> "${(el.textContent ?? "").trim().slice(0, 40)}"`);
      if (el.tagName === "BUTTON") {
        let p = el.parentElement;
        while (p && p !== document.body) {
          const ps = getComputedStyle(p);
          if (ps.overflow !== "visible" || ps.overflowX !== "visible") {
            const a = el.getBoundingClientRect();
            const c = p.getBoundingClientRect();
            if (a.right > c.right + 1 || a.left < c.left - 1) r.push(`botão fora do contêiner: "${(el.textContent ?? "").trim().slice(0, 40)}"`);
            break;
          }
          p = p.parentElement;
        }
      }
    }
    return r;
  });
  for (const a of achados) problemas.push(`${rota} @${largura}: ${a}`);
  const nome = rota.replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "") || "inicio";
  await page.screenshot({ path: `.layout/${nome}-${largura}.png`, fullPage: true });
}

for (const largura of LARGURAS) {
  const ctx = await browser.newContext({ viewport: { width: largura, height: 900 }, locale: "pt-BR" });
  const page = await ctx.newPage();
  const erros = [];
  page.on("pageerror", (e) => erros.push(e.message));
  for (const r of PUBLICAS) await verificar(page, r, largura);
  await page.goto(`${BASE}/login`);
  await page.fill("#email", "demonstracao@inventormiguel.com");
  await page.fill("#senha", "abc123");
  await Promise.all([page.waitForURL(/\/app/), page.click("form button[type=submit]")]);
  for (const r of PAINEL) await verificar(page, r, largura);
  for (const e of erros) problemas.push(`erro de JavaScript @${largura}: ${e}`);
  await ctx.close();
}
await browser.close();
if (problemas.length) {
  console.error(`Layout: ${problemas.length} problema(s)`);
  for (const p of problemas) console.error(` - ${p}`);
  process.exit(1);
}
console.log(`Layout ok: ${PUBLICAS.length + PAINEL.length} páginas × ${LARGURAS.length} larguras, capturas em .layout/`);
