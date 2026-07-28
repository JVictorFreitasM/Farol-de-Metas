import { describe, expect, it } from "vitest";
import { calcularAcumuladoLinha } from "../../src/lib/metasCalc";
import { criarMeta } from "./helpers";

describe("calcularAcumuladoLinha com acumulo_especifico (OS-018)", () => {
  it("Meta e Real com o mesmo intervalo (Jan..Mar)", () => {
    const meta = criarMeta({
      acumuloEspecifico: true,
      acumMetaMesInicio: "Jan",
      acumMetaMesFim: "Mar",
      acumRealMesInicio: "Jan",
      acumRealMesFim: "Mar",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Jan: 10, Fev: 10, Mar: 10, Abr: 1000, Dez: 1000 }, // fora do intervalo, não deve entrar
      real: { Jan: 5, Fev: 5, Mar: 5, Abr: 1000, Dez: 1000 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(30);
    expect(calcularAcumuladoLinha(meta, "real")?.toNumber()).toBe(15);
  });

  it("Meta e Real com intervalos diferentes e não sobrepostos", () => {
    const meta = criarMeta({
      acumuloEspecifico: true,
      acumMetaMesInicio: "Jan",
      acumMetaMesFim: "Mar",
      acumRealMesInicio: "Out",
      acumRealMesFim: "Dez",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "media" },
      meta: { Jan: 1, Fev: 2, Mar: 3, Out: 999, Nov: 999, Dez: 999 },
      real: { Jan: 999, Fev: 999, Out: 10, Nov: 20, Dez: 30 },
    });

    // Meta soma Jan..Mar = 1+2+3 = 6 (ignora Out/Nov/Dez, que são do intervalo do Real)
    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(6);
    // Real média Out..Dez = (10+20+30)/3 = 20 (ignora Jan/Fev, que são do intervalo da Meta)
    expect(calcularAcumuladoLinha(meta, "real")?.toNumber()).toBe(20);
  });

  it("intervalo de um único mês (mesInicio == mesFim)", () => {
    const meta = criarMeta({
      acumuloEspecifico: true,
      acumMetaMesInicio: "Jun",
      acumMetaMesFim: "Jun",
      acumRealMesInicio: "Jun",
      acumRealMesFim: "Jun",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "media" },
      meta: { Mai: 999, Jun: 42, Jul: 999 },
      real: { Mai: 999, Jun: 7, Jul: 999 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(42);
    expect(calcularAcumuladoLinha(meta, "real")?.toNumber()).toBe(7);
  });

  it("mês dentro do intervalo não preenchido (null) não quebra e é ignorado do cálculo", () => {
    const meta = criarMeta({
      acumuloEspecifico: true,
      acumMetaMesInicio: "Jan",
      acumMetaMesFim: "Mar",
      acumRealMesInicio: "Jan",
      acumRealMesFim: "Mar",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "media" },
      meta: { Jan: 10, Mar: 10 }, // Fev não preenchido
      real: { Jan: 6, Mar: 12 }, // Fev não preenchido
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(20);
    // média dos 2 meses preenchidos (não divide por 3)
    expect(calcularAcumuladoLinha(meta, "real")?.toNumber()).toBe(9);
  });

  it("retorna null quando nenhum mês do intervalo está preenchido", () => {
    const meta = criarMeta({
      acumuloEspecifico: true,
      acumMetaMesInicio: "Jan",
      acumMetaMesFim: "Mar",
      acumRealMesInicio: "Jan",
      acumRealMesFim: "Mar",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Abr: 999 }, // fora do intervalo — dentro do intervalo (Jan..Mar) fica tudo vazio
    });

    expect(calcularAcumuladoLinha(meta, "meta")).toBeNull();
  });

  it("interação com tipo_acumulado=soma dentro do intervalo configurado", () => {
    const meta = criarMeta({
      acumuloEspecifico: true,
      acumMetaMesInicio: "Abr",
      acumMetaMesFim: "Jun",
      acumRealMesInicio: "Abr",
      acumRealMesFim: "Jun",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Abr: 5, Mai: 5, Jun: 5 },
      real: { Abr: 1, Mai: 1, Jun: 1 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(15);
    expect(calcularAcumuladoLinha(meta, "real")?.toNumber()).toBe(3);
  });

  it("interação com tipo_acumulado=media dentro do intervalo configurado", () => {
    const meta = criarMeta({
      acumuloEspecifico: true,
      acumMetaMesInicio: "Abr",
      acumMetaMesFim: "Jun",
      acumRealMesInicio: "Abr",
      acumRealMesFim: "Jun",
      indicador: { tipoAcumuladoMeta: "media", tipoAcumuladoReal: "media", unidade: "%" },
      meta: { Abr: 0.1, Mai: 0.2, Jun: 0.3 },
      real: { Abr: 0.4, Mai: 0.4, Jun: 0.4 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBeCloseTo(0.2, 10);
    expect(calcularAcumuladoLinha(meta, "real")?.toNumber()).toBeCloseTo(0.4, 10);
  });

  it("acumulo_especifico=false ignora os campos de intervalo (mesmo se preenchidos) e usa a regra padrão dos 12 meses", () => {
    const meta = criarMeta({
      acumuloEspecifico: false,
      // Campos de intervalo presentes mas devem ser ignorados com acumuloEspecifico=false —
      // simula uma linha que já teve acúmulo específico configurado e foi desligado.
      acumMetaMesInicio: "Jan",
      acumMetaMesFim: "Mar",
      indicador: { tipoAcumuladoMeta: "soma", tipoAcumuladoReal: "soma" },
      meta: { Jan: 10, Fev: 10, Mar: 10, Abr: 10 },
    });

    expect(calcularAcumuladoLinha(meta, "meta")?.toNumber()).toBe(40);
  });
});
