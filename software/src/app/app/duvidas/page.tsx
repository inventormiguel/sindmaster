import type { Metadata } from "next";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { duvidas, trechos } from "@/db/schema";
import { contextoDaPagina } from "@/lib/negocio/condominio-atual";
import { enviarRespostaAcao, responderAcao } from "@/features/duvidas/acoes";
import { dataHora } from "@/lib/formato";
import { RODAPE_DUVIDA } from "@/lib/negocio/linguagem";
import { Aviso, AreaTexto, Botao, CabecalhoPagina, Cartao, Selo, Vazio } from "@/components/ui";
import { Abas, Mensagens, Ocultos, SemCondominio, SeloExemplo } from "@/components/negocio";

export const metadata: Metadata = { title: "Dúvidas" };

export default async function Duvidas({ searchParams }: { searchParams: Promise<Record<string, string | string[]>> }) {
  const sp = await searchParams;
  const { condominio, gestao } = await contextoDaPagina(sp);
  if (!condominio) return <SemCondominio />;
  if (!gestao) return <Aviso tom="amarelo">Dúvidas dos moradores ficam com o síndico.</Aviso>;
  const c = condominio.id;
  const f = typeof sp.f === "string" ? sp.f : "enviar";
  const todas = await db.select().from(duvidas).where(eq(duvidas.condominioId, c)).orderBy(desc(duvidas.criadoEm)).limit(300);
  const salvas = await db.select().from(trechos).where(and(eq(trechos.condominioId, c), eq(trechos.origem, "resposta_sindico"))).orderBy(desc(trechos.criadoEm));
  const filtros: Record<string, (typeof todas)[number]["estado"][]> = { enviar: ["aguardando_envio"], encaminhadas: ["encaminhada"], respondidas: ["respondida_documentos", "respondida_sindico"], desviadas: ["desviada"] };
  const lista = f === "salvas" ? [] : todas.filter((d) => (filtros[f] ?? filtros.enviar).includes(d.estado));
  const voltar = `/app/duvidas?f=${f}`;
  return (
    <>
      <CabecalhoPagina titulo="Dúvidas dos moradores" descricao={`A IA responde só com o texto literal dos documentos do condomínio (citação conferida pelo código). Modo: ${condominio.modoRespostaDuvida === "conferencia" ? "conferência prévia (você envia)" : "envio automático quando a citação passa na conferência"}.`} />
      <Mensagens sp={sp} />
      <Abas
        itens={[
          { href: `/app/duvidas?c=${c}&f=enviar`, rotulo: `Para enviar (${todas.filter((d) => d.estado === "aguardando_envio").length})`, ativo: f === "enviar" },
          { href: `/app/duvidas?c=${c}&f=encaminhadas`, rotulo: `Encaminhadas (${todas.filter((d) => d.estado === "encaminhada").length})`, ativo: f === "encaminhadas" },
          { href: `/app/duvidas?c=${c}&f=respondidas`, rotulo: "Respondidas", ativo: f === "respondidas" },
          { href: `/app/duvidas?c=${c}&f=desviadas`, rotulo: "Desviadas", ativo: f === "desviadas" },
          { href: `/app/duvidas?c=${c}&f=salvas`, rotulo: `Respostas salvas (${salvas.length})`, ativo: f === "salvas" },
        ]}
      />
      {f === "salvas" ? (
        <div className="space-y-3">
          {salvas.length === 0 ? <Vazio>Nenhuma resposta salva ainda.</Vazio> : null}
          {salvas.map((t) => (
            <Cartao key={t.id}>
              <p className="text-xs text-suave">{t.rotulo}</p>
              <p className="mt-1 whitespace-pre-line text-sm">{t.texto}</p>
            </Cartao>
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {lista.length === 0 ? <Vazio>Nada por aqui.</Vazio> : null}
          {lista.map((d) => (
            <Cartao key={d.id}>
              <div className="flex flex-wrap items-start justify-between gap-2">
                <p className="font-medium">&ldquo;{d.pergunta}&rdquo;</p>
                <span className="flex gap-1">
                  <SeloExemplo exemplo={d.exemplo} />
                  <Selo>{dataHora(d.criadoEm)}</Selo>
                </span>
              </div>
              {d.motivoEncaminhamento ? <p className="mt-1 text-xs text-suave">Motivo: {d.motivoEncaminhamento}</p> : null}
              {d.citacoes?.length ? (
                <ul className="mt-2 space-y-1 rounded-lg bg-fundo p-3 text-sm">
                  {d.citacoes.map((ci) => (
                    <li key={ci.trechoId + ci.textoLiteral}>
                      <span className="font-medium">{ci.rotulo}:</span> &ldquo;{ci.textoLiteral}&rdquo;
                    </li>
                  ))}
                </ul>
              ) : null}
              {d.estado === "aguardando_envio" ? (
                <form action={enviarRespostaAcao} className="mt-3 space-y-2">
                  <Ocultos c={c} voltar={voltar} extra={{ duvidaId: d.id }} />
                  <Selo tom="amarelo">Resposta da IA · não conferida</Selo>
                  <AreaTexto name="resposta" defaultValue={d.resposta ?? ""} rows={3} />
                  <p className="text-xs text-suave">O morador recebe a identificação de IA, a citação literal, o rodapé &ldquo;{RODAPE_DUVIDA}&rdquo; e o botão &ldquo;Falar com o síndico&rdquo;.</p>
                  <Botao type="submit" tamanho="sm">
                    Conferi e enviar
                  </Botao>
                </form>
              ) : null}
              {d.estado === "encaminhada" || d.estado === "aguardando_envio" ? (
                <form action={responderAcao} className="mt-3 space-y-2 border-t border-borda pt-3">
                  <Ocultos c={c} voltar={voltar} extra={{ duvidaId: d.id }} />
                  <AreaTexto name="resposta" rows={2} placeholder="Responder eu mesmo" required />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="salvar" /> Salvar como resposta do condomínio (vira trecho citável)
                  </label>
                  <Botao type="submit" tamanho="sm" variante="secundario">
                    Enviar minha resposta
                  </Botao>
                </form>
              ) : null}
              {d.resposta && (d.estado === "respondida_documentos" || d.estado === "respondida_sindico") ? (
                <p className="mt-2 text-sm">
                  <span className="text-xs text-suave">{d.origemResposta === "sindico" ? "Resposta do síndico" : "Resposta da IA conferida"}{d.respondidaPorNome ? ` · ${d.respondidaPorNome}` : ""}:</span> {d.resposta}
                </p>
              ) : null}
            </Cartao>
          ))}
        </div>
      )}
    </>
  );
}
