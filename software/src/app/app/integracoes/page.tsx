import type { Metadata } from "next";
import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { cronExecucoes } from "@/db/schema";
import { exigirUsuario, pode } from "@/lib/auth/sessao";
import { statusIntegracoes, type StatusIntegracao } from "@/lib/integracoes";
import { JOBS, descreverResumo, type ResumoJob } from "@/lib/cron/jobs";
import { modeloPrincipal } from "@/lib/ia/anthropic";
import { mascararToken } from "@/lib/telegram/mascara";
import { appUrl, appUrlEhLocal } from "@/lib/url-publica";
import { dataHora } from "@/lib/formato";
import { Aviso, CabecalhoPagina, Cartao, Selo, TituloCartao } from "@/components/ui";
import { RodarAgora, TestarConexao, TestarSimples } from "@/features/integracoes/componentes";
import { SaudeSistema } from "@/features/integracoes/saude";
import { Botao } from "@/components/ui";

export const metadata: Metadata = { title: "Integrações" };

const SELO: Record<StatusIntegracao, { texto: string; tom: "verde" | "vermelho" | "amarelo" | "cinza" }> = {
  conectada: { texto: "Conectada", tom: "verde" },
  falhou: { texto: "Falhou no último teste", tom: "vermelho" },
  nao_testada: { texto: "Chave configurada, ainda não testada", tom: "amarelo" },
  nao_configurada: { texto: "Não conectada", tom: "cinza" },
};

function Passos({ itens }: { itens: React.ReactNode[] }) {
  return (
    <ol className="list-decimal space-y-1.5 pl-5 text-sm text-suave">
      {itens.map((t, i) => (
        <li key={i}>{t}</li>
      ))}
    </ol>
  );
}

const codigo = "rounded bg-fundo px-1 py-0.5 font-mono text-xs text-tinta";

