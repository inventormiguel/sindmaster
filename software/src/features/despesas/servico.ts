import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { condominios, despesas, prestadorCondominios, prestadores } from "@/db/schema";
import { chamarIAJson, REGRA_DADOS } from "@/lib/ia/funcoes";
import { blocoDoArquivo } from "@/lib/negocio/arquivo-ia";
import { conferirLinhaDigitavel, INSTRUCAO_BENEFICIARIO, instrucaoBeneficiario } from "@/lib/negocio/boleto";
import { cnpjValido, mesmoCnpj, soDigitos, formatarCnpjDigitos } from "@/lib/negocio/cnpj";
import { dataBR, diferencaDias, hojeISO, lerDataBR } from "@/lib/negocio/datas";
import { formatarReais, lerReais } from "@/lib/negocio/dinheiro";
import { normalizar } from "@/lib/negocio/linguagem";
import { auditar } from "@/lib/negocio/auditoria";

export const CATEGORIAS_DESPESA = [
  "manutencao_hidraulica",
  "manutencao_eletrica",
  "elevador",
  "limpeza",
  "jardinagem",
  "seguranca",
  "controle_pragas",
  "incendio",
  "consumo",
  "administrativo",
  "outros",
] as const;
export const ROTULO_CATEGORIA_DESPESA: Record<string, string> = {
  manutencao_hidraulica: "Manutenção hidráulica",
  manutencao_eletrica: "Manutenção elétrica",
  elevador: "Elevador",
  limpeza: "Limpeza",
  jardinagem: "Jardinagem",
  seguranca: "Segurança",
  controle_pragas: "Controle de pragas",
  incendio: "Prevenção de incêndio",
  consumo: "Consumo (água, luz, gás)",
  administrativo: "Administrativo",
  outros: "Outros",
};

export const ESQUEMA_IA2 = z.object({
  tipo: z.enum(["nota_fiscal", "recibo", "boleto", "cupom", "outro"]),
  fornecedorNome: z.string().max(120).nullable(),
  cnpj: z.string().max(30).nullable(),
  dataEmissao: z.string().max(12).nullable(),
  vencimento: z.string().max(12).nullable(),
  valor: z.string().max(20).nullable(),
  descricao: z.string().max(200),
  categoriaSugerida: z.enum(CATEGORIAS_DESPESA),
  linhaDigitavel: z.string().max(80).nullable(),
  beneficiarioNome: z.string().max(160).nullable(),
  beneficiarioCnpj: z.string().max(30).nullable(),
  legivel: z.boolean(),
});
export type LeituraIA2 = z.infer<typeof ESQUEMA_IA2>;

export type Conferencia = {
  linha?: { valida: boolean; erros: string[]; banco?: string; valor?: string | null; vencimento?: string | null; tipo: string };
  cnpjValido?: boolean | null;
  instrucaoBeneficiario?: string;
};

/**
 * Conferências por código (o que dá para conferir de verdade):
 * - DV do CNPJ lido;
 * - boleto: DVs dos campos e o DV geral, banco emissor, valor e vencimento da linha × os impressos lidos pela IA
 *   (divergência BLOQUEIA o rascunho até o síndico decidir);
 * - beneficiário impresso diferente do prestador: alerta COM SELO DE SUGESTÃO (lido pela IA); a linha não traz beneficiário.
 */
