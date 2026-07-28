import { describe, expect, it } from "vitest";
import { calcularAcumuladoPeriodo, resolverIntervaloMeses } from "../../src/lib/metasCalc";
import { criarMeta } from "./helpers";

describe("calcularAcumuladoPeriodo", () => {
  it("calcula um período parcial (Jan..Mar) restrito aos meses do intervalo", () => {
    const meta = criarMeta({
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Jan: 10, Fev: 10, Mar: 10, Abr: 1000 }, // Abr fica fora do período, não deve entrar na soma
      real: { Jan: 5, Fev: 5, Mar: 5, Abr: 1000 },
    });

    const resultado = calcularAcumuladoPeriodo(meta, "Jan", "Mar");

    expect(resultado.mesesPeriodo).toEqual(["Jan", "Fev", "Mar"]);
    expect(resultado.acumMeta?.toNumber()).toBe(30);
    expect(resultado.acumReal?.toNumber()).toBe(15);
    expect(resultado.detalhes).toHaveLength(3);
  });

  it("resolverIntervaloMeses(trimestre) delimita Q1..Q4 corretamente e calcularAcumuladoPeriodo usa esse intervalo", () => {
    const q2 = resolverIntervaloMeses("trimestre", { trimestre: 2 });
    expect(q2).toEqual({ mesInicio: "Abr", mesFim: "Jun", label: "Q2" });

    const meta = criarMeta({
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Jan: 999, Abr: 1, Mai: 2, Jun: 3, Jul: 999 },
    });
    const resultado = calcularAcumuladoPeriodo(meta, q2.mesInicio, q2.mesFim);
    expect(resultado.acumMeta?.toNumber()).toBe(6);
  });

  it("resolverIntervaloMeses(semestre) delimita H1/H2 corretamente", () => {
    expect(resolverIntervaloMeses("semestre", { semestre: 1 })).toEqual({ mesInicio: "Jan", mesFim: "Jun", label: "H1" });
    expect(resolverIntervaloMeses("semestre", { semestre: 2 })).toEqual({ mesInicio: "Jul", mesFim: "Dez", label: "H2" });
  });

  it("tipo_acumulado manual retorna acumulado null para período parcial (sem regra de rateio)", () => {
    const meta = criarMeta({
      indicador: { tipoAcumuladoMeta: "manual", tipoAcumuladoReal: "manual" },
      acumMetaManual: 500,
      acumRealManual: 400,
      meta: { Jan: 10, Fev: 10 },
      real: { Jan: 5, Fev: 5 },
    });

    const resultado = calcularAcumuladoPeriodo(meta, "Jan", "Fev");

    expect(resultado.acumMeta).toBeNull();
    expect(resultado.acumReal).toBeNull();
    // meses individuais continuam expostos em "detalhes" mesmo sem acumulado calculável
    expect(resultado.detalhes.map((d) => d.meta?.toNumber())).toEqual([10, 10]);
  });

  it("calcula percentual e status ok/nok para tipoMeta=maior_melhor", () => {
    const bateuMeta = criarMeta({
      tipoMeta: "maior_melhor",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Jan: 100 },
      real: { Jan: 120 },
    });
    const resultadoOk = calcularAcumuladoPeriodo(bateuMeta, "Jan", "Jan");
    expect(resultadoOk.status).toBe("ok");
    expect(resultadoOk.percentual?.toNumber()).toBe(120);

    const naoBateuMeta = criarMeta({
      tipoMeta: "maior_melhor",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Jan: 100 },
      real: { Jan: 80 },
    });
    expect(calcularAcumuladoPeriodo(naoBateuMeta, "Jan", "Jan").status).toBe("nok");
  });

  it("calcula status ok/nok para tipoMeta=menor_melhor (real menor ou igual à meta é ok)", () => {
    const ok = criarMeta({
      tipoMeta: "menor_melhor",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Jan: 10 },
      real: { Jan: 8 },
    });
    expect(calcularAcumuladoPeriodo(ok, "Jan", "Jan").status).toBe("ok");

    const nok = criarMeta({
      tipoMeta: "menor_melhor",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Jan: 10 },
      real: { Jan: 12 },
    });
    expect(calcularAcumuladoPeriodo(nok, "Jan", "Jan").status).toBe("nok");
  });

  it("percentual/status ficam null quando meta ou real do período não estão preenchidos", () => {
    const meta = criarMeta({
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Jan: 10 },
      // real de Jan não preenchido
    });
    const resultado = calcularAcumuladoPeriodo(meta, "Jan", "Jan");
    expect(resultado.acumReal).toBeNull();
    expect(resultado.percentual).toBeNull();
    expect(resultado.status).toBeNull();
  });

  it("lança erro quando o mês inicial é depois do mês final", () => {
    const meta = criarMeta();
    expect(() => calcularAcumuladoPeriodo(meta, "Mar", "Jan")).toThrow();
  });
});
