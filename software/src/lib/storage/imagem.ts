/**
 * Imagens: reduz o lado maior para até 1.568 px e regrava em JPEG SEM metadados
 * (EXIF, GPS). Usado em imagem recebida como documento no Telegram e em upload do painel.
 */
export const LADO_MAXIMO = 1568;

export async function prepararImagem(bytes: Uint8Array): Promise<{ bytes: Uint8Array; mimeType: "image/jpeg" } | null> {
  try {
    const sharp = (await import("sharp")).default;
    // sharp não copia metadados para a saída, a menos que se peça withMetadata(): o EXIF sai.
    const saida = await sharp(Buffer.from(bytes))
      .rotate()
      .resize({ width: LADO_MAXIMO, height: LADO_MAXIMO, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    return { bytes: new Uint8Array(saida), mimeType: "image/jpeg" };
  } catch {
    return null;
  }
}
