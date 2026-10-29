import { z } from "zod";
import { chamarIAJson, REGRA_DADOS } from "@/lib/ia/funcoes";
import { blocoDoArquivo } from "@/lib/negocio/arquivo-ia";
import { lerDataBR } from "@/lib/negocio/datas";

/** IA3 · leitura de certidão, apólice e comprovante de serviço. Nada é estimado: sem a data no documento, null. */
export const ESQUEMA_IA3 = z.object({
  tipo: z.enum(["cnd_federal", "crf_fgts", "cndt", "apolice_rc", "alvara", "certificado_servico", "laudo", "outro"]),
  titularNome: z.string().max(160).nullable(),
  titularCnpj: z.string().max(30).nullable(),
  emitidoEm: z.string().max(12).nullable(),
  validadeAte: z.string().max(12).nullable(),
  dataServico: z.string().max(12).nullable(),
  seguradora: z.string().max(120).nullable(),
  coberturaValor: z.string().max(40).nullable(),
  observacao: z.string().max(200).nullable(),
});
export type LeituraIA3 = z.infer<typeof ESQUEMA_IA3>;

const SISTEMA_IA3 = `Você lê documentos de prestadores de serviço de condomínios no Brasil (certidões, apólices, certificados de serviço).
Extraia SOMENTE o que está impresso. Datas no formato dd/mm/aaaa. Se um campo não estiver no documento, use null: nunca estime.
Formato exato (todas as chaves presentes; null quando não houver):
{"tipo":"cnd_federal|crf_fgts|cndt|apolice_rc|alvara|certificado_servico|laudo|outro","titularNome":null,"titularCnpj":null,"emitidoEm":null,"validadeAte":null,"dataServico":null,"seguradora":null,"coberturaValor":null,"observacao":null}
A certidão conjunta RFB/PGFN é "cnd_federal"; a certidão da Justiça do Trabalho é "cndt"; o certificado de regularidade do FGTS é "crf_fgts". dataServico só em certificado de serviço.
${REGRA_DADOS}`;

export async function lerDocumentoIA3(p: { organizacaoId: string; arquivoId: string; esperado: "documento_prestador" | "comprovante_servico"; cnpjPrestador?: string | null }) {
  const b = await blocoDoArquivo(p.arquivoId, p.organizacaoId);
  if ("erro" in b) return { ok: false as const, mensagem: b.erro };
  const r = await chamarIAJson({
    organizacaoId: p.organizacaoId,
    funcao: "IA3",
    system: SISTEMA_IA3,
    esquema: ESQUEMA_IA3,
    conteudo: [b.bloco, { type: "text", text: `Tipo esperado: ${p.esperado === "documento_prestador" ? "documento do prestador (certidão ou apólice)" : "comprovante de serviço"}. Devolva o JSON.` }],
  });
  if (!r.ok) return { ok: false as const, mensagem: r.mensagem };
  const d = r.dados;
  // Guardrails do código: datas válidas, validade depois da emissão, serviço não futuro.
  const emitidoEm = lerDataBR(d.emitidoEm);
  let validade = lerDataBR(d.validadeAte);
  if (validade && emitidoEm && validade < emitidoEm) validade = null;
  let dataServico = lerDataBR(d.dataServico);
  if (dataServico && dataServico > new Date().toISOString().slice(0, 10)) dataServico = null;
  return { ok: true as const, leitura: d, emitidoEm, validade, dataServico, execucaoId: r.execucaoId };
}
