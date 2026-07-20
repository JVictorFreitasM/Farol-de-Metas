import { Indicador } from "@prisma/client";

// OS-013: produto_id vive em Indicador (não varia por ano), não mais em Meta.
export function contarIndicadoresAtivosPorProduto(indicadores: Pick<Indicador, "produtoId">[]): Map<string, number> {
  const contagem = new Map<string, number>();
  for (const indicador of indicadores) {
    if (!indicador.produtoId) continue;
    contagem.set(indicador.produtoId, (contagem.get(indicador.produtoId) ?? 0) + 1);
  }
  return contagem;
}
