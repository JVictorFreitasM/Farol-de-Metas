import { Meta, TipoAgregacaoMeta, TipoAgregacaoReal } from "@prisma/client";
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

export type PeriodoTipo = "mes" | "intervalo" | "trimestre" | "semestre" | "ano";

/** Resolve um tipo de período (mês/intervalo/trimestre/semestre/ano) no intervalo [mesInicio, mesFim]
 * que calcularAcumuladoPeriodo espera, mais um rótulo legível (ex: "Q1", "H1", "Jan–Mar"). */
export function resolverIntervaloMeses(
  tipo: PeriodoTipo,
  params: { mes?: MesKey; mesInicio?: MesKey; mesFim?: MesKey; trimestre?: number; semestre?: number }
): { mesInicio: MesKey; mesFim: MesKey; label: string } {
  switch (tipo) {
    case "mes": {
      if (!params.mes) throw new Error("Parâmetro 'mes' é obrigatório para periodo_tipo=mes");
      return { mesInicio: params.mes, mesFim: params.mes, label: params.mes };
    }
    case "intervalo": {
      if (!params.mesInicio || !params.mesFim) {
        throw new Error("Parâmetros 'mes_inicio' e 'mes_fim' são obrigatórios para periodo_tipo=intervalo");
      }
      if (MESES.indexOf(params.mesInicio) > MESES.indexOf(params.mesFim)) {
        throw new Error("mes_inicio deve ser anterior ou igual a mes_fim");
      }
      return { mesInicio: params.mesInicio, mesFim: params.mesFim, label: `${params.mesInicio}–${params.mesFim}` };
    }
    case "trimestre": {
      if (!params.trimestre || params.trimestre < 1 || params.trimestre > 4) {
        throw new Error("Parâmetro 'trimestre' deve ser 1, 2, 3 ou 4");
      }
      const inicioIdx = (params.trimestre - 1) * 3;
      return { mesInicio: MESES[inicioIdx], mesFim: MESES[inicioIdx + 2], label: `Q${params.trimestre}` };
    }
    case "semestre": {
      if (!params.semestre || params.semestre < 1 || params.semestre > 2) {
        throw new Error("Parâmetro 'semestre' deve ser 1 ou 2");
      }
      const inicioIdx = (params.semestre - 1) * 6;
      return { mesInicio: MESES[inicioIdx], mesFim: MESES[inicioIdx + 5], label: `H${params.semestre}` };
    }
    case "ano":
      return { mesInicio: "Jan", mesFim: "Dez", label: "Ano" };
  }
}

function somaOuMedia(valores: Decimal[], tipo: "soma" | "media"): Decimal | null {
  if (valores.length === 0) return null;
  const soma = valores.reduce((acc, v) => acc.plus(v), new Decimal(0));
  return tipo === "media" ? soma.div(valores.length) : soma;
}

/** SUM(reais) / SUM(metas) * 100 — usado por proporcao_agregada. */
function proporcaoAgregada(valoresReal: Decimal[], valoresMeta: Decimal[]): Decimal | null {
  if (valoresReal.length === 0 || valoresMeta.length === 0) return null;
  const somaReal = valoresReal.reduce((acc, v) => acc.plus(v), new Decimal(0));
  const somaMeta = valoresMeta.reduce((acc, v) => acc.plus(v), new Decimal(0));
  if (somaMeta.isZero()) return null;
  return somaReal.div(somaMeta).mul(100);
}

export interface ConfigAgregacaoIC {
  tipoAgregacaoMeta: TipoAgregacaoMeta;
  tipoAgregacaoReal: TipoAgregacaoReal;
  metaManualAcum: Decimal | null;
}

/**
 * Recalcula os campos agregados de um IC com agrega_filhos=true a partir dos IVs filhos,
 * respeitando regras separadas para Meta e Real (OS-009):
 * - tipo_agregacao_meta: soma | media | meta_manual (usa meta_manual_acum como valor fixo)
 * - tipo_agregacao_real: soma | media | proporcao_agregada (SUM(reais filhos) / SUM(metas filhos) * 100)
 */
export function recalcularAgregadoIC(
  filhos: Meta[],
  config: ConfigAgregacaoIC
): {
  metaPorMes: Record<MesKey, Decimal | null>;
  realPorMes: Record<MesKey, Decimal | null>;
  acumMeta: Decimal | null;
  acumReal: Decimal | null;
} {
  const metaPorMes = {} as Record<MesKey, Decimal | null>;
  const realPorMes = {} as Record<MesKey, Decimal | null>;

  for (const mes of MESES) {
    const valoresMeta = filhos.map((f) => f[campoMeta(mes)] as Decimal | null).filter((v): v is Decimal => v != null);
    const valoresReal = filhos.map((f) => f[campoReal(mes)] as Decimal | null).filter((v): v is Decimal => v != null);

    metaPorMes[mes] =
      config.tipoAgregacaoMeta === "meta_manual" ? null : somaOuMedia(valoresMeta, config.tipoAgregacaoMeta);

    realPorMes[mes] =
      config.tipoAgregacaoReal === "proporcao_agregada"
        ? proporcaoAgregada(valoresReal, valoresMeta)
        : somaOuMedia(valoresReal, config.tipoAgregacaoReal);
  }

  const acumMetaValores = filhos.map((f) => f.acumMeta).filter((v): v is Decimal => v != null);
  const acumRealValores = filhos.map((f) => f.acumReal).filter((v): v is Decimal => v != null);

  const acumMeta =
    config.tipoAgregacaoMeta === "meta_manual"
      ? config.metaManualAcum
      : somaOuMedia(acumMetaValores, config.tipoAgregacaoMeta);

  const acumReal =
    config.tipoAgregacaoReal === "proporcao_agregada"
      ? proporcaoAgregada(acumRealValores, acumMetaValores)
      : somaOuMedia(acumRealValores, config.tipoAgregacaoReal);

  return { metaPorMes, realPorMes, acumMeta, acumReal };
}