export function conferirDespesa(p: { leitura: { tipo: string; cnpj: string | null; valorCentavos: number | null; vencimento: string | null; linhaDigitavel: string | null; beneficiarioCnpj: string | null; beneficiarioNome: string | null }; prestador: { razaoSocial: string; cnpj: string | null } | null; hoje?: string }) {
  const divergencias: string[] = [];
  const conferencia: Conferencia = {};
  let bloquear = false;
  let valorLinha: number | null = null;
  const l = p.leitura;
  if (l.cnpj) {
    conferencia.cnpjValido = cnpjValido(l.cnpj);
    if (!conferencia.cnpjValido) divergencias.push("O CNPJ lido não tem dígitos verificadores válidos: confira na foto.");
  }
  if (l.valorCentavos != null && l.valorCentavos <= 0) divergencias.push("Valor lido não é positivo.");
  if (l.linhaDigitavel) {
    const c = conferirLinhaDigitavel(l.linhaDigitavel, p.hoje);
    valorLinha = c.valorCentavos ?? null;
    conferencia.linha = { valida: c.valida, erros: c.erros, banco: c.bancoNome, valor: c.valorCentavos != null ? formatarReais(c.valorCentavos) : null, vencimento: c.vencimento ?? null, tipo: c.tipo };
    if (!c.valida) {
      divergencias.push(`Linha digitável inválida, confira a foto (${c.erros.join("; ")}).`);
      bloquear = true;
    } else {
      if (c.valorCentavos != null && l.valorCentavos != null && Math.abs(c.valorCentavos - l.valorCentavos) > 1) {
        divergencias.push(`Linha digitável e valor impresso não batem: a linha diz ${formatarReais(c.valorCentavos)} e o impresso lido é ${formatarReais(l.valorCentavos)}. Confira a foto.`);
        bloquear = true;
      }
      if (c.vencimento && l.vencimento && c.vencimento !== l.vencimento) {
        divergencias.push(`Linha digitável e vencimento impresso não batem: a linha diz ${dataBR(c.vencimento)} e o impresso lido é ${dataBR(l.vencimento)}. Confira a foto.`);
        bloquear = true;
      }
    }
    conferencia.instrucaoBeneficiario = INSTRUCAO_BENEFICIARIO;
  }
  if (p.prestador?.cnpj && (l.beneficiarioCnpj || l.beneficiarioNome)) {
    const cnpjDiferente = l.beneficiarioCnpj && soDigitos(l.beneficiarioCnpj).length === 14 && !mesmoCnpj(l.beneficiarioCnpj, p.prestador.cnpj);
    if (cnpjDiferente) {
      divergencias.push(`Beneficiário impresso diferente do prestador (lido pela IA): ${formatarCnpjDigitos(l.beneficiarioCnpj)} no boleto, ${formatarCnpjDigitos(p.prestador.cnpj)} no cadastro. Registre a decisão.`);
    }
  }
  return { divergencias, conferencia, bloquear, valorLinha };
}

async function prestadorDoCnpj(organizacaoId: string, condominioId: string, cnpj: string | null, nome: string | null) {
  const lista = await db
    .select({ p: prestadores })
    .from(prestadores)
    .innerJoin(prestadorCondominios, eq(prestadorCondominios.prestadorId, prestadores.id))
    .where(and(eq(prestadores.organizacaoId, organizacaoId), eq(prestadorCondominios.condominioId, condominioId)));
  if (cnpj) {
    const porCnpj = lista.find((l) => mesmoCnpj(l.p.cnpj, cnpj));
    if (porCnpj) return porCnpj.p;
  }
  if (nome) {
    const n = normalizar(nome);
    const porNome = lista.find((l) => n.includes(normalizar(l.p.razaoSocial).split(" ").slice(0, 2).join(" ")));
    if (porNome) return porNome.p;
  }
  return null;
}

const SISTEMA_IA2 = `Você lê recibos, notas fiscais e boletos de despesas de condomínios no Brasil.
Extraia SOMENTE o que está impresso. Datas em dd/mm/aaaa. Valor como impresso (ex.: "1.380,00"). Se não houver, null.
linhaDigitavel: só os números da linha digitável do boleto, se houver.
beneficiarioNome/beneficiarioCnpj: como impressos no boleto.
categoriaSugerida: uma de ${CATEGORIAS_DESPESA.join(", ")}.
legivel=false se a imagem não permitir ler os campos principais.
Formato exato (use estas chaves, todas presentes; null quando não houver):
{"tipo":"nota_fiscal|recibo|boleto|cupom|outro","fornecedorNome":null,"cnpj":null,"dataEmissao":null,"vencimento":null,"valor":null,"descricao":"","categoriaSugerida":"outros","linhaDigitavel":null,"beneficiarioNome":null,"beneficiarioCnpj":null,"legivel":true}
${REGRA_DADOS}`;

