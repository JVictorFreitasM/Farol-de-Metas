import { Indicador, Meta, TipoAgregacaoMeta, TipoAgregacaoReal } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";

// OS-013: tipo_acumulado e tipo_meta vivem em tabelas diferentes agora (Indicador guarda
// tipo_acumulado, fixo entre anos; Meta guarda tipo_meta, que ainda varia por linha/ano) —
// as funções de acumulado precisam da linha da Meta junto com o Indicador relacionado.
export type MetaComIndicador = Meta & { indicador: Indicador };

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

/** Recalcula acum_meta ou acum_real de uma linha a partir dos 12 meses, respeitando
 * tipo_acumulado_meta/tipo_acumulado_real (separados — OS-015). Quando o lado em questão é
 * "manual", os 12 meses continuam preenchidos normalmente (histórico), mas o acumulado final
 * vem de meta.acumMetaManual/meta.acumRealManual em vez de ser calculado a partir deles. */
export function calcularAcumuladoLinha(meta: MetaComIndicador, tipo: "meta" | "real"): Decimal | null {
  const tipoAcumulado = tipo === "meta" ? meta.indicador.tipoAcumuladoMeta : meta.indicador.tipoAcumuladoReal;
  if (tipoAcumulado === "manual") {
    return (tipo === "meta" ? meta.acumMetaManual : meta.acumRealManual) ?? null;
  }

  const valores = valoresPreenchidos(meta, tipo === "meta" ? campoMeta : campoReal);
  if (valores.length === 0) return null;

  const soma = valores.reduce((acc, v) => acc.plus(v), new Decimal(0));
  return tipoAcumulado === "media" ? soma.div(valores.length) : soma;
}

