import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { arquivos, pessoas, telegramMensagens } from "@/db/schema";
import { analisarComando, montarRoteador, tratarUpdate, mensagemSemVinculo, criarConvite } from "@/lib/telegram";
import { criarCenario, mensagem, prepararBanco, saidaDeTeste, toqueBotao } from "./ajuda";

let cenario: Awaited<ReturnType<typeof criarCenario>>;

beforeAll(async () => {
  await prepararBanco();
  cenario = await criarCenario();
  await cenario.nova("Sônia Síndica", "sindico", { telegramChatId: 501, telegramUserId: 501 });
  await cenario.nova("Mário Morador", "morador", { telegramChatId: 502, telegramUserId: 502, unidade: "101" });
  await cenario.nova("Outra Moradora", "morador", { telegramChatId: 503, telegramUserId: 503, unidade: "202" });
});

describe("analisarComando", () => {
  it("separa comando, @bot e argumentos", () => {
    expect(analisarComando("/Ajuda@meu_bot  x y")).toEqual({ comando: "ajuda", args: "x y" });
    expect(analisarComando("/start abc")).toEqual({ comando: "start", args: "abc" });
    expect(analisarComando("olá")).toEqual({ comando: null, args: "" });
  });
});

describe("roteador", () => {
  it("quem não está vinculado recebe só a instrução de como pedir o convite", async () => {
    const r = montarRoteador();
    for (const texto of ["oi", "/ajuda", "/eu", "/comando_qualquer"]) {
      const { saida, enviadas } = saidaDeTeste();
      await tratarUpdate(mensagem(999, texto), saida, r);
      expect(enviadas).toHaveLength(1);
      expect(enviadas[0].texto).toBe(mensagemSemVinculo());
    }
  });

  it("não guarda o texto de quem não está vinculado", async () => {
    const { saida } = saidaDeTeste();
    await tratarUpdate(mensagem(998, "meu CPF é 123"), saida, montarRoteador());
    const linhas = await db.select().from(telegramMensagens).where(eq(telegramMensagens.chatId, 998));
    expect(linhas).toHaveLength(1);
    expect(linhas[0].texto).toBeNull();
    expect(linhas[0].organizacaoId).toBeNull();
  });

  it("/ajuda lista os comandos do papel, e comando restrito é negado a outro papel", async () => {
    const r = montarRoteador();
    r.registrarComando({
      nome: "fila",
      descricao: "Só para síndico",
      permissao: ["sindico"],
      async executar(ctx) {
        await ctx.responder("ok síndico");
      },
    });
    const s1 = saidaDeTeste();
    await tratarUpdate(mensagem(501, "/ajuda"), s1.saida, r);
    expect(s1.enviadas[0].texto).toContain("/fila");
    expect(s1.enviadas[0].texto).toContain("/sair");

    const s2 = saidaDeTeste();
    await tratarUpdate(mensagem(502, "/ajuda"), s2.saida, r);
    expect(s2.enviadas[0].texto).not.toContain("/fila");
    expect(s2.enviadas[0].texto).not.toContain("/start");

    const s3 = saidaDeTeste();
    await tratarUpdate(mensagem(502, "/fila"), s3.saida, r);
    expect(s3.enviadas[0].texto).toContain("não está disponível para o seu perfil");

    const s4 = saidaDeTeste();
    await tratarUpdate(mensagem(501, "/fila"), s4.saida, r);
    // Toda resposta começa com "{Condomínio} · {papel}" (B1).
    expect(s4.enviadas[0].texto).toBe("Condomínio de Administradora Teste · síndico\n\nok síndico");
  });

  it("comando desconhecido de quem está vinculado orienta a usar /ajuda", async () => {
    const { saida, enviadas } = saidaDeTeste();
    await tratarUpdate(mensagem(502, "/xyz"), saida, montarRoteador());
    expect(enviadas[0].texto).toContain("Não conheço o comando /xyz");
  });

  it("/eu mostra só os dados da própria pessoa", async () => {
    const { saida, enviadas } = saidaDeTeste();
    await tratarUpdate(mensagem(502, "/eu"), saida, montarRoteador());
    expect(enviadas[0].texto).toContain("Mário Morador");
    expect(enviadas[0].texto).toContain("101");
    expect(enviadas[0].texto).not.toContain("Outra Moradora");
    expect(enviadas[0].texto).not.toContain("202");
  });

  it("mensagem livre passa pelo ponto de extensão (a IA entra aqui)", async () => {
    const r = montarRoteador();
    const vistos: string[] = [];
    r.registrarMensagemLivre(
      async (ctx) => {
        vistos.push(`${ctx.pessoa?.nome}: ${ctx.texto}`);
        await ctx.responder("resposta do módulo");
        return true;
      },
      { prioridade: "inicio" },
    );
    const { saida, enviadas } = saidaDeTeste();
    await tratarUpdate(mensagem(502, "o portão está quebrado"), saida, r);
    expect(vistos).toEqual(["Mário Morador: o portão está quebrado"]);
    expect(enviadas.map((e) => e.texto.split("\n\n").pop())).toEqual(["resposta do módulo"]);
  });

  it("texto livre do morador pergunta se é dúvida ou problema (e fica registrado)", async () => {
    const { saida, enviadas } = saidaDeTeste();
    await tratarUpdate(mensagem(502, "bom dia"), saida, montarRoteador());
    expect(enviadas[0].texto).toContain("É uma dúvida ou um problema para consertar?");
    const [log] = await db.select().from(telegramMensagens).where(eq(telegramMensagens.texto, "bom dia"));
    expect(log.organizacaoId).toBe(cenario.org.id);
  });

  it("/sair mostra teclado inline; o botão confirma, responde o callback e desvincula", async () => {
    const r = montarRoteador();
    const s1 = saidaDeTeste();
    await tratarUpdate(mensagem(503, "/sair"), s1.saida, r);
    expect(JSON.stringify(s1.enviadas[0].teclado)).toContain("sair:sim");

    const s2 = saidaDeTeste();
    await tratarUpdate(toqueBotao(503, "sair:sim"), s2.saida, r);
    expect(s2.botoes).toHaveLength(1);
    expect(s2.editadas[0].texto).toContain("desconectado");
    const [p] = await db.select().from(pessoas).where(eq(pessoas.nome, "Outra Moradora"));
    expect(p.telegramChatId).toBeNull();
  });

  it("botão desconhecido também é respondido (sem deixar o Telegram carregando)", async () => {
    const { saida, botoes } = saidaDeTeste();
    await tratarUpdate(toqueBotao(501, "nao_existe:1"), saida, montarRoteador());
    expect(botoes).toHaveLength(1);
    expect(botoes[0].texto).toContain("não está mais disponível");
  });

  it("mensagens de grupo são ignoradas", async () => {
    const { saida, enviadas } = saidaDeTeste();
    const u = mensagem(-100123, "/ajuda");
    u.message!.chat.type = "supergroup";
    const status = await tratarUpdate(u, saida, montarRoteador());
    expect(status).toBe("ignorado");
    expect(enviadas).toHaveLength(0);
  });

  it("foto de quem está vinculado é baixada, guardada e registrada", async () => {
    const bytes = new Uint8Array(2048).fill(7);
    const { saida, enviadas } = saidaDeTeste(bytes);
    const u = mensagem(501, "", {
      text: undefined,
      caption: "vazamento na garagem",
      photo: [
        { file_id: "pequena", file_unique_id: "u1", width: 90, height: 90, file_size: 100 },
        { file_id: "grande", file_unique_id: "u2", width: 1280, height: 960, file_size: 2048 },
      ],
    });
    await tratarUpdate(u, saida, montarRoteador());
    // Sem estado de conversa, o bot pergunta a que se refere (T-CE-01).
    expect(enviadas[0].texto).toContain("Isso é de qual tarefa ou chamado?");
    const [a] = await db.select().from(arquivos).where(eq(arquivos.telegramFileId, "grande"));
    expect(a.tamanhoBytes).toBe(2048);
    expect(a.provedor).toBe("local");
    expect(a.organizacaoId).toBe(cenario.org.id);
  });

  it("documento acima de 20 MB é recusado antes do download", async () => {
    const { saida, enviadas } = saidaDeTeste();
    const u = mensagem(501, "", {
      text: undefined,
      document: { file_id: "enorme", file_unique_id: "u3", file_name: "planta.pdf", mime_type: "application/pdf", file_size: 25 * 1024 * 1024 },
    });
    await tratarUpdate(u, saida, montarRoteador());
    expect(enviadas[0].texto).toContain("limite do Telegram para bots é 20 MB");
  });

  it("o código do /start nunca fica guardado no registro da conversa", async () => {
    const pessoa = await cenario.nova("Nova Pessoa", "funcionario");
    const { codigo } = await criarConvite({ organizacaoId: cenario.org.id, pessoaId: pessoa.id });
    const { saida } = saidaDeTeste();
    await tratarUpdate(mensagem(777, `/start ${codigo}`), saida, montarRoteador());
    const linhas = await db.select().from(telegramMensagens).where(eq(telegramMensagens.chatId, 777));
    expect(linhas[0].texto).toBe("/start");
    expect(linhas[0].pessoaId).toBe(pessoa.id);
    expect(JSON.stringify(linhas)).not.toContain(codigo);
  });
});

describe("comando de outro perfil do mesmo Telegram", () => {
  it("troca para o único vínculo que pode e executa", async () => {
    const { criarRoteador } = await import("@/lib/telegram/roteador");
    const r = criarRoteador();
    const executados: string[] = [];
    r.registrarComando({ nome: "aprovar", descricao: "x", permissao: ["sindico"], async executar(ctx) { executados.push(ctx.pessoa!.id); } });
    const sindico = { id: "s1", nome: "José", papel: "sindico", condominioId: "c1", condominioNome: "Jardim", unidade: null } as never;
    const morador = { id: "m1", nome: "José", papel: "morador", condominioId: "c1", condominioNome: "Jardim", unidade: "201" } as never;
    r.definirTrocaDeContexto(async (_ctx, p) => p);
    const respostas: string[] = [];
    const ctx = { chatPrivado: true, mensagem: {}, comando: "aprovar", args: "", pessoa: morador, opcoesContexto: [sindico, morador], responder: async (t: string) => { respostas.push(t); return null; } } as never;
    const res = await r.rotear(ctx);
    expect(res).toEqual({ tipo: "comando", nome: "aprovar" });
    expect(executados).toEqual(["s1"]);
    expect(respostas[0]).toContain("Troquei esta conversa");
  });
});
