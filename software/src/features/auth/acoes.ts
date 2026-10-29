"use server";

import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import { organizacoes, usuarios } from "@/db/schema";
import { conferirSenha, gerarHashSenha, normalizarEmail } from "@/lib/auth/senha";
import { encerrarSessao, iniciarSessao } from "@/lib/auth/sessao";

export type EstadoForm = { erro?: string; campo?: string } | null;

function destinoSeguro(v: FormDataEntryValue | null): string {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/app") && !s.startsWith("//") ? s : "/app";
}

export async function entrar(_prev: EstadoForm, form: FormData): Promise<EstadoForm> {
  const email = normalizarEmail(String(form.get("email") ?? ""));
  const senha = String(form.get("senha") ?? "");
  if (!email || !senha) return { erro: "Informe e-mail e senha." };
  const [u] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (!u || !(await conferirSenha(senha, u.senhaHash))) return { erro: "E-mail ou senha incorretos." };
  await iniciarSessao(u.id, u.organizacaoId);
  redirect(destinoSeguro(form.get("proximo")));
}

const esquemaCadastro = z.object({
  nome: z.string().trim().min(2, "Informe seu nome."),
  email: z.string().trim().email("E-mail inválido."),
  senha: z.string().min(6, "A senha precisa de pelo menos 6 caracteres."),
  conta: z.string().trim().min(2, "Informe o nome da administradora ou do síndico."),
  tipo: z.enum(["administradora", "sindico_profissional", "sindico_morador"]),
});

export async function cadastrar(_prev: EstadoForm, form: FormData): Promise<EstadoForm> {
  const r = esquemaCadastro.safeParse({
    nome: form.get("nome"),
    email: form.get("email"),
    senha: form.get("senha"),
    conta: form.get("conta"),
    tipo: form.get("tipo"),
  });
  if (!r.success) {
    const p = r.error.issues[0];
    return { erro: p.message, campo: String(p.path[0] ?? "") };
  }
  const email = normalizarEmail(r.data.email);
  const [existe] = await db.select({ id: usuarios.id }).from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (existe) return { erro: "Já existe uma conta com este e-mail. Use Entrar.", campo: "email" };

  const senhaHash = await gerarHashSenha(r.data.senha);
  const { uid, oid } = await db.transaction(async (tx) => {
    const [org] = await tx.insert(organizacoes).values({ nome: r.data.conta, tipo: r.data.tipo, isDemo: false }).returning();
    const [u] = await tx
      .insert(usuarios)
      .values({ organizacaoId: org.id, nome: r.data.nome, email, senhaHash, papel: "admin" })
      .returning();
    return { uid: u.id, oid: org.id };
  });
  await iniciarSessao(uid, oid);
  redirect("/app?boas-vindas=1");
}

export async function sair() {
  await encerrarSessao();
  redirect("/login");
}
