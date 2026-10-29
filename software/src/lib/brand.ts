/**
 * Marca do produto: o ÚNICO lugar com o nome.
 *
 * Para trocar a marca inteira (landing, login, painel, mensagens do bot no
 * Telegram, User-Agent das chamadas externas), mude só este arquivo.
 */
const nome = "sindmaster";

/** Nome sem acentos e sem espaços, usado em identificadores técnicos. */
const slug = nome
  .normalize("NFD")
  .replace(/[̀-ͯ]/g, "")
  .replace(/[^A-Za-z0-9]+/g, "");

export const BRAND = {
  nome,
  descricao: "Síndico Inteligente para Administração de Condomínios",
  slogan: "O condomínio organizado, com o síndico e os moradores no Telegram.",
  /** Identificador nas chamadas a APIs externas: nunca e-mail nem nome de pessoa. */
  userAgent: `${slug}/1.0`,
  /** Prefixo de cookies e de chaves internas. */
  prefixo: slug.toLowerCase(),
  cores: {
    primaria: "#275D77",
    primariaEscura: "#173D52",
    primariaClara: "#EAF1F5",
    destaque: "#C59A55",
    tinta: "#193344",
    suave: "#586B76",
    fundo: "#F5F6F4",
    superficie: "#FFFFFF",
    borda: "#DCE3E5",
    navegacao: "#132F42",
    verde: "#227567",
    perigo: "#B42332",
  },
  demo: {
    email: "demonstracao@inventormiguel.com",
    senha: "abc123",
    nome: "Usuário Demonstração",
  },
} as const;