/** Recibo/nota/boleto por foto → despesa em RASCUNHO (ou BLOQUEADA) para o síndico aprovar. Sem IA: rascunho vazio para preencher. */
export async function criarDespesaDeArquivo(p: { organizacaoId: string; condominioId: string; arquivoId: string; quem: string; prestadorId?: string | null }) {
  const b = await blocoDoArquivo(p.arquivoId, p.organizacaoId);
  let leitura: LeituraIA2 | null = null;
  let erroIa: string | null = null;
  if ("erro" in b) erroIa = b.erro;
  else {
    const r = await chamarIAJson({ organizacaoId: p.organizacaoId, funcao: "IA2", system: SISTEMA_IA2, esquema: ESQUEMA_IA2, conteudo: [b.bloco, { type: "text", text: "Devolva o JSON da despesa." }] });
    if (r.ok) leitura = r.dados;
    else erroIa = r.mensagem;
  }
  const valorCentavos = leitura ? lerReais(leitura.valor) : null;
  const dataEmissao = lerDataBR(leitura?.dataEmissao);
  const vencimento = lerDataBR(leitura?.vencimento);
  const prest = p.prestadorId
    ? ((await db.select().from(prestadores).where(and(eq(prestadores.id, p.prestadorId), eq(prestadores.organizacaoId, p.organizacaoId))).limit(1))[0] ?? null)
    : await prestadorDoCnpj(p.organizacaoId, p.condominioId, leitura?.cnpj ?? leitura?.beneficiarioCnpj ?? null, leitura?.fornecedorNome ?? null);
  const datasOk = (d: string | null) => (d && Math.abs(diferencaDias(hojeISO(), d)) < 3650 ? d : null);
  const c = leitura
    ? conferirDespesa({ leitura: { tipo: leitura.tipo, cnpj: leitura.cnpj, valorCentavos, vencimento: datasOk(vencimento), linhaDigitavel: leitura.linhaDigitavel, beneficiarioCnpj: leitura.beneficiarioCnpj, beneficiarioNome: leitura.beneficiarioNome }, prestador: prest })
    : { divergencias: [] as string[], conferencia: {} as Conferencia, bloquear: false, valorLinha: null as number | null };
  if (leitura && !leitura.legivel) c.divergencias.push("A IA indicou que a imagem não está legível: confira campo a campo.");
  const [d] = await db
    .insert(despesas)
    .values({
      organizacaoId: p.organizacaoId,
      condominioId: p.condominioId,
      estado: c.bloquear ? "bloqueada" : "para_conferir",
      tipoDocumento: leitura?.tipo ?? "recibo",
      fornecedorNome: leitura?.fornecedorNome ?? prest?.razaoSocial ?? null,
      cnpj: leitura?.cnpj ? formatarCnpjDigitos(leitura.cnpj) : (prest?.cnpj ?? null),
      prestadorId: prest?.id ?? null,
      dataEmissao: datasOk(dataEmissao),
      vencimento: datasOk(vencimento),
      valorCentavos,
      descricao: leitura?.descricao ?? null,
      categoria: leitura?.categoriaSugerida ?? "outros",
      linhaDigitavel: leitura?.linhaDigitavel?.replace(/\D/g, "") || null,
      bancoEmissor: c.conferencia.linha?.banco ?? null,
      valorLinhaCentavos: c.valorLinha ?? null,
      vencimentoLinha: c.conferencia.linha?.vencimento ?? null,
      beneficiarioImpressoNome: leitura?.beneficiarioNome ?? null,
      beneficiarioImpressoCnpj: leitura?.beneficiarioCnpj ? formatarCnpjDigitos(leitura.beneficiarioCnpj) : null,
      conferencia: c.conferencia,
      divergencias: c.divergencias,
      arquivoId: p.arquivoId,
      origem: leitura ? "ia" : "manual",
      leituraIa: leitura,
      criadoPorRotulo: p.quem,
    })
    .returning();
  return { despesa: d, erroIa };
}

