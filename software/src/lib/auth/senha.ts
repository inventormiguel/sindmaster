import bcrypt from "bcryptjs";

/** Minúsculas, sem espaços e sem acentos: "demonstração@..." entra como "demonstracao@...". */
export function normalizarEmail(email: string): string {
  return email
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function gerarHashSenha(senha: string): Promise<string> {
  return bcrypt.hash(senha, 10);
}

export function conferirSenha(senha: string, hash: string): Promise<boolean> {
  return bcrypt.compare(senha, hash);
}