export default async function PaginaIntegracoes() {
  const usuario = await exigirUsuario();
  const s = await statusIntegracoes();
  const podeTestar = pode(usuario, "gerenciar_integracoes");
  const execucoes = await Promise.all(
    Object.values(JOBS).map(async (j) => {
      const [ultima] = await db.select().from(cronExecucoes).where(eq(cronExecucoes.job, j.nome)).orderBy(desc(cronExecucoes.iniciadoEm)).limit(1);
      return { job: j, ultima };
    }),
  );

  return (
    <>
      <CabecalhoPagina titulo="Integrações" descricao="Serviços externos que o sistema usa, com o status verificado de verdade e o passo a passo para conectar." />

      {appUrlEhLocal() ? (
        <div className="mb-6">
          <Aviso tom="amarelo">
            O endereço do sistema (<span className="font-mono">APP_URL</span>) está como {appUrl()}. Ao publicar, configure <span className="font-mono">APP_URL</span> com o endereço público (https) para os links e o webhook do Telegram.
          </Aviso>
        </div>
      ) : null}

      <SaudeSistema organizacaoId={usuario.organizacao.id} />

      <div className="grid gap-6 xl:grid-cols-2">
        <Cartao>
          <TituloCartao descricao="Bot que conversa com síndico, funcionários, moradores e prestadores." acao={<Selo tom={SELO[s.telegram.status].tom}>{SELO[s.telegram.status].texto}</Selo>}>
            Telegram
          </TituloCartao>
          <Passos
            itens={[
              <>No Telegram, abra o <a className="text-primaria underline" href="https://t.me/BotFather" target="_blank" rel="noopener noreferrer">@BotFather</a>, envie <span className={codigo}>/newbot</span>, escolha o nome e o @usuario do bot (terminado em “bot”).</>,
              <>Copie o token que o BotFather mostrar e cole em <span className={codigo}>TELEGRAM_BOT_TOKEN</span> no arquivo <span className={codigo}>.env.local</span> (ou nas variáveis de ambiente do servidor). Coloque o @usuario em <span className={codigo}>TELEGRAM_BOT_USERNAME</span>.</>,
              <>Reinicie o sistema e toque em “Testar conexão”: o sistema chama o <span className={codigo}>getMe</span> do Telegram.</>,
              <>Sem endereço público (no seu computador): rode o comando de escuta local <span className={codigo}>telegram:polling</span> em outro terminal. Com endereço público https: na página Telegram, use “Ativar webhook neste endereço”.</>,
              <>Opcional: defina <span className={codigo}>TELEGRAM_WEBHOOK_SECRET</span> (letras, números, _ e -) para fixar o segredo do webhook; sem ele, o sistema gera um próprio da instalação.</>,
            ]}
          />
          <p className="mt-3 text-xs text-suave">
            Token atual: {mascararToken(process.env.TELEGRAM_BOT_TOKEN)} · Documentação:{" "}
            <a className="text-primaria underline" href="https://core.telegram.org/bots/api" target="_blank" rel="noopener noreferrer">
              Bot API
            </a>
          </p>
          {s.telegram.testadoEm ? (
            <p className="mt-2 text-xs text-suave">
              Último teste em {dataHora(s.telegram.testadoEm)}: {s.telegram.detalhe}
            </p>
          ) : null}
          {podeTestar ? (
            <div className="mt-4">
              <TestarConexao servico="telegram" desabilitado={s.telegram.status === "nao_configurada"} />
            </div>
          ) : null}
        </Cartao>

        <Cartao>
          <TituloCartao descricao="Lê recibos, certidões e comprovantes, faz a triagem dos chamados, rascunha comunicados e responde dúvidas com citação literal. Sem a chave, tudo funciona à mão." acao={<Selo tom={SELO[s.anthropic.status].tom}>{SELO[s.anthropic.status].texto}</Selo>}>
            IA (Anthropic)
          </TituloCartao>
          <Passos
            itens={[
              <>Crie uma conta em <a className="text-primaria underline" href="https://console.anthropic.com" target="_blank" rel="noopener noreferrer">console.anthropic.com</a> e adicione créditos.</>,
              <>Em “API Keys”, crie uma chave e cole em <span className={codigo}>ANTHROPIC_API_KEY</span> no <span className={codigo}>.env.local</span> (ou nas variáveis do servidor).</>,
              <>Opcional: <span className={codigo}>ANTHROPIC_MODEL</span> (padrão {modeloPrincipal()}, o mais barato).</>,
              <>Reinicie e toque em “Testar conexão”: o sistema faz uma chamada real e curta.</>,
              <>Perguntas, fotos e documentos são enviados à Anthropic (EUA) para ler e sugerir, sem nome nem contato de moradores (LGPD, art. 33). Limite mensal por conta: US$ 5 (variável <span className={codigo}>IA_LIMITE_MENSAL_USD</span>).</>,
            ]}
          />
          <p className="mt-3 text-xs text-suave">
            Documentação:{" "}
            <a className="text-primaria underline" href="https://docs.anthropic.com/en/api/getting-started" target="_blank" rel="noopener noreferrer">
              API da Anthropic
            </a>
          </p>
          {s.anthropic.testadoEm ? (
            <p className="mt-2 text-xs text-suave">
              Último teste em {dataHora(s.anthropic.testadoEm)}: {s.anthropic.detalhe}
            </p>
          ) : null}
          {podeTestar ? (
            <div className="mt-4">
              <TestarConexao servico="anthropic" desabilitado={s.anthropic.status === "nao_configurada"} />
            </div>
          ) : null}
        </Cartao>

        <Cartao>
          <TituloCartao
            descricao="Onde ficam as fotos e os documentos recebidos pelo bot."
            acao={
              <Selo tom={s.armazenamento === "nenhum" ? "vermelho" : "verde"}>
                {s.armazenamento === "blob" ? "Nuvem (privado)" : s.armazenamento === "local" ? "Pasta local" : "Não configurado"}
              </Selo>
            }
          >
            Armazenamento de arquivos
          </TituloCartao>
          <Passos
            itens={[
              <>No computador, sem configurar nada, os arquivos ficam na pasta <span className={codigo}>.data/uploads</span>.</>,
              <>Em servidor publicado, crie um armazenamento de arquivos privado e cole o token em <span className={codigo}>BLOB_READ_WRITE_TOKEN</span>. Os arquivos passam a ser entregues por link temporário assinado.</>,
            ]}
          />
          {podeTestar ? (
            <div className="mt-4">
              <TestarSimples servico="armazenamento" />
            </div>
          ) : null}
        </Cartao>

        <Cartao>
          <TituloCartao descricao="Rodam sozinhas uma vez por dia no servidor publicado; aqui você pode rodar na hora.">Rotinas agendadas</TituloCartao>
          <ul className="space-y-4">
            {execucoes.map(({ job, ultima }) => (
              <li key={job.nome} className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{job.nome === "diario" ? "Diário (08h)" : job.nome === "frequente" ? "Frequente (opcional)" : "Enviar fila de avisos"}</p>
                  <p className="text-xs text-suave">{job.descricao}</p>
                  <p className="mt-1 text-xs text-suave">
                    {ultima
                      ? `Última: ${dataHora(ultima.iniciadoEm)} · ${ultima.status === "ok" ? descreverResumo((ultima.resumo ?? {}) as ResumoJob) : ultima.status === "erro" ? `erro: ${ultima.erro}` : "em andamento"}`
                      : "Ainda não rodou."}
                  </p>
                </div>
                {podeTestar ? <RodarAgora job={job.nome} /> : null}
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg bg-fundo p-3 text-xs text-suave">
            <p className="font-medium text-tinta">Agendador frequente (opcional)</p>
            <p className="mt-1">
              O plano Hobby da Vercel roda o cron só 1 vez por dia (o diário às 08h, com até 59 min de atraso), e é para uso pessoal e não comercial: condomínio em operação usa o Pro, que permite acrescentar ao <span className={codigo}>vercel.json</span> a linha{" "}
              <span className={codigo}>{'{ "path": "/api/cron/frequente", "schedule": "*/15 * * * *" }'}</span>. Fora da Vercel (ou para avaliar), um agendador externo gratuito como o cron-job.org pode chamar <span className={codigo}>{`${appUrl()}/api/cron/frequente`}</span> a cada 15 min com o cabeçalho <span className={codigo}>Authorization: Bearer &lt;CRON_SECRET&gt;</span> (o GitHub Actions com schedule é outra opção, com atraso frequente). Sem agendador, tudo vai no diário. A emergência não depende de cron.
            </p>
          </div>
        </Cartao>

        <Cartao>
          <TituloCartao descricao="APIs públicas sem chave, com User-Agent próprio.">BrasilAPI e ViaCEP</TituloCartao>
          <p className="text-sm text-suave">BrasilAPI: razão social e situação cadastral do CNPJ (condomínio e prestadores). ViaCEP: endereço pelo CEP.</p>
          {podeTestar ? (
            <div className="mt-3 flex flex-wrap gap-6">
              <TestarSimples servico="brasilapi" />
              <TestarSimples servico="viacep" />
            </div>
          ) : null}
        </Cartao>

        {podeTestar ? (
          <Cartao>
            <TituloCartao descricao="Seus dados não ficam presos: ZIP com um CSV por tabela da organização (os arquivos aparecem listados). Senhas e dados de pagamento cifrados não saem.">Exportar tudo</TituloCartao>
            <form action="/api/exportacoes" method="post">
              <Botao type="submit" variante="secundario">
                Baixar ZIP com todos os dados
              </Botao>
            </form>
          </Cartao>
        ) : null}
      </div>
    </>
  );
}
