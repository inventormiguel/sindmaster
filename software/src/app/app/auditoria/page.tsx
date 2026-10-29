import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { auditoria } from "@/db/schema";
import { exigirUsuario, pode } from "@/lib/auth/sessao";
import { dataHora } from "@/lib/formato";
import { Aviso, CabecalhoPagina, Cartao } from "@/components/ui";
import { Tabela, Td } from "@/components/negocio";

export const metadata: Metadata = { title: "Auditoria" };

export default async function Auditoria() {
  const u = await exigirUsuario();
  if (!pode(u, "gerenciar_integracoes")) return <Aviso tom="amarelo">Só o administrador da conta.</Aviso>;
  const lista = await db.select().from(auditoria).where(eq(auditoria.organizacaoId, u.organizacao.id)).orderBy(desc(auditoria.criadoEm)).limit(300);
  return (
    <>
      <CabecalhoPagina titulo="Auditoria" descricao="Só de inserção (o banco recusa alterar e apagar): conferências, aprovações, envios, revogações, mudanças, pagamentos, estornos." />
      <Cartao>
        <Tabela cabecalho={["Quando", "Quem", "Ação", "Detalhe"]} vazio={lista.length === 0}>
          {lista.map((a) => (
            <tr key={a.id}>
              <Td className="whitespace-nowrap">{dataHora(a.criadoEm)}</Td>
              <Td>{a.ator}</Td>
              <Td>{a.acao}</Td>
              <Td className="max-w-md break-words text-xs text-suave">{a.detalhe ? JSON.stringify(a.detalhe) : ""}</Td>
            </tr>
          ))}
        </Tabela>
      </Cartao>
    </>
  );
}
