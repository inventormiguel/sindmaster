import "./_ambiente";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { and, eq, sql } from "drizzle-orm";

/**
 * Mede o custo real das funções de IA com a sua chave (ANTHROPIC_API_KEY), num banco em
 * memória com o seed da demonstração. Não mexe no banco local. Uso: npm run ia:medir
 */
process.env.VITEST = "1";
process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "medir-ia-"));

async function main() {
  if (!process.env.ANTHROPIC_API_KEY?.trim()) throw new Error("Defina ANTHROPIC_API_KEY no .env.local.");
  const { db } = await import("@/db");
  const { migrarBanco } = await import("@/db/migrar");
  const { semear } = await import("@/db/seed");
  const s = await import("@/db/schema");
  await migrarBanco();
  await semear();
  const [org] = await db.select().from(s.organizacoes).where(eq(s.organizacoes.isDemo, true));
  const [c] = await db.select().from(s.condominios).where(and(eq(s.condominios.organizacaoId, org.id), eq(s.condominios.nome, "Residencial Jardim das Araucárias")));
  const { receberDuvida } = await import("@/features/duvidas/servico");
  const { abrirChamado } = await import("@/features/chamados/servico");
  const { criarDespesaDeArquivo } = await import("@/features/despesas/servico");
  const { lerDocumentoIA3 } = await import("@/features/prestadores/ia");
  const { obterArmazenamento, montarChave } = await import("@/lib/storage");
  const salvarArquivoDoPainel = async (p: { organizacaoId: string; condominioId: string; arquivo: File }) => {
    const bytes = new Uint8Array(await p.arquivo.arrayBuffer());
    const chave = montarChave(p.organizacaoId, p.arquivo.name);
    await obterArmazenamento().salvar(chave, bytes, p.arquivo.type);
    const [a] = await db.insert(s.arquivos).values({ organizacaoId: p.organizacaoId, condominioId: p.condominioId, origem: "painel", nomeOriginal: p.arquivo.name, mimeType: p.arquivo.type, tamanhoBytes: bytes.byteLength, provedor: "local", chave }).returning();
    return a;
  };
  const { PDFDocument, StandardFonts } = await import("pdf-lib");
  const saida: string[] = [];
  const log = (t: string) => { console.log(t); saida.push(t); };

  for (const pergunta of ["Posso fazer minha mudança nesse sábado à tarde?", "Pode ter cachorro?", "Posso pagar o condomínio por Pix?", "O condomínio paga o conserto da infiltração que vem do apartamento de cima?"]) {
    const r = await receberDuvida({ organizacaoId: org.id, condominioId: c.id, pessoaId: null, pergunta });
    log(`IA1 "${pergunta}" → ${r.duvida.estado}${r.duvida.motivoEncaminhamento ? ` (${r.duvida.motivoEncaminhamento})` : ""} ${JSON.stringify(r.duvida.citacoes?.map((x) => x.rotulo) ?? [])}`);
  }
  const ch = await abrirChamado({ organizacaoId: org.id, condominioId: c.id, origem: "morador", descricao: "A água da torneira da cozinha está saindo amarelada desde ontem", autorRotulo: "t" });
  log(`IA4 → categoria ${ch.chamado.categoria}, passo ${ch.passo?.titulo ?? "—"}, pergunta ${ch.pergunta ?? "—"}, IA ${ch.iaUsada}`);

  const pdf = async (linhas: string[]) => {
    const d = await PDFDocument.create();
    const p = d.addPage([420, 595]);
    const f = await d.embedFont(StandardFonts.Helvetica);
    linhas.forEach((l, i) => p.drawText(l, { x: 30, y: 550 - i * 18, size: 11, font: f }));
    return d.save();
  };
  const nota = await pdf(["NOTA FISCAL DE SERVIÇO (FICTÍCIA, PARA TESTE)", "Prestador: Hidro Limpa Reservatórios (fictícia)", "CNPJ: 70.954.708/0001-67", "Tomador: Residencial Jardim das Araucárias", "Data de emissão: 27/10/2026", "Serviço: limpeza e desinfecção de 2 reservatórios", "Valor total: R$ 1.380,00"]);
  const a1 = await salvarArquivoDoPainel({ organizacaoId: org.id, condominioId: c.id, arquivo: new File([nota as BlobPart], "nota.pdf", { type: "application/pdf" }) });
  const d = await criarDespesaDeArquivo({ organizacaoId: org.id, condominioId: c.id, arquivoId: a1.id, quem: "teste" });
  log(`IA2 → ${d.despesa.estado} ${d.despesa.fornecedorNome} ${d.despesa.valorCentavos} ${d.despesa.categoria} ${d.erroIa ?? ""}`);
  const cert = await pdf(["CERTIDÃO NEGATIVA DE DÉBITOS (FICTÍCIA, PARA TESTE)", "Contribuinte: Hidro Limpa Reservatórios (fictícia)", "CNPJ: 70.954.708/0001-67", "Emitida em: 27/10/2026", "Válida até: 25/04/2027", "Certidão conjunta RFB/PGFN"]);
  const a2 = await salvarArquivoDoPainel({ organizacaoId: org.id, condominioId: c.id, arquivo: new File([cert as BlobPart], "cnd.pdf", { type: "application/pdf" }) });
  const l = await lerDocumentoIA3({ organizacaoId: org.id, arquivoId: a2.id, esperado: "documento_prestador" });
  log(`IA3 → ${l.ok ? `${l.leitura.tipo} titular ${l.leitura.titularCnpj} emissão ${l.emitidoEm} validade ${l.validade}` : l.mensagem}`);

  const rows = (await db.execute(sql`select funcao, count(*)::int n, sum(tokens_entrada)::int e, sum(tokens_saida)::int s, sum(custo_micro_usd)::int c, string_agg(distinct status, ',') st, max(modelo) m from ai_runs group by funcao order by funcao`)) as unknown as { rows: Record<string, unknown>[] };
  for (const r of rows.rows) log(`USO ${JSON.stringify(r)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
