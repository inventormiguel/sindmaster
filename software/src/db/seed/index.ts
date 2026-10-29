import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "../index";
import { acessoCondominios, condominios, emissoresCertidao, organizacoes, usuarios } from "../schema";
import { BRAND } from "@/lib/brand";
import { gerarHashSenha, normalizarEmail } from "@/lib/auth/senha";
import { garantirModelosVencimento } from "@/features/vencimentos/servico";
import { EMISSORES_CERTIDAO } from "@/features/prestadores/emissores";
import { CONDOMINIO_CARTEIRA, CONDOMINIO_PRINCIPAL, ORGANIZACAO_DEMO, USUARIOS_DEMO } from "./dados";
import { criarCondominioDemo } from "./condominio-demo";

/**
 * Seed idempotente: garante as tabelas paramétricas, o usuário de demonstração (senha abc123)
 * e cria os dados de exemplo só se a organização de demonstração estiver vazia.
 */
export async function semear() {
  await garantirModelosVencimento();
  for (const e of EMISSORES_CERTIDAO) await db.insert(emissoresCertidao).values(e).onConflictDoNothing();

  const email = normalizarEmail(BRAND.demo.email);
  const senhaHash = await gerarHashSenha(BRAND.demo.senha);

  let [org] = await db.select().from(organizacoes).where(eq(organizacoes.isDemo, true)).limit(1);
  if (!org) {
    [org] = await db.insert(organizacoes).values({ ...ORGANIZACAO_DEMO, isDemo: true }).returning();
  }

  const [usuario] = await db.select().from(usuarios).where(eq(usuarios.email, email)).limit(1);
  if (usuario) {
    await db.update(usuarios).set({ senhaHash, organizacaoId: org.id, papel: "admin", nome: BRAND.demo.nome }).where(eq(usuarios.id, usuario.id));
  } else {
    await db.insert(usuarios).values({ organizacaoId: org.id, nome: BRAND.demo.nome, email, senhaHash, papel: "admin" });
  }

  const existentes = await db.select({ id: condominios.id }).from(condominios).where(eq(condominios.organizacaoId, org.id)).limit(1);
  if (existentes.length > 0) return { criouDados: false };

  // Usuários de exemplo: senha aleatória descartada (existem para os acessos, a auditoria e os testes).
  const ids: Record<string, string> = {};
  for (const u of USUARIOS_DEMO) {
    const e = normalizarEmail(u.email);
    let [x] = await db.select().from(usuarios).where(eq(usuarios.email, e)).limit(1);
    if (!x) [x] = await db.insert(usuarios).values({ organizacaoId: org.id, nome: u.nome, email: e, senhaHash: await gerarHashSenha(randomBytes(24).toString("base64url")), papel: u.papel }).returning();
    ids[u.nome] = x.id;
  }
  const principal = await criarCondominioDemo({ organizacaoId: org.id, ...CONDOMINIO_PRINCIPAL, completo: true, sindicoUsuarioId: ids["José Ribeiro"], conselhoUsuarioId: ids["Cláudia Nunes"] });
  await criarCondominioDemo({ organizacaoId: org.id, ...CONDOMINIO_CARTEIRA, completo: false, sindicoUsuarioId: ids["José Ribeiro"] });
  void principal;
  void acessoCondominios;
  return { criouDados: true };
}
