import QRCode from "qrcode";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { pessoas } from "@/db/schema";
import { exigirCondominioAcao } from "@/lib/negocio/acesso";
import { gerarConvitesDasUnidades, reemitirConvite, validadeConviteDias } from "@/features/unidades/servico";
import { linkDoConvite, usernameDoBot } from "@/lib/telegram";
import { BRAND } from "@/lib/brand";

export const dynamic = "force-dynamic";

function esc(t: string) {
  return t.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);
}

/**
 * Página HTML imprimível dos convites (6 cartões por A4). O código só existe nesta resposta
 * (no banco fica só o hash): reimprimir = gerar de novo e revogar os anteriores.
 */
export async function POST(req: Request) {
  const form = await req.formData();
  let ctx;
  try {
    ctx = await exigirCondominioAcao(String(form.get("c") ?? ""));
  } catch {
    return new Response("Não encontrado.", { status: 404 });
  }
  const bot = await usernameDoBot();
  if (!bot) return new Response("Conecte o Telegram (TELEGRAM_BOT_USERNAME) em Integrações antes de gerar convites.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  let dias: number;
  try {
    dias = validadeConviteDias(form.get("dias"), form.get("pessoaId") ? 7 : 30);
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Validade inválida.", { status: 400, headers: { "content-type": "text/plain; charset=utf-8" } });
  }
  const { usuario, condominio } = ctx;
  let cartoes: { unidade: string; pessoa: string; codigo: string; expiraEm: Date }[] = [];
  const pessoaId = String(form.get("pessoaId") ?? "");
  if (pessoaId) {
    const [pe] = await db.select().from(pessoas).where(and(eq(pessoas.id, pessoaId), eq(pessoas.condominioId, condominio.id))).limit(1);
    if (!pe) return new Response("Não encontrado.", { status: 404 });
    const r = await reemitirConvite({ organizacaoId: usuario.organizacao.id, pessoaId: pe.id, usuarioId: usuario.id, dias });
    cartoes = [{ unidade: pe.unidade ?? pe.funcao ?? pe.papel, pessoa: pe.nome, codigo: r.codigo, expiraEm: r.convite.expiraEm }];
  } else {
    const unidadeIds = form.getAll("unidadeId").map(String).filter(Boolean);
    cartoes = await gerarConvitesDasUnidades({ organizacaoId: usuario.organizacao.id, condominioId: condominio.id, usuarioId: usuario.id, quem: usuario.nome, dias, unidadeIds });
  }
  const html = await Promise.all(
    cartoes.map(async (c) => {
      const link = linkDoConvite(bot, c.codigo);
      const svg = await QRCode.toString(link, { type: "svg", margin: 1, width: 180 });
      return `<div class="cartao"><p class="cond">${esc(condominio.nome)}</p><p class="un">Unidade ${esc(c.unidade)}</p>${svg}<p class="link">${esc(link)}</p><p class="val">Vale até ${c.expiraEm.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} · uso único</p><p class="termo">Leia o QR com a câmera do celular e toque em Começar no Telegram. Suas mensagens passam pelo Telegram (fora do Brasil) e, quando há IA, pela Anthropic (EUA), sem seu nome nem contato.</p></div>`;
    }),
  );
  const corpo = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Convites · ${esc(condominio.nome)}</title><style>
  body{font-family:system-ui,sans-serif;margin:0;padding:16px;color:#0f172a}
  .topo{display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap;margin-bottom:12px}
  .grade{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
  .cartao{border:1px dashed #94a3b8;border-radius:10px;padding:12px;text-align:center;break-inside:avoid;page-break-inside:avoid}
  .cartao svg{width:150px;height:150px}
  .cond{font-weight:600;margin:0}.un{font-size:20px;font-weight:700;margin:4px 0}
  .link{font-size:9px;word-break:break-all;color:#475569}.val{font-size:11px;margin:4px 0}.termo{font-size:9px;color:#475569}
  @media print{.topo{display:none}body{padding:0}.grade{gap:8px}.cartao:nth-child(6n){page-break-after:always}}
  </style></head><body><div class="topo"><div><strong>${cartoes.length} convite(s)</strong> · os códigos só aparecem nesta página. Gerar de novo revoga os anteriores (os QR já entregues deixam de funcionar).</div><button onclick="window.print()">Imprimir</button></div><div class="grade">${html.join("") || "<p>Nenhuma unidade sem morador vinculado.</p>"}</div><p style="font-size:10px;color:#64748b;margin-top:12px">${esc(BRAND.nome)}</p></body></html>`;
  return new Response(corpo, { headers: { "content-type": "text/html; charset=utf-8", "cache-control": "no-store", "x-robots-tag": "noindex" } });
}
