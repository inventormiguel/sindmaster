/**
 * Tabela paramétrica de vencimentos (versão 1, 28/10/2026). São REFERÊNCIAS INFORMADAS,
 * não lei embutida: cada vencimento nasce "não conferido" e só gera aviso depois do
 * "Conferi e ativo" do síndico. Mudar a tabela cria versão nova; o vencimento do
 * condomínio guarda a versão de origem e não muda sozinho.
 */
export type ModeloVencimento = {
  chave: string;
  versao: number;
  nome: string;
  referenciaInformada: string;
  periodicidadeMeses: number | null;
  usaValidadeImpressa: boolean;
  variaPorLocal: boolean;
  notaConfira: string | null;
  ativoPorPadrao: boolean;
  fonte: string;
  fonteData: string;
};

const v = (m: Omit<ModeloVencimento, "versao" | "fonteData" | "fonte"> & { fonte?: string }): ModeloVencimento => ({
  versao: 1,
  fonteData: "28/10/2026",
  fonte: m.fonte ?? "Pesquisa do produto (lote 14), seção 3",
  ...m,
});

export const MODELOS_VENCIMENTO: ModeloVencimento[] = [
  v({ chave: "reservatorios", nome: "Limpeza e desinfecção dos reservatórios", referenciaInformada: "Lei municipal; confira a regra do seu município", periodicidadeMeses: 6, usaValidadeImpressa: false, variaPorLocal: true, notaConfira: "O prazo varia por município: confira e ajuste a periodicidade.", ativoPorPadrao: true }),
  v({ chave: "pragas", nome: "Controle de pragas", referenciaInformada: "Prática de mercado; Anvisa RDC 622/2022 trata das empresas", periodicidadeMeses: 6, usaValidadeImpressa: false, variaPorLocal: false, notaConfira: null, ativoPorPadrao: true }),
  v({ chave: "elevador_mensal", nome: "Visita mensal do elevador", referenciaInformada: "Contrato; ABNT NBR 16083", periodicidadeMeses: 1, usaValidadeImpressa: false, variaPorLocal: false, notaConfira: null, ativoPorPadrao: true }),
  v({ chave: "extintores", nome: "Recarga dos extintores (nível 2)", referenciaInformada: "ABNT NBR 12962", periodicidadeMeses: 12, usaValidadeImpressa: false, variaPorLocal: false, notaConfira: null, ativoPorPadrao: true }),
  v({ chave: "seguro", nome: "Seguro da edificação", referenciaInformada: "Código Civil, art. 1.346; vigência da apólice", periodicidadeMeses: 12, usaValidadeImpressa: true, variaPorLocal: false, notaConfira: "O próximo vencimento é o fim da vigência impresso na apólice.", ativoPorPadrao: true }),
  v({ chave: "bombeiros", nome: "Certificado do Corpo de Bombeiros", referenciaInformada: "Regulamento estadual; confira", periodicidadeMeses: null, usaValidadeImpressa: true, variaPorLocal: true, notaConfira: "Validade impressa no certificado; as regras variam por estado.", ativoPorPadrao: true }),
  v({ chave: "ago", nome: "Assembleia geral ordinária", referenciaInformada: "Código Civil, art. 1.350; convenção do condomínio", periodicidadeMeses: 12, usaValidadeImpressa: false, variaPorLocal: false, notaConfira: null, ativoPorPadrao: true }),
  v({ chave: "mangueiras", nome: "Ensaio das mangueiras de incêndio", referenciaInformada: "ABNT NBR 12779", periodicidadeMeses: 12, usaValidadeImpressa: false, variaPorLocal: false, notaConfira: null, ativoPorPadrao: true }),
  v({ chave: "mandato", nome: "Fim do mandato do síndico", referenciaInformada: "Código Civil, art. 1.347; convenção do condomínio", periodicidadeMeses: 24, usaValidadeImpressa: false, variaPorLocal: false, notaConfira: null, ativoPorPadrao: true }),
  v({ chave: "spda", nome: "Inspeção do SPDA (para-raios)", referenciaInformada: "ABNT NBR 5419", periodicidadeMeses: 36, usaValidadeImpressa: false, variaPorLocal: false, notaConfira: "Em região litorânea ou de atmosfera agressiva, a referência informada é de 1 ano.", ativoPorPadrao: true }),
  v({ chave: "pmoc", nome: "PMOC (ar-condicionado)", referenciaInformada: "Lei 13.589/2018 e Portaria 3.523/1998", periodicidadeMeses: 12, usaValidadeImpressa: false, variaPorLocal: false, notaConfira: "Aplicação a área comum de residencial é controversa; confira antes de ativar.", ativoPorPadrao: false }),
  v({ chave: "autovistoria", nome: "Autovistoria predial", referenciaInformada: "RJ: LC 126/2013 e Lei estadual 6.400/2013; outros municípios: confira", periodicidadeMeses: 60, usaValidadeImpressa: false, variaPorLocal: true, notaConfira: "Só existe em alguns municípios.", ativoPorPadrao: false }),
  v({ chave: "ria_elevador", nome: "RIA do elevador", referenciaInformada: "Cidade de São Paulo: Leis 10.348/1987 e 12.751/1998; confira o seu município", periodicidadeMeses: 12, usaValidadeImpressa: false, variaPorLocal: true, notaConfira: "Só existe em alguns municípios.", ativoPorPadrao: false }),
];
