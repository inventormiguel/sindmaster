import type { TipoConta } from "../schema";

/**
 * Dados de exemplo da conta de demonstração (todos fictícios).
 * CNPJs só da lista de CNPJs fictícios conferidos (dão 404 na BrasilAPI), sem repetir.
 * Nenhuma pessoa do seed tem Telegram nem telefone: o vínculo só acontece por convite
 * real, e o envio para pessoa sem Telegram fica registrado como "não enviado".
 */
/** Síndico profissional pessoa física: organização sem CNPJ. */
export const ORGANIZACAO_DEMO: { nome: string; tipo: TipoConta; cnpj: null } = {
  nome: "Ribeiro Síndicos Profissionais (fictícia)",
  tipo: "sindico_profissional",
  cnpj: null,
};

export const USUARIOS_DEMO = [
  { nome: "José Ribeiro", email: "jose.ribeiro@ribeirosindicos.exemplo", papel: "sindico" as const },
  { nome: "Fernanda Lopes", email: "fernanda.lopes@ribeirosindicos.exemplo", papel: "admin" as const },
  { nome: "Cláudia Nunes", email: "claudia.nunes@ribeirosindicos.exemplo", papel: "conselho" as const },
];

export const CONDOMINIO_PRINCIPAL = {
  nome: "Residencial Jardim das Araucárias",
  cnpj: "90.407.238/0001-29",
  endereco: "Rua das Araucárias, 1200 · Água Verde (endereço fictício)",
  cidade: "Curitiba",
  uf: "PR",
};

export const CONDOMINIO_CARTEIRA = {
  nome: "Edifício Mirante do Batel",
  cnpj: "97.366.946/0001-08",
  endereco: "Rua dos Pinheirais, 85 · Batel (endereço fictício)",
  cidade: "Curitiba",
  uf: "PR",
};

/** Nomes para "Criar condomínio de demonstração". */
export const NOMES_CONDOMINIOS_DEMO = [
  "Residencial Ipê Amarelo",
  "Edifício Vista do Parque",
  "Residencial Bosque das Graúnas",
  "Edifício Solar das Hortênsias",
  "Residencial Recanto das Bracatingas",
  "Edifício Morada dos Pinheirais",
];

export const EMPRESA_PORTARIA = "Vigia Sul Portaria (fictícia)";

export const FUNCIONARIOS = [
  { nome: "Antônio Pereira", funcao: "Zelador", empregador: "condominio" as const, posto: null, plantao: true },
  { nome: "Rosa Martins", funcao: "Auxiliar de limpeza", empregador: "condominio" as const, posto: null, plantao: false },
  { nome: "Marcos Silva", funcao: "Porteiro", empregador: "contratada" as const, posto: "Portaria diurna", plantao: false },
  { nome: "Sérgio Lima", funcao: "Porteiro", empregador: "contratada" as const, posto: "Portaria noturna", plantao: false },
];

export const PRESTADORES = [
  { chave: "hidro", razaoSocial: "Hidro Limpa Reservatórios (fictícia)", cnpj: "70.954.708/0001-67", categorias: ["caixa d'água", "hidráulica"], pix: "hidrolimpa@pix.exemplo" },
  { chave: "altura", razaoSocial: "Elevadores Altura Sul (fictícia)", cnpj: "80.866.024/0001-67", categorias: ["elevador"], pix: "alturasul@pix.exemplo" },
  { chave: "fogo", razaoSocial: "Fogo Zero Extintores (fictícia)", cnpj: "90.830.166/0001-28", categorias: ["incêndio"], pix: "fogozero@pix.exemplo" },
  { chave: "dedetiza", razaoSocial: "Dedetiza Paraná (fictícia)", cnpj: "78.648.379/0001-38", categorias: ["controle de pragas"], pix: "dedetizapr@pix.exemplo" },
  { chave: "eletro", razaoSocial: "Eletro Ponto Instalações (fictícia)", cnpj: "78.943.188/0001-07", categorias: ["elétrica", "portões"], pix: "eletroponto@pix.exemplo" },
  { chave: "jardim", razaoSocial: "Jardim Verde Vivo (fictícia)", cnpj: "74.282.135/0001-23", categorias: ["jardinagem"], pix: "jardimverde@pix.exemplo" },
];

/** CNPJ do "beneficiário de outro CNPJ" no boleto recusado do seed (lista conferida). */
export const CNPJ_BENEFICIARIO_DIVERGENTE = "84.639.217/0001-36";