export function resumoDespesa(d: typeof despesas.$inferSelect): string {
  const l = [
    `${d.fornecedorNome ?? "Fornecedor não lido"}${d.cnpj ? ` (CNPJ ${d.cnpj})` : ""}`,
    `Valor: ${formatarReais(d.valorCentavos)}${d.vencimento ? ` · vence ${dataBR(d.vencimento)}` : ""}`,
    `Categoria sugerida: ${ROTULO_CATEGORIA_DESPESA[d.categoria] ?? d.categoria}`,
  ];
  const conf = d.conferencia as Conferencia | null;
  if (conf?.linha) l.push(`Linha digitável: ${conf.linha.valida ? `válida, ${conf.linha.banco}` : "INVÁLIDA"}`);
  for (const x of d.divergencias ?? []) l.push(`Atenção: ${x}`);
  if (d.linhaDigitavel) l.push(instrucaoBeneficiario(d.fornecedorNome, d.cnpj));
  return l.join("\n");
}

async function carregar(organizacaoId: string, id: string) {
  const [d] = await db.select().from(despesas).where(and(eq(despesas.id, id), eq(despesas.organizacaoId, organizacaoId))).limit(1);
  if (!d) throw new Error("Despesa não encontrada.");
  return d;
}

export async function editarParaConferir(p: { organizacaoId: string; despesaId: string; quem: string; campos: { fornecedorNome?: string | null; cnpj?: string | null; valorCentavos?: number | null; dataEmissao?: string | null; vencimento?: string | null; categoria?: string; descricao?: string | null; prestadorId?: string | null } }) {
  const d = await carregar(p.organizacaoId, p.despesaId);
  if (!["para_conferir", "bloqueada"].includes(d.estado)) throw new Error("Só despesas para conferir podem ser editadas (lançada se corrige com estorno).");
  await db.update(despesas).set(p.campos).where(eq(despesas.id, d.id));
  await auditar({ organizacaoId: p.organizacaoId, condominioId: d.condominioId, ator: p.quem, acao: "despesa.campos_editados", alvo: d.id });
}

/**
 * Conferir e lançar: o síndico confere os campos lidos. Boleto exige o toque
 * "Conferi o beneficiário no app do banco" (grava quem e quando). Bloqueada pela
 * conferência do código só segue com o motivo da decisão. Acima da alçada do
 * condomínio, fica aguardando aprovação.
 */
export async function conferirELancar(p: { organizacaoId: string; despesaId: string; quem: string; beneficiarioConferido?: boolean; motivoLiberacao?: string | null }) {
  const d = await carregar(p.organizacaoId, p.despesaId);
  if (!["para_conferir", "bloqueada"].includes(d.estado)) throw new Error("Esta despesa não está para conferir.");
  if (!d.valorCentavos || d.valorCentavos <= 0) throw new Error("Informe o valor antes de lançar.");
  if (d.linhaDigitavel && !p.beneficiarioConferido) throw new Error('Boleto: toque "Conferi o beneficiário no app do banco" antes de lançar.');
  if (d.estado === "bloqueada" && !(p.motivoLiberacao && p.motivoLiberacao.trim().length >= 5)) throw new Error("Despesa bloqueada pela conferência do código: escreva o motivo da decisão para seguir.");
  const [c] = await db.select({ alcada: condominios.alcadaDespesaCentavos }).from(condominios).where(eq(condominios.id, d.condominioId)).limit(1);
  const acima = c?.alcada != null && d.valorCentavos > c.alcada;
  const agora = new Date();
  await db
    .update(despesas)
    .set({
      estado: acima ? "aguardando_aprovacao" : "lancada",
      conferidoPorNome: p.quem,
      conferidoEm: agora,
      decisaoMotivo: p.motivoLiberacao ?? null,
      ...(d.linhaDigitavel ? { beneficiarioConferidoPorNome: p.quem, beneficiarioConferidoEm: agora } : {}),
      ...(acima ? {} : { aprovadoPorNome: p.quem, aprovadoEm: agora }),
    })
    .where(eq(despesas.id, d.id));
  await auditar({ organizacaoId: p.organizacaoId, condominioId: d.condominioId, ator: p.quem, acao: acima ? "despesa.conferida_aguardando_aprovacao" : "despesa.conferida_e_lancada", alvo: d.id, detalhe: { valor: d.valorCentavos, liberacao: p.motivoLiberacao ?? null } });
  return { estado: acima ? "aguardando_aprovacao" : "lancada" };
}

