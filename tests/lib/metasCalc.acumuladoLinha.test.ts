import { describe, expect, it } from "vitest";
import { calcularAcumuladoLinha } from "../../src/lib/metasCalc";
import { criarMeta } from "./helpers";

describe("calcularAcumuladoLinha", () => {
  it("soma os 12 meses quando tipo_acumulado = soma e todos estão preenchidos", () => {
    const meta = criarMeta({
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Jan: 10, Fev: 20, Mar: 30, Abr: 10, Mai: 10, Jun: 10, Jul: 10, Ago: 10, Set: 10, Out: 10, Nov: 10, Dez: 10 },
      real: { Jan: 1, Fev: 2, Mar: 3, Abr: 1, Mai: 1, Jun: 1, Jul: 1, Ago: 1, Set: 1, Out: 1, Nov: 1, Dez: 1 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(150);
    expect(calcularAcumuladoLinha(meta, "real")?.toNumber()).toBe(15);
  });

  it("soma ignorando meses faltando (null) quando tipo_acumulado = soma", () => {
    const meta = criarMeta({
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      // só Jan, Fev e Mar preenchidos — Abr..Dez ainda não foram lançados
      meta: { Jan: 100, Fev: 200, Mar: 300 },
      real: { Jan: 10, Fev: 20 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(600);
    expect(calcularAcumuladoLinha(meta, "real")?.toNumber()).toBe(30);
  });

  it("calcula a média dos 12 meses quando tipo_acumulado = media e todos estão preenchidos", () => {
    const meta = criarMeta({
      indicador: { tipoAcumuladoMeta: "media", tipoAcumuladoReal: "media", unidade: "%" },
      meta: { Jan: 0.01, Fev: 0.01, Mar: 0.01, Abr: 0.01, Mai: 0.01, Jun: 0.01, Jul: 0.01, Ago: 0.01, Set: 0.01, Out: 0.01, Nov: 0.01, Dez: 0.01 },
      real: { Jan: 0.02, Fev: 0.04, Mar: 0, Abr: 0, Mai: 0, Jun: 0, Jul: 0, Ago: 0, Set: 0, Out: 0, Nov: 0, Dez: 0 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(0.01);
    expect(calcularAcumuladoLinha(meta, "real")?.toNumber()).toBeCloseTo(0.005, 10);
  });

  it("média considera só os meses preenchidos (não conta os null no denominador)", () => {
    const meta = criarMeta({
      indicador: { tipoAcumuladoMeta: "media", tipoAcumuladoReal: "media" },
      // só 2 meses preenchidos — média deve dividir por 2, não por 12
      meta: { Jan: 10, Fev: 20 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(15);
  });

  it("tipo manual retorna acumMetaManual/acumRealManual e ignora os 12 meses", () => {
    const meta = criarMeta({
      indicador: { tipoAcumuladoMeta: "manual", tipoAcumuladoReal: "manual" },
      acumMetaManual: 999,
      acumRealManual: 777,
      // meses preenchidos só para histórico/rastreio — não devem influenciar o resultado
      meta: { Jan: 10, Fev: 20, Mar: 30 },
      real: { Jan: 1, Fev: 2, Mar: 3 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(999);
    expect(calcularAcumuladoLinha(meta, "real")?.toNumber()).toBe(777);
  });

  it("tipo manual sem valor manual definido retorna null, mesmo com meses preenchidos", () => {
    const meta = criarMeta({
      indicador: { tipoAcumuladoMeta: "manual" },
      meta: { Jan: 10 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")).toBeNull();
  });

  it("retorna null quando os 12 meses estão vazios (soma/media)", () => {
    const metaSoma = criarMeta({ indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" } });
    const metaMedia = criarMeta({ indicador: { tipoAcumuladoMeta: "media", tipoAcumuladoReal: "media" } });

    expect(calcularAcumuladoLinha(metaSoma, "meta")).toBeNull();
    expect(calcularAcumuladoLinha(metaSoma, "real")).toBeNull();
    expect(calcularAcumuladoLinha(metaMedia, "meta")).toBeNull();
  });
});
