import type { Metadata } from "next";
import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { pessoas } from "@/db/schema";
import { exigirUsuario, pode } from "@/lib/auth/sessao";
import { apagarPessoaAcao } from "@/features/lgpd/acoes";
import { Aviso, Botao, CabecalhoPagina, Campo, Cartao, Selecao, TituloCartao } from "@/components/ui";
import { Mensagens } from "@/components/negocio";

export const metadata: Metadata = { title: "LGPD" };

export default async function Lgpd({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const u = await exigirUsuario();
  if (!pode(u, "gerenciar_integracoes")) return <Aviso tom="amarelo">Só o administrador da conta.</Aviso>;
  const lista = await db.select().from(pessoas).where(eq(pessoas.organizacaoId, u.organizacao.id)).orderBy(asc(pessoas.nome));
  const ativos = lista.filter((p) => !p.removidaEm);
  const opcoes = ativos.map((p) => (
    <option key={p.id} value={p.id}>
      {p.nome} · {p.papel}
      {p.unidade ? ` ${p.unidade}` : ""}
    </option>
  ));
  return (
    <>
      <CabecalhoPagina titulo="LGPD" descricao="O condomínio é o controlador; o síndico responde como representante. O Telegram (servidores fora do Brasil) e a Anthropic (EUA) são operadores." />
      <Mensagens sp={sp} />
      <div className="grid gap-6 xl:grid-cols-2">
        <Cartao>
          <TituloCartao descricao="Tudo o que o sistema guarda sobre a pessoa, em JSON.">Exportar os dados de uma pessoa</TituloCartao>
          <form action="/api/lgpd/exportar" method="post" className="space-y-3">
            <Selecao name="pessoaId" required>
              {opcoes}
            </Selecao>
            <Botao type="submit" variante="secundario">
              Baixar JSON
            </Botao>
          </form>
        </Cartao>
        <Cartao>
          <TituloCartao descricao="Nome, telefone e Telegram saem de todas as tabelas; o histórico fica sem identificar a pessoa. Não tem volta.">Apagar os dados de uma pessoa</TituloCartao>
          <form action={apagarPessoaAcao} className="space-y-3">
            <Selecao name="pessoaId" required>
              {opcoes}
            </Selecao>
            <Campo name="confirmo" placeholder='Digite APAGAR para confirmar' required />
            <Botao type="submit" variante="perigo">
              Apagar dados pessoais
            </Botao>
          </form>
        </Cartao>
      </div>
      <Cartao className="mt-6">
        <TituloCartao>Decisões de produto</TituloCartao>
        <ul className="list-disc space-y-1 pl-5 text-sm text-suave">
          <li>O morador vê só o que é dele e o que é do condomínio todo; o bot nunca devolve dado de outra unidade.</li>
          <li>Perguntas sobre dívida, telefone, nome ou placa de outra unidade são desviadas pelo código antes da IA.</li>
          <li>Atas nascem ocultas e fora das respostas; trechos com unidade e débito ficam marcados para revisão.</li>
          <li>Fotos de tarefa: só para mostrar a tarefa feita, sem localização, apagadas em 90 dias; imagem recebida como documento é regravada sem EXIF.</li>
          <li>Dados de pagamento dos prestadores: cifrados, histórico só de inserção.</li>
          <li>Nomes e contatos saem do texto antes de qualquer chamada de IA (pseudonimização).</li>
        </ul>
      </Cartao>
    </>
  );
}
