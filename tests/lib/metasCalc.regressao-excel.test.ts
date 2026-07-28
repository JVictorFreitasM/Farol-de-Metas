import * as fs from "fs";
import * as path from "path";
import { describe, expect, it } from "vitest";
import { calcularAcumuladoLinha, MesKey } from "../../src/lib/metasCalc";
import { criarMeta } from "./helpers";

// Lido via fs em vez de `import ... from "*.json"` pra não depender de resolveJsonModule no
// tsconfig do projeto (fora do escopo desta OS mexer em tsconfig.json).
const fixture = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "fixtures", "farol-2025.json"), "utf-8"));

/**
 * OS-017: teste de regressão (golden master) contra a planilha de referência do cliente
 * (tests/fixtures/Farol_IC_-_IV_2025.xlsx, extraída para tests/fixtures/farol-2025.json por
 * tests/scripts/extrair-fixture-excel.ts). Garante que calcularAcumuladoLinha reproduz os
 * acumulados que o cliente já validou manualmente na planilha, antes de qualquer refatoração
 * futura em metasCalc.ts/metas.routes.ts.
 *
 * A planilha não expõe tipo_acumulado_meta/real (só existe no banco do sistema) — o script de
 * extração infere "soma" ou "media" comparando o acumulado registrado contra soma/média dos 12
 * meses, dentro da mesma tolerância usada abaixo. Quando nenhuma das duas bate (indicador
 * provavelmente usa acumulado "manual"/override na fonte real), a linha fica marcada como
 * inconclusiva para aquele lado e é excluída da comparação — ver contagem no teste de
 * cobertura mínima, que garante que esse "escape hatch" não vira uma forma de a suíte passar
 * sem realmente comparar nada.
 */

// Mesma tolerância usada na inferência do script de extração (ver tests/scripts/extrair-fixture-excel.ts):
// float nativo do Excel vs. Decimal do sistema pode divergir na última casa decimal.
function tolerancia(unidade: string): number {
  return unidade === "%" ? 0.0001 : 0.01;
}

interface LinhaFixture {
  linhaPlanilha: number;
  indicador: string;
  unidade: string;
  meses: {
    meta: Record<MesKey, number | null>;
    real: Record<MesKey, number | null>;
  };
  acumMetaPlanilha: number | null;
  acumRealPlanilha: number | null;
  tipoAcumuladoMetaInferido: "soma" | "media" | null;
  tipoAcumuladoRealInferido: "soma" | "media" | null;
}

const linhas = fixture.linhas as LinhaFixture[];

const casosMeta = linhas
  .filter((l) => l.tipoAcumuladoMetaInferido != null)
  .map((l) => ({ ...l, tipo: l.tipoAcumuladoMetaInferido as "soma" | "media" }));

const casosReal = linhas
  .filter((l) => l.tipoAcumuladoRealInferido != null)
  .map((l) => ({ ...l, tipo: l.tipoAcumuladoRealInferido as "soma" | "media" }));

describe("regressão contra a planilha de referência do cliente (Farol_IC_-_IV_2025.xlsx)", () => {
  it.each(casosMeta)(
    "linha $linhaPlanilha ($indicador, $unidade): acum Meta bate com a planilha (tipo=$tipo)",
    ({ unidade, meses, acumMetaPlanilha, tipo }) => {
      const meta = criarMeta({
        indicador: { tipoAcumuladoMeta: tipo, unidade },
        meta: meses.meta,
      });

      const resultado = calcularAcumuladoLinha(meta, "meta");
      expect(resultado).not.toBeNull();
      // toBeCloseTo usa "casas decimais", que não corresponde 1:1 à tolerância absoluta
      // documentada (0.0001 p/ %, 0.01 p/ demais) — comparação explícita evita essa
      // divergência de semântica.
      expect(Math.abs(resultado!.toNumber() - acumMetaPlanilha!)).toBeLessThanOrEqual(tolerancia(unidade));
    }
  );

  it.each(casosReal)(
    "linha $linhaPlanilha ($indicador, $unidade): acum Real bate com a planilha (tipo=$tipo)",
    ({ unidade, meses, acumRealPlanilha, tipo }) => {
      const meta = criarMeta({
        indicador: { tipoAcumuladoReal: tipo, unidade },
        real: meses.real,
      });

      const resultado = calcularAcumuladoLinha(meta, "real");
      expect(resultado).not.toBeNull();
      expect(Math.abs(resultado!.toNumber() - acumRealPlanilha!)).toBeLessThanOrEqual(tolerancia(unidade));
    }
  );

  it("cobre os 3 exemplos verificados manualmente na OS (Tons, R$ e % — soma/soma/média)", () => {
    const linhaTons = linhas.find((l) => l.indicador === "Volume de MP( Cobre+PVC)");
    const linhaReais = linhas.find((l) => l.indicador === "OBZ Geral");
    const linhaPercentual = linhas.find((l) => l.indicador === "Ruptura logística");

    expect(linhaTons?.unidade).toBe("Tons");
    expect(linhaTons?.tipoAcumuladoMetaInferido).toBe("soma");
    expect(linhaReais?.unidade).toBe("R$");
    expect(linhaReais?.tipoAcumuladoMetaInferido).toBe("soma");
    expect(linhaPercentual?.unidade).toBe("%");
    expect(linhaPercentual?.tipoAcumuladoMetaInferido).toBe("media");
  });

  it("cobertura mínima: a maior parte das linhas da planilha entra na comparação de regressão", () => {
    // Garante que a fixture não "esvaziou" silenciosamente (ex.: mudança de tolerância ou de
    // layout da planilha fazendo tudo virar inconclusivo) — com os dados atuais, ~80% das
    // linhas batem soma/média em pelo menos um dos dois lados.
    expect(linhas.length).toBeGreaterThanOrEqual(70);
    expect(casosMeta.length).toBeGreaterThanOrEqual(50);
    expect(casosReal.length).toBeGreaterThanOrEqual(40);
  });
});
