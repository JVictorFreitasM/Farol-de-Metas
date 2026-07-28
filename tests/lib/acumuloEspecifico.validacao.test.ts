import { describe, expect, it } from "vitest";
import { resolverAcumuloEspecifico, IndicadorParaValidacaoAcumulo } from "../../src/lib/acumuloEspecifico";
import { ApiError } from "../../src/lib/errors";

/** OS-018: testa a validação de "Acúmulo específico" isolada do Express/Prisma — é a mesma
 * função chamada por POST /metas e PUT /metas/:id/meta (src/routes/metas.routes.ts), então
 * cobre o comportamento da API sem precisar de servidor/banco real (ver OS-017: nenhum teste
 * desta suíte depende de banco de dados). */

const indicadorPadrao: IndicadorParaValidacaoAcumulo = {
  tipoAcumuladoMeta: "soma",
  tipoAcumuladoReal: "soma",
  agregaIvs: false,
};

describe("resolverAcumuloEspecifico", () => {
  it("acumulo_especifico ausente no payload: não mexe na configuração (retorna {})", () => {
    expect(resolverAcumuloEspecifico({}, indicadorPadrao)).toEqual({});
  });

  it("acumulo_especifico=false: limpa os 4 campos de intervalo", () => {
    const resultado = resolverAcumuloEspecifico({ acumulo_especifico: false }, indicadorPadrao);
    expect(resultado).toEqual({
      acumuloEspecifico: false,
      acumMetaMesInicio: null,
      acumMetaMesFim: null,
      acumRealMesInicio: null,
      acumRealMesFim: null,
    });
  });

  it("acumulo_especifico=true com os 4 campos válidos: resolve os meses (minúsculo -> MesKey)", () => {
    const resultado = resolverAcumuloEspecifico(
      {
        acumulo_especifico: true,
        acum_meta_mes_inicio: "jan",
        acum_meta_mes_fim: "mar",
        acum_real_mes_inicio: "abr",
        acum_real_mes_fim: "jun",
      },
      indicadorPadrao
    );
    expect(resultado).toEqual({
      acumuloEspecifico: true,
      acumMetaMesInicio: "Jan",
      acumMetaMesFim: "Mar",
      acumRealMesInicio: "Abr",
      acumRealMesFim: "Jun",
    });
  });

  // --- As 3 combinações inválidas exigidas pelos critérios de aceite da OS-018 ---

  it("rejeita acumulo_especifico=true sem os 4 campos de intervalo", () => {
    expect(() => resolverAcumuloEspecifico({ acumulo_especifico: true }, indicadorPadrao)).toThrow(ApiError);
    expect(() =>
      resolverAcumuloEspecifico(
        { acumulo_especifico: true, acum_meta_mes_inicio: "jan", acum_meta_mes_fim: "mar" }, // faltam os do lado Real
        indicadorPadrao
      )
    ).toThrow(/requer os 4 campos/);
  });

  it("rejeita mes_fim antes de mes_inicio, em qualquer um dos dois pares", () => {
    expect(() =>
      resolverAcumuloEspecifico(
        {
          acumulo_especifico: true,
          acum_meta_mes_inicio: "mar",
          acum_meta_mes_fim: "jan", // invertido
          acum_real_mes_inicio: "jan",
          acum_real_mes_fim: "mar",
        },
        indicadorPadrao
      )
    ).toThrow(/acum_meta_mes_fim não pode vir antes/);

    expect(() =>
      resolverAcumuloEspecifico(
        {
          acumulo_especifico: true,
          acum_meta_mes_inicio: "jan",
          acum_meta_mes_fim: "mar",
          acum_real_mes_inicio: "jun",
          acum_real_mes_fim: "abr", // invertido
        },
        indicadorPadrao
      )
    ).toThrow(/acum_real_mes_fim não pode vir antes/);
  });

  it("rejeita acumulo_especifico=true combinado com tipo_acumulado=manual no mesmo lado", () => {
    const payload = {
      acumulo_especifico: true,
      acum_meta_mes_inicio: "jan",
      acum_meta_mes_fim: "mar",
      acum_real_mes_inicio: "jan",
      acum_real_mes_fim: "mar",
    } as const;

    expect(() =>
      resolverAcumuloEspecifico(payload, { ...indicadorPadrao, tipoAcumuladoMeta: "manual" })
    ).toThrow(/tipo_acumulado_meta='manual'/);

    expect(() =>
      resolverAcumuloEspecifico(payload, { ...indicadorPadrao, tipoAcumuladoReal: "manual" })
    ).toThrow(/tipo_acumulado_real='manual'/);
  });

  // --- Guarda adicional (além das 3 combinações listadas na OS): IC que agrega os IVs ---

  it("rejeita acumulo_especifico=true num indicador que agrega os IVs (agrega_ivs=true)", () => {
    expect(() =>
      resolverAcumuloEspecifico(
        {
          acumulo_especifico: true,
          acum_meta_mes_inicio: "jan",
          acum_meta_mes_fim: "mar",
          acum_real_mes_inicio: "jan",
          acum_real_mes_fim: "mar",
        },
        { ...indicadorPadrao, agregaIvs: true }
      )
    ).toThrow(/agrega os valores dos IVs/);
  });
});
