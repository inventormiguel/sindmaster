import type { Metadata } from "next";
import Link from "next/link";
import { asc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { acessoCondominios, condominios, pessoas, usuarios } from "@/db/schema";
import { exigirUsuario } from "@/lib/auth/sessao";
import { Botao, CabecalhoPagina, Cartao, Selecao, Selo, TituloCartao, Vazio } from "@/components/ui";
import { FormularioCondominio } from "@/features/condominios/formulario";
import { criarCondominioDemonstracao, definirAcesso } from "@/features/condominios/acoes";
import { numero } from "@/lib/formato";

export const metadata: Metadata = { title: "Condomínios" };

export default async function PaginaCondominios() {
  const usuario = await exigirUsuario();
  const org = usuario.organizacao.id;
  const lista = await db
    .select({
      id: condominios.id,
      nome: condominios.nome,
      cnpj: condominios.cnpj,
      endereco: condominios.endereco,
      enderecoFicticio: condominios.enderecoFicticio,
      cidade: condominios.cidade,
      uf: condominios.uf,
      totalUnidades: condominios.totalUnidades,
      pessoas: sql<number>`(select count(*)::int from ${pessoas} where ${pessoas.condominioId} = "condominios"."id")`,
      vinculadas: sql<number>`(select count(*)::int from ${pessoas} where ${pessoas.condominioId} = "condominios"."id" and ${pessoas.telegramChatId} is not null)`,
    })
    .from(condominios)
    .where(eq(condominios.organizacaoId, org))
    .orderBy(asc(condominios.nome));
  const admin = usuario.papel === "admin";
  const us = admin ? await db.select().from(usuarios).where(eq(usuarios.organizacaoId, org)).orderBy(asc(usuarios.nome)) : [];
  const acessos = admin ? await db.select().from(acessoCondominios).where(eq(acessoCondominios.organizacaoId, org)) : [];
  return (
    <>
      <CabecalhoPagina
        titulo="Condomínios"
        descricao="A carteira desta conta."
        acao={
          usuario.organizacao.isDemo ? (
            <form action={criarCondominioDemonstracao}>
              <Botao type="submit" variante="secundario">
                Criar condomínio de demonstração
              </Botao>
            </form>
          ) : null
        }
      />
      <div className="grid gap-6 xl:grid-cols-[1fr_440px]">
        <Cartao>
          <TituloCartao>Lista</TituloCartao>
          {lista.length === 0 ? (
            <Vazio>Nenhum condomínio cadastrado ainda. Comece pelo formulário ao lado.</Vazio>
          ) : (
            <ul className="divide-y divide-borda">
              {lista.map((c) => (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link href={`/app/hoje?c=${c.id}`} className="font-medium hover:underline">
                      {c.nome}
                    </Link>
                    {c.enderecoFicticio ? <Selo>endereço fictício</Selo> : null}
                  </div>
                  <p className="text-sm text-suave">{[c.endereco, [c.cidade, c.uf].filter(Boolean).join("-")].filter(Boolean).join(" · ") || "Endereço não informado"}</p>
                  <p className="mt-1 text-xs text-suave">
                    {c.cnpj ? `CNPJ ${c.cnpj} · ` : ""}
                    {c.totalUnidades ? `${numero(c.totalUnidades)} unidades · ` : ""}
                    {numero(c.pessoas)} pessoas cadastradas · {numero(c.vinculadas)} no Telegram
                  </p>
                  {admin ? (
                    <details className="mt-2 text-sm">
                      <summary className="cursor-pointer text-suave">Acessos dos usuários do painel</summary>
                      <ul className="mt-2 space-y-2">
                        {us
                          .filter((u) => u.papel !== "admin")
                          .map((u) => {
                            const a = acessos.find((x) => x.usuarioId === u.id && x.condominioId === c.id);
                            return (
                              <li key={u.id}>
                                <form action={definirAcesso} className="flex flex-wrap items-center gap-2">
                                  <input type="hidden" name="condominioId" value={c.id} />
                                  <input type="hidden" name="usuarioId" value={u.id} />
                                  <span className="min-w-40">{u.nome}</span>
                                  <Selecao name="papel" defaultValue={a?.papel ?? "nenhum"} className="w-40">
                                    <option value="nenhum">Sem acesso</option>
                                    <option value="sindico">Síndico</option>
                                    <option value="equipe">Equipe</option>
                                    <option value="conselho">Conselho (leitura)</option>
                                  </Selecao>
                                  <Botao type="submit" tamanho="sm" variante="secundario">
                                    Salvar
                                  </Botao>
                                </form>
                              </li>
                            );
                          })}
                      </ul>
                    </details>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </Cartao>
        <Cartao>
          <TituloCartao descricao="Cria as unidades, os vencimentos para conferir e as regras padrão.">Criar condomínio</TituloCartao>
          <FormularioCondominio />
        </Cartao>
      </div>
    </>
  );
}
