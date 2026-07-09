import { Meta, StatusMeta, TipoMeta } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

/**
 * ICs não preenchem valor_jan..dez diretamente, então sua coluna gerada
 * `acumulado` no banco é sempre 0. O valor real de um IC é a soma dos IVs
 * filhos, recalculada aqui em runtime (nunca persistida em `metas`).
 */
export function calcularAgregadoIC(filhos: Meta[]): {
  metaAno: Decimal | null;
  acumulado: Decimal;
  status: StatusMeta | null;
} {
  const metaAno = filhos.reduce<Decimal | null>((acc, f) => {
    if (f.metaAno == null) return acc;
    return (acc ?? new Decimal(0)).plus(f.metaAno);
  }, null);

  const acumulado = filhos.reduce(
    (acc, f) => acc.plus(f.acumulado ?? new Decimal(0)),
    new Decimal(0)
  );

  const tipoMeta: TipoMeta | undefined = filhos[0]?.tipoMeta;
  const status = calcularStatus(tipoMeta, acumulado, metaAno);

  return { metaAno, acumulado, status };
}

export function calcularStatus(
  tipoMeta: TipoMeta | undefined,
  acumulado: Decimal,
  metaAno: Decimal | null
): StatusMeta | null {
  if (!tipoMeta || metaAno == null) return null;
  if (tipoMeta === "maior_melhor") {
    return acumulado.gte(metaAno) ? "ok" : "nok";
  }
  return acumulado.lte(metaAno) ? "ok" : "nok";
}
