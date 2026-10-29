import { exigirUsuario } from "@/lib/auth/sessao";
import { condominiosDoUsuario } from "@/lib/negocio/acesso";
import { painelDeValor } from "@/features/valor/servico";
import { linhaCsv } from "@/lib/negocio/csv";
import { hojeISO } from "@/lib/negocio/datas";

export const dynamic = "force-dynamic";

/** CSV do painel de valor (medido e estimado em linhas separadas, nunca somados). */
export async function GET(req: Request) {
  const u = await exigirUsuario();
  const c = new URLSearchParams(req.url.split("?")[1] ?? "").get("c") ?? "";
  const cond = (await condominiosDoUsuario(u)).find((x) => x.id === c);
  if (!cond) return new Response("Não encontrado.", { status: 404 });
  const v = await painelDeValor(u.organizacao.id, c);
  const m = v.medido;
  const l = [
    linhaCsv(["bloco", "linha", "valor", "base"]),
    linhaCsv(["medido", "servicos_dentro_do_prazo_cadastrado", m.servicosDentro.dentro, m.servicosDentro.total]),
    linhaCsv(["medido", "vencidos_agora", m.vencidos, ""]),
    linhaCsv(["medido", "vencendo_30_dias", m.vencendo, ""]),
    linhaCsv(["medido", "itens_de_rotina_feitos", m.rotinas.feitos, m.rotinas.previstos]),
    linhaCsv(["medido", "chamados_resolvidos", m.chamados.resolvidos, m.chamados.abertos]),
    linhaCsv(["medido", "mediana_horas_ate_resolver", m.chamados.medianaHoras ?? "", ""]),
    linhaCsv(["medido", "resolvidos_na_entrada", m.autoajuda.resolvidos, m.autoajuda.abertos]),
    linhaCsv(["medido", "duvidas_respondidas_pelos_documentos", m.duvidas.respondidasDocs, m.duvidas.total]),
    linhaCsv(["medido", "prestadores_com_documentos_em_dia", m.prestadores.emDia, m.prestadores.total]),
    linhaCsv(["medido", "boletos_beneficiario_impresso_divergente", m.boletosBeneficiarioDivergente, ""]),
    linhaCsv(["medido", "comunicados_lidos", m.comunicados.lidos, m.comunicados.entregues]),
  ];
  if (cond.papel !== "conselho") {
    l.push(linhaCsv(["estimado", "minutos_poupados", v.estimado.minutos, ""]));
    l.push(linhaCsv(["estimado", "valor_em_reais", (v.estimado.valorCentavos / 100).toFixed(2).replace(".", ","), ""]));
  }
  return new Response("﻿" + l.join("\n"), { headers: { "content-type": "text/csv; charset=utf-8", "content-disposition": `attachment; filename="valor-${hojeISO()}.csv"` } });
}