/** Calcula o acumulado (meta e real) de uma linha restrito a um intervalo [mesInicio, mesFim] de meses. */
export function calcularAcumuladoPeriodo(
  meta: MetaComIndicador,
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

  // tipo_acumulado_{meta,real}="manual": não há regra de rateio definida para acumular só uma
  // parte do ano — o valor manual vale para o ano cheio (ver calcularAcumuladoLinha), então um
  // período parcial fica sem acumulado calculável nesse lado.
  const acumMeta =
    meta.indicador.tipoAcumuladoMeta === "manual"
      ? null
      : valoresMeta.length > 0
      ? (() => {
          const soma = valoresMeta.reduce((acc, v) => acc.plus(v), new Decimal(0));
          return meta.indicador.tipoAcumuladoMeta === "media" ? soma.div(valoresMeta.length) : soma;
        })()
      : null;

  const acumReal =
    meta.indicador.tipoAcumuladoReal === "manual"
      ? null
      : valoresReal.length > 0
      ? (() => {
          const soma = valoresReal.reduce((acc, v) => acc.plus(v), new Decimal(0));
          return meta.indicador.tipoAcumuladoReal === "media" ? soma.div(valoresReal.length) : soma;
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

/** SUM(reais) / SUM(metas) — usado por proporcao_agregada. Sem *100: no app, campos de
 * unidade "%" guardam a fração decimal (ex: meta_ano=0.98 representa 98%), então o resultado
 * desta razão já precisa estar na mesma escala decimal para comparar corretamente com acum_meta. */
function proporcaoAgregada(valoresReal: Decimal[], valoresMeta: Decimal[]): Decimal | null {
  if (valoresReal.length === 0 || valoresMeta.length === 0) return null;
  const somaReal = valoresReal.reduce((acc, v) => acc.plus(v), new Decimal(0));
  const somaMeta = valoresMeta.reduce((acc, v) => acc.plus(v), new Decimal(0));
  if (somaMeta.isZero()) return null;
  return somaReal.div(somaMeta);
}

export interface ConfigAgregacaoIC {
  tipoAgregacaoMeta: TipoAgregacaoMeta;
  tipoAgregacaoReal: TipoAgregacaoReal;
  metaManualAcum: Decimal | null;
  /** OS-014: valor fixo de real acumulado, usado quando tipoAgregacaoReal="real_manual". */
  realManualAcum: Decimal | null;
}

/**
 * Recalcula os campos agregados de um IC com agrega_filhos=true a partir dos IVs filhos,
 * respeitando regras separadas para Meta e Real (OS-009, OS-014):
 * - tipo_agregacao_meta: soma | media (calculado dos filhos) | meta_manual (Meta NÃO é
 *   derivada dos filhos — o gerente digita mês a mês, como em qualquer indicador comum;
 *   metaPorMes/acumMeta retornam `null`/`undefined` como sinal para o chamador não
 *   sobrescrever os valores já existentes na linha do IC)
 * - tipo_agregacao_real: soma | media | proporcao_agregada (SUM(reais filhos) / SUM(metas
 *   filhos)) | real_manual (Real NÃO é derivado dos filhos — digitado direto, mesmo padrão do
 *   meta_manual; realPorMes/acumReal retornam `null`/`undefined` como sinal para o chamador
 *   não sobrescrever os meses/acumulado já existentes na linha do IC)
 */
export function recalcularAgregadoIC(
  filhos: Meta[],
  config: ConfigAgregacaoIC
): {
  /** `null` quando tipo_agregacao_meta="meta_manual": Meta não deve ser sobrescrita. */
  metaPorMes: Record<MesKey, Decimal | null> | null;
  /** `null` quando tipo_agregacao_real="real_manual": Real não deve ser sobrescrito (os meses
   * continuam sendo digitados manualmente, só o acumulado final é fixo). */
  realPorMes: Record<MesKey, Decimal | null> | null;
  /** `undefined` quando tipo_agregacao_meta="meta_manual": Meta não deve ser sobrescrita
   * (o Prisma ignora campos `undefined` num update, então o chamador pode repassar direto). */
  acumMeta: Decimal | null | undefined;
  /** Quando tipo_agregacao_real="real_manual", retorna config.realManualAcum diretamente
   * em vez de calcular a partir dos filhos. */
  acumReal: Decimal | null | undefined;
} {
  const metaManual = config.tipoAgregacaoMeta === "meta_manual";
  const realManual = config.tipoAgregacaoReal === "real_manual";
  const metaPorMes = metaManual ? null : ({} as Record<MesKey, Decimal | null>);
  const realPorMes = realManual ? null : ({} as Record<MesKey, Decimal | null>);

  for (const mes of MESES) {
    const valoresMeta = filhos.map((f) => f[campoMeta(mes)] as Decimal | null).filter((v): v is Decimal => v != null);
    const valoresReal = filhos.map((f) => f[campoReal(mes)] as Decimal | null).filter((v): v is Decimal => v != null);

    if (metaPorMes) {
      metaPorMes[mes] = somaOuMedia(valoresMeta, config.tipoAgregacaoMeta as "soma" | "media");
    }

    if (realPorMes) {
      realPorMes[mes] =
        config.tipoAgregacaoReal === "proporcao_agregada"
          ? proporcaoAgregada(valoresReal, valoresMeta)
          : somaOuMedia(valoresReal, config.tipoAgregacaoReal as "soma" | "media");
    }
  }

  const acumMetaValores = filhos.map((f) => f.acumMeta).filter((v): v is Decimal => v != null);
  const acumRealValores = filhos.map((f) => f.acumReal).filter((v): v is Decimal => v != null);

  const acumMeta = metaManual ? undefined : somaOuMedia(acumMetaValores, config.tipoAgregacaoMeta as "soma" | "media");

  const acumReal = realManual
    ? config.realManualAcum
    : config.tipoAgregacaoReal === "proporcao_agregada"
    ? proporcaoAgregada(acumRealValores, acumMetaValores)
    : somaOuMedia(acumRealValores, config.tipoAgregacaoReal as "soma" | "media");

  return { metaPorMes, realPorMes, acumMeta, acumReal };
}
