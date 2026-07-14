import { Meta } from "@prisma/client";

export function contarMetasAtivasPorProduto(metas: Pick<Meta, "produtoId">[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const meta of metas) {
    if (!meta.produtoId) continue;
    contagem.set(meta.produtoId, (contagem.get(meta.produtoId) ?? 0) + 1);
  }
  return contagem;
}
