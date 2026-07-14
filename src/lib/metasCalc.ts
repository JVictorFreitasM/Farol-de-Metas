import { Meta } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

export const MESES = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"] as const;
export type MesKey = (typeof MESES)[number];

export function campoMeta(mes: MesKey): keyof Meta {
  return (`meta${mes}` as unknown) as keyof Meta;
}
export function campoReal(mes: MesKey): keyof Meta {
  return (`real${mes}` as unknown) as keyof Meta;
}

function valoresPreenchidos(meta: Meta, campo: (mes: MesKey) => keyof Meta): Decimal[] {
  return MESES.map((mes) => meta[campo(mes)] as Decimal | null).filter((v): v is Decimal => v != null);
}

/** Recalcula acum_meta ou acum_real de uma linha a partir dos 12 meses, respeitando tipo_acumulado. */
export function calcularAcumuladoLinha(meta: Meta, tipo: "meta" | "real"): Decimal | null {
  const valores = valoresPreenchidos(meta, tipo === "meta" ? campoMeta : campoReal);
  if (valores.length === 0) return null;

  const soma = valores.reduce((acc, v) => acc.plus(v), new Decimal(0));
  return meta.tipoAcumulado === "media" ? soma.div(valores.length) : soma;
}

/** Calcula o acumulado (meta e real) de uma linha restrito a um intervalo [mesInicio, mesFim] de meses. */
export function calcularAcumuladoPeriodo(
  meta: Meta,
  mesInicio: MesKey,
  mesFim: MesKey
): {
  mesesPeriodo: MesKey[];
  acumMeta: Decimal | null;
  acumReal: Decimal | null;
  percentual: Decimal | null;
  status: "ok" | "nok" | null;
  detalhes: { mes: MesKey; meta: Decimal | null; real: Decimal | null }[];
} {
  const idxInicio = MESES.indexOf(mesInicio);
  const idxFim = MESES.indexOf(mesFim);
  if (idxInicio < 0 || idxFim < 0 || idxInicio > idxFim) {
    throw new Error("Período inválido: mês inicial deve ser anterior ou igual ao mês final");
  }

  const mesesPeriodo = MESES.slice(idxInicio, idxFim + 1);
  const valoresMeta = mesesPeriodo.map((mes) => meta[campoMeta(mes)] as Decimal | null).filter((v): v is Decimal => v != null);
  const valoresReal = mesesPeriodo.map((mes) => meta[campoReal(mes)] as Decimal | null).filter((v): v is Decimal => v != null);

  const acumMeta =
    valoresMeta.length > 0
      ? (() => {
          const soma = valoresMeta.reduce((acc, v) => acc.plus(v), new Decimal(0));
          return meta.tipoAcumulado === "media" ? soma.div(valoresMeta.length) : soma;
        })()
      : null;

  const acumReal =
    valoresReal.length > 0
      ? (() => {
          const soma = valoresReal.reduce((acc, v) => acc.plus(v), new Decimal(0));
          return meta.tipoAcumulado === "media" ? soma.div(valoresReal.length) : soma;
        })()
      : null;

  let percentual: Decimal | null = null;
  let status: "ok" | "nok" | null = null;
  if (acumMeta != null && acumReal != null && !acumMeta.isZero()) {
    percentual = acumReal.div(acumMeta).mul(100).toDecimalPlaces(2);
  }
  if (acumMeta != null && acumReal != null) {
    status = meta.tipoMeta === "maior_melhor" ? (acumReal.gte(acumMeta) ? "ok" : "nok") : (acumReal.lte(acumMeta) ? "ok" : "nok");
  }

  return {
    mesesPeriodo,
    acumMeta,
    acumReal,
    percentual,
    status,
    detalhes: mesesPeriodo.map((mes) => ({
      mes,
      meta: (meta[campoMeta(mes)] as Decimal | null) ?? null,
      real: (meta[campoReal(mes)] as Decimal | null) ?? null,
    })),
  };
}

/**
 * Recalcula os campos agregados de um IC com agrega_filhos=true a partir dos IVs filhos:
 * meta_jan..dez = soma dos respectivos meses dos filhos; acum_meta/acum_real = soma dos acum dos filhos.
 */
export function recalcularAgregadoIC(filhos: Meta[]): {
  metaPorMes: Record<MesKey, Decimal | null>;
  realPorMes: Record<MesKey, Decimal | null>;
  acumMeta: Decimal | null;
  acumReal: Decimal | null;
} {
  const metaPorMes = {} as Record<MesKey, Decimal | null>;
  const realPorMes = {} as Record<MesKey, Decimal | null>;
  for (const mes of MESES) {
    const valoresMeta = filhos
      .map((f) => f[campoMeta(mes)] as Decimal | null)
      .filter((v): v is Decimal => v != null);
    metaPorMes[mes] = valoresMeta.length ? valoresMeta.reduce((acc, v) => acc.plus(v), new Decimal(0)) : null;

    const valoresReal = filhos
      .map((f) => f[campoReal(mes)] as Decimal | null)
      .filter((v): v is Decimal => v != null);
    realPorMes[mes] = valoresReal.length ? valoresReal.reduce((acc, v) => acc.plus(v), new Decimal(0)) : null;
  }

  const acumMetaValores = filhos.map((f) => f.acumMeta).filter((v): v is Decimal => v != null);
  const acumRealValores = filhos.map((f) => f.acumReal).filter((v): v is Decimal => v != null);

  return {
    metaPorMes,
    realPorMes,
    acumMeta: acumMetaValores.length ? acumMetaValores.reduce((acc, v) => acc.plus(v), new Decimal(0)) : null,
    acumReal: acumRealValores.length ? acumRealValores.reduce((acc, v) => acc.plus(v), new Decimal(0)) : null,
  };
}
