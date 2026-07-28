import { describe, expect, it } from "vitest";
import { recalcularAgregadoIC } from "../../src/lib/metasCalc";
import { criarIv, dec } from "./helpers";

describe("recalcularAgregadoIC", () => {
  it("tipo_agregacao_meta/real = soma: soma o mês a mês e o acumulado dos IVs", () => {
    const ivs = [
      criarIv({ meta: { Jan: 10, Fev: 10 }, real: { Jan: 5, Fev: 5 }, acumMeta: 120, acumReal: 60, metaAno: 120 }),
      criarIv({ meta: { Jan: 20, Fev: 20 }, real: { Jan: 8, Fev: 8 }, acumMeta: 240, acumReal: 96, metaAno: 240 }),
    ];

    const resultado = recalcularAgregadoIC(ivs, {
      tipoAgregacaoMeta: "soma",
      tipoAgregacaoReal: "soma",
      metaManualAcum: null,
      realManualAcum: null,
    });

    expect(resultado.metaPorMes?.Jan?.toNumber()).toBe(30);
    expect(resultado.metaPorMes?.Fev?.toNumber()).toBe(30);
    expect(resultado.realPorMes?.Jan?.toNumber()).toBe(13);
    expect(resultado.acumMeta?.toNumber()).toBe(360);
    expect(resultado.acumReal?.toNumber()).toBe(156);
    expect(resultado.metaAno?.toNumber()).toBe(360);
  });

  it("tipo_agregacao_meta/real = media: calcula a média mês a mês e do acumulado dos IVs", () => {
    const ivs = [
      criarIv({ meta: { Jan: 10 }, real: { Jan: 4 }, acumMeta: 100, acumReal: 40 }),
      criarIv({ meta: { Jan: 20 }, real: { Jan: 8 }, acumMeta: 200, acumReal: 80 }),
    ];

    const resultado = recalcularAgregadoIC(ivs, {
      tipoAgregacaoMeta: "media",
      tipoAgregacaoReal: "media",
      metaManualAcum: null,
      realManualAcum: null,
    });

    expect(resultado.metaPorMes?.Jan?.toNumber()).toBe(15);
    expect(resultado.realPorMes?.Jan?.toNumber()).toBe(6);
    expect(resultado.acumMeta?.toNumber()).toBe(150);
    expect(resultado.acumReal?.toNumber()).toBe(60);
  });

  it("tipo_agregacao_real = proporcao_agregada: SUM(reais)/SUM(metas) dos IVs, sem *100", () => {
    const ivs = [
      criarIv({ meta: { Jan: 100 }, real: { Jan: 90 }, acumMeta: 1000, acumReal: 800 }),
      criarIv({ meta: { Jan: 50 }, real: { Jan: 40 }, acumMeta: 500, acumReal: 300 }),
    ];

    const resultado = recalcularAgregadoIC(ivs, {
      tipoAgregacaoMeta: "soma",
      tipoAgregacaoReal: "proporcao_agregada",
      metaManualAcum: null,
      realManualAcum: null,
    });

    // mês: (90+40)/(100+50) = 130/150; acumulado: (800+300)/(1000+500) = 1100/1500
    expect(resultado.realPorMes?.Jan?.toNumber()).toBeCloseTo(130 / 150, 10);
    expect(resultado.acumReal?.toNumber()).toBeCloseTo(1100 / 1500, 10);
  });

  it("proporcao_agregada retorna null para o mês quando a soma das metas dos IVs é zero", () => {
    const ivs = [criarIv({ meta: { Jan: 0 }, real: { Jan: 0 } })];

    const resultado = recalcularAgregadoIC(ivs, {
      tipoAgregacaoMeta: "soma",
      tipoAgregacaoReal: "proporcao_agregada",
      metaManualAcum: null,
      realManualAcum: null,
    });

    expect(resultado.realPorMes?.Jan).toBeNull();
  });

  it("tipo_agregacao_meta = meta_manual: não deriva dos IVs — meta/acumMeta/metaAno saem undefined (sinal pro caller não sobrescrever)", () => {
    const ivs = [criarIv({ meta: { Jan: 10 }, acumMeta: 100, metaAno: 100 })];

    const resultado = recalcularAgregadoIC(ivs, {
      tipoAgregacaoMeta: "meta_manual",
      tipoAgregacaoReal: "soma",
      metaManualAcum: dec(999),
      realManualAcum: null,
    });

    expect(resultado.metaPorMes).toBeNull();
    expect(resultado.acumMeta).toBeUndefined();
    expect(resultado.metaAno).toBeUndefined();
    // o lado Real, que não é manual, continua sendo calculado normalmente
    expect(resultado.realPorMes).not.toBeNull();
  });

  it("tipo_agregacao_real = real_manual: não deriva dos IVs — real/realPorMes saem null/undefined e acumReal é o valor fixo de config", () => {
    const ivs = [criarIv({ real: { Jan: 40 }, acumReal: 400 })];

    const resultado = recalcularAgregadoIC(ivs, {
      tipoAgregacaoMeta: "soma",
      tipoAgregacaoReal: "real_manual",
      metaManualAcum: null,
      realManualAcum: dec(777),
    });

    expect(resultado.realPorMes).toBeNull();
    expect(resultado.acumReal?.toNumber()).toBe(777);
    // o lado Meta, que não é manual, continua sendo calculado normalmente
    expect(resultado.metaPorMes).not.toBeNull();
  });
});
