"use client";

import { useState } from "react";
import { Botao, Campo, Rotulo, Selecao } from "@/components/ui";

/**
 * Upload do documento com o texto extraído NO NAVEGADOR (pdf.js e mammoth): o servidor
 * recebe o arquivo e o texto. PDF sem texto (escaneado) avisa para colar o texto ou enviar DOCX.
 */
async function extrairTexto(arquivo: File): Promise<string> {
  const buf = await arquivo.arrayBuffer();
  if (arquivo.type === "application/pdf" || arquivo.name.toLowerCase().endsWith(".pdf")) {
    const pdfjs = await import("pdfjs-dist");
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(buf) }).promise;
    const paginas: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      const t = await pg.getTextContent();
      paginas.push(t.items.map((it) => ("str" in it ? it.str + (it.hasEOL ? "\n" : "") : "")).join(""));
    }
    return paginas.join("\n");
  }
  if (arquivo.name.toLowerCase().endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const r = await mammoth.extractRawText({ arrayBuffer: buf });
    return r.value;
  }
  if (arquivo.type.startsWith("text/")) return new TextDecoder().decode(buf);
  return "";
}

export function UploadDocumento({ acao, c }: { acao: (form: FormData) => Promise<void>; c: string }) {
  const [texto, setTexto] = useState("");
  const [aviso, setAviso] = useState<string | null>(null);
  const [lendo, setLendo] = useState(false);
  return (
    <form action={acao} className="space-y-3">
      <input type="hidden" name="c" value={c} />
      <input type="hidden" name="voltar" value="/app/documentos" />
      <div>
        <Rotulo htmlFor="tipo">Tipo</Rotulo>
        <Selecao id="tipo" name="tipo" defaultValue="regimento">
          <option value="regimento">Regimento interno</option>
          <option value="convencao">Convenção</option>
          <option value="ata">Ata (nasce oculta e fora das respostas)</option>
          <option value="contrato">Contrato</option>
          <option value="apolice">Apólice</option>
          <option value="laudo">Laudo</option>
          <option value="outro">Outro</option>
        </Selecao>
      </div>
      <div>
        <Rotulo htmlFor="titulo">Título</Rotulo>
        <Campo id="titulo" name="titulo" />
      </div>
      <div>
        <Rotulo htmlFor="arquivo">PDF com texto, DOCX ou TXT (até 4 MB)</Rotulo>
        <input
          id="arquivo"
          type="file"
          name="arquivo"
          accept=".pdf,.docx,.txt,application/pdf,text/plain"
          className="block w-full text-sm"
          onChange={async (e) => {
            const f = e.currentTarget.files?.[0];
            if (!f) return;
            setLendo(true);
            setAviso(null);
            try {
              const t = (await extrairTexto(f)).trim();
              setTexto(t);
              setAviso(t.length < 20 ? "Este PDF parece uma imagem (sem texto): cole o texto abaixo ou envie um DOCX." : `Texto extraído no navegador: ${t.length.toLocaleString("pt-BR")} caracteres.`);
            } catch {
              setAviso("Não consegui ler o arquivo no navegador: cole o texto abaixo.");
            } finally {
              setLendo(false);
            }
          }}
        />
      </div>
      {aviso ? <p className="text-xs text-suave">{aviso}</p> : null}
      <div>
        <Rotulo htmlFor="texto">Texto (extraído ou colado)</Rotulo>
        <textarea id="texto" name="texto" rows={6} value={texto} onChange={(e) => setTexto(e.target.value)} className="w-full rounded-lg border border-borda bg-white px-3 py-2 text-sm" />
      </div>
      <Botao type="submit" disabled={lendo}>
        {lendo ? "Lendo…" : "Publicar documento"}
      </Botao>
    </form>
  );
}