export const PRIMEIROS_NOMES = ["Ana", "Bruno", "Carla", "Daniel", "Elisa", "Fábio", "Gabriela", "Heitor", "Isadora", "João", "Karina", "Lucas", "Mariana", "Nelson", "Olívia", "Paulo", "Renata", "Samuel", "Tânia", "Vitor", "Yara", "Wagner"];
export const SOBRENOMES = ["Albuquerque", "Bertoldi", "Camargo", "Dalmolin", "Esser", "Fabris", "Grassi", "Hoffmann", "Iurk", "Jacobsen", "Kloster", "Linhares", "Mazur", "Nogara", "Osinski", "Pacheco", "Quadros", "Rauen", "Schiavon", "Trevisan", "Uhlig", "Vosgerau"];

export const CABECALHO_FICTICIO = "Documento fictício para demonstração.";

export const REGIMENTO = `Regimento Interno do Residencial Jardim das Araucárias (fictício)
${CABECALHO_FICTICIO}

Capítulo I - Do sossego
Art. 5º O horário de silêncio é das 22h às 7h, todos os dias. Nesse período é proibido produzir ruídos que perturbem os demais moradores.

Capítulo II - Das áreas comuns
Art. 9º Animais de estimação circulam nas áreas comuns no colo ou na guia, e só pelo elevador de serviço.
Art. 12. Obras e reformas nas unidades podem ser feitas de segunda a sexta, das 8h às 17h, e aos sábados, das 8h às 12h. É proibido fazer obra aos domingos e feriados.
§ 1º O morador deve avisar a administração com 3 dias úteis de antecedência e apresentar a ART ou o RRT do responsável quando a obra mexer em estrutura, instalações de gás ou fachada.
Art. 15. Mudanças podem ser feitas de segunda a sábado, das 8h às 18h, com agendamento na portaria com 48 horas de antecedência.
Parágrafo único. Durante a mudança, o elevador de serviço fica reservado e deve ser protegido com as capas do condomínio.
Art. 18. A piscina funciona de terça a domingo, das 9h às 21h. Às segundas-feiras ela fica fechada para limpeza.
§ 2º Cada unidade pode levar até 2 convidados por dia, acompanhados de um morador.
Art. 21. O salão de festas é reservado na administração, com uso até as 22h e taxa de limpeza de R$ 150,00.
Art. 24. As vagas de garagem são de uso exclusivo das unidades, conforme a numeração da matrícula; é proibido guardar objetos nas vagas.
Art. 27. Bicicletas ficam no bicicletário do subsolo.
Art. 30. O lixo deve ser separado em reciclável e orgânico e levado à lixeira do térreo, das 7h às 22h.
Art. 33. Reclamações e sugestões são feitas pelos canais oficiais do condomínio (o bot do condomínio ou a administração), nunca diretamente aos funcionários.
`;

export const CONVENCAO = `Convenção do Condomínio Residencial Jardim das Araucárias (fictícia)
${CABECALHO_FICTICIO}

Art. 8º As despesas ordinárias são rateadas na proporção da fração ideal de cada unidade.
Art. 14. O síndico é eleito pela assembleia geral para mandato de 2 anos, permitida a reeleição.
Art. 19. A assembleia geral ordinária se reúne uma vez por ano, no primeiro trimestre, para aprovar as contas e o orçamento.
Art. 23. O condômino que descumprir esta convenção ou o regimento interno fica sujeito a advertência por escrito e, na reincidência, a multa de até 2 vezes o valor da cota condominial, aplicada pelo síndico, cabendo recurso à assembleia.
Art. 26. É proibido alterar a fachada, as esquadrias e a cor das sacadas sem aprovação da assembleia.
Art. 31. Os reparos internos das unidades, inclusive de infiltrações que nasçam dentro delas, são responsabilidade do condômino; os reparos nas partes comuns são do condomínio.
`;

/** Nomes fictícios para "Criar pessoa de demonstração" (tela Telegram da base). */
export const NOMES_ALEATORIOS = ["Aline Rocha", "Bruno Takahashi", "Camila Duarte", "Diego Martins", "Fernanda Kühl", "Gustavo Ribas", "Isabela Nogueira", "Rodrigo Pacheco", "Tatiane Moraes", "Vinícius Andrade"];