/** Aprovação acima da alçada (no MVP, pelo síndico ou pelo admin). */
export async function aprovarAcimaDaAlcada(p: { organizacaoId: string; despesaId: string; quem: string }) {
  const d = await carregar(p.organizacaoId, p.despesaId);
  if (d.estado !== "aguardando_aprovacao") throw new Error("Esta despesa não está aguardando aprovação.");
  await db.update(despesas).set({ estado: "lancada", aprovadoPorNome: p.quem, aprovadoEm: new Date() }).where(eq(despesas.id, d.id));
  await auditar({ organizacaoId: p.organizacaoId, condominioId: d.condominioId, ator: p.quem, acao: "despesa.aprovada_acima_da_alcada", alvo: d.id });
}

export async function recusarDespesa(p: { organizacaoId: string; despesaId: string; quem: string; motivo: string }) {
  const d = await carregar(p.organizacaoId, p.despesaId);
  if (!["para_conferir", "bloqueada", "aguardando_aprovacao"].includes(d.estado)) throw new Error("Esta despesa não pode mais ser recusada.");
  if (p.motivo.trim().length < 3) throw new Error("Escreva o motivo da recusa.");
  await db.update(despesas).set({ estado: "recusada", decisaoMotivo: p.motivo.trim(), conferidoPorNome: p.quem, conferidoEm: new Date() }).where(eq(despesas.id, d.id));
  await auditar({ organizacaoId: p.organizacaoId, condominioId: d.condominioId, ator: p.quem, acao: "despesa.recusada", alvo: d.id, detalhe: { motivo: p.motivo } });
}

/** Nada se apaga: a despesa lançada vira "estornada" com quem, quando e motivo (o banco recusa qualquer outra mudança). */
export async function estornarDespesa(p: { organizacaoId: string; despesaId: string; quem: string; motivo: string }) {
  const d = await carregar(p.organizacaoId, p.despesaId);
  if (d.estado !== "lancada") throw new Error("Só uma despesa lançada pode ser estornada.");
  if (p.motivo.trim().length < 5) throw new Error("Escreva o motivo do estorno.");
  await db.update(despesas).set({ estado: "estornada", estornoMotivo: p.motivo.trim(), estornadoPorNome: p.quem, estornadoEm: new Date() }).where(eq(despesas.id, d.id));
  await auditar({ organizacaoId: p.organizacaoId, condominioId: d.condominioId, ator: p.quem, acao: "despesa.estornada", alvo: d.id, detalhe: { motivo: p.motivo } });
}

/** Lista do mês: despesas lançadas por categoria e por prestador (não é balancete contábil). */
export function agruparDespesas(lista: (typeof despesas.$inferSelect)[]) {
  const porCategoria = new Map<string, number>();
  const porFornecedor = new Map<string, number>();
  let total = 0;
  for (const d of lista) {
    if (d.estado !== "lancada") continue;
    const v = d.valorCentavos ?? 0;
    total += v;
    porCategoria.set(d.categoria, (porCategoria.get(d.categoria) ?? 0) + v);
    const f = d.fornecedorNome ?? "Sem fornecedor";
    porFornecedor.set(f, (porFornecedor.get(f) ?? 0) + v);
  }
  return { total, porCategoria: [...porCategoria.entries()].sort((a, b) => b[1] - a[1]), porFornecedor: [...porFornecedor.entries()].sort((a, b) => b[1] - a[1]) };
}
