/** Onde conferir a autenticidade das certidões (sem automação: os emissores têm captcha). Links conferidos em 28/10/2026. */
export const EMISSORES_CERTIDAO = [
  { tipo: "cnd_federal", nome: "Receita Federal / PGFN", url: "https://solucoes.receita.fazenda.gov.br/servicos/certidaointernet/pj/emitir", conferidoEm: "28/10/2026" },
  { tipo: "crf_fgts", nome: "Caixa (FGTS)", url: "https://consulta-crf.caixa.gov.br/consultacrf/pages/consultaEmpregador.jsf", conferidoEm: "28/10/2026" },
  { tipo: "cndt", nome: "Tribunal Superior do Trabalho", url: "https://cndt-certidao.tst.jus.br/inicio.faces", conferidoEm: "28/10/2026" },
];
