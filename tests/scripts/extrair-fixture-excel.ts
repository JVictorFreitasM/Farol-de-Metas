import * as fs from "fs";
import * as path from "path";
import ExcelJS from "exceljs";
import { MESES, MesKey } from "../../src/lib/metasCalc";

/**
 * OS-017: extrai a planilha de referência do cliente (fonte de verdade já validada
 * manualmente) para um JSON estável, usado pelo teste de regressão golden master em
 * tests/lib/metasCalc.regressao-excel.test.ts. Roda uma vez (via `npm run fixture:extrair`)
 * e o resultado é commitado — os testes não abrem o .xlsx em tempo de execução.
 */

const ARQUIVO_ENTRADA = path.join(__dirname, "..", "fixtures", "Farol_IC_-_IV_2025.xlsx");
const ARQUIVO_SAIDA = path.join(__dirname, "..", "fixtures", "farol-2025.json");
const ABA = "Farol IC IV)";

const HEADER_ROW_GRUPO = 4; // "ACUM" / "JAN" / "FEV" / ...
const HEADER_ROW_SUB = 5; // "Meta" / "Real"
const PRIMEIRA_LINHA_DADOS = 7;

const COL_PRODUTO = 3;
const COL_IC_IV = 5;
const COL_INDICADOR = 7;
const COL_RESPONSAVEL = 9;
const COL_UNIDADE = 10;
const COL_META_ANO = 12;

const MESES_LABEL: Record<MesKey, string> = {
  Jan: "JAN", Fev: "FEV", Mar: "MAR", Abr: "ABR", Mai: "MAI", Jun: "JUN",
  Jul: "JUL", Ago: "AGO", Set: "SET", Out: "OUT", Nov: "NOV", Dez: "DEZ",
};

function colToNum(letras: string): number {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

/**
 * A planilha do cliente tem quase todas as células de fórmula com resultado em cache
 * (exceljs lê `cell.result`), mas ~4 células (confirmado por inspeção manual do arquivo
 * inteiro) não têm cache — a última vez que a planilha foi salva, o Excel não recalculou
 * essas fórmulas específicas antes de gravar. Para essas, `cell.result` do exceljs devolve
 * 0 (não `undefined`), o que mascararia o problema silenciosamente. Por isso resolvemos a
 * partir do texto bruto da fórmula (via `cell.formula`, que já normaliza fórmulas
 * compartilhadas) só nesses casos, suportando exatamente os formatos encontrados: célula
 * solta (ex. "N22"), SUM de células/intervalos, e AVERAGEIFS/SUMIFS com uma linha de
 * critério (usada na planilha para somar só as colunas "Real" de cada mês, ignorando
 * Meta/Status). Qualquer formato fora desses lança erro alto — preferível a silenciosamente
 * extrair um valor errado.
 */
function resolverValor(ws: ExcelJS.Worksheet, linha: number, coluna: number, visitados = new Set<string>()): number | string | null {
  const chave = `${linha},${coluna}`;
  if (visitados.has(chave)) throw new Error(`Referência circular ao resolver célula ${chave}`);
  visitados.add(chave);

  const cell = ws.getCell(linha, coluna);
  const v = cell.value;
  if (v == null) return null;
  if (typeof v === "number") return v;
  if (typeof v === "string") return v;
  if (typeof v === "object") {
    if ("richText" in v) return (v.richText as { text: string }[]).map((r) => r.text).join("");
    if ("result" in v && v.result !== undefined) return v.result as number | string;
    if ("formula" in v || "sharedFormula" in v) {
      const formula = cell.formula ?? "";

      const refSolto = formula.match(/^([A-Z]{1,3})(\d+)$/);
      if (refSolto) return resolverValor(ws, parseInt(refSolto[2], 10), colToNum(refSolto[1]), visitados);

      const soma = formula.match(/^SUM\(([A-Z0-9:,]+)\)$/);
      if (soma) {
        let total = 0;
        for (const ref of soma[1].split(",")) {
          const faixa = ref.match(/^([A-Z]{1,3})(\d+):([A-Z]{1,3})(\d+)$/);
          if (faixa) {
            const [, c1, r1, c2, r2] = faixa;
            for (let r = parseInt(r1, 10); r <= parseInt(r2, 10); r++) {
              for (let c = colToNum(c1); c <= colToNum(c2); c++) {
                total += (resolverValor(ws, r, c, visitados) as number | null) ?? 0;
              }
            }
            continue;
          }
          const unica = ref.match(/^([A-Z]{1,3})(\d+)$/);
          if (!unica) throw new Error(`Referência não suportada em SUM: "${ref}" (fórmula de ${chave})`);
          total += (resolverValor(ws, parseInt(unica[2], 10), colToNum(unica[1]), visitados) as number | null) ?? 0;
        }
        return total;
      }

      const condicional = formula.match(
        /^(?<fn>AVERAGEIFS|SUMIFS)\((?<c1>[A-Z]{1,3})(?<r1>\d+):(?<c2>[A-Z]{1,3})\d+,\$(?<critC1>[A-Z]{1,3})\$(?<critRow>\d+):\$[A-Z]{1,3}\$\d+,"?(?<critVal>-?\d+)"?\)$/
      );
      if (condicional?.groups) {
        const { fn, c1, r1, c2, critRow, critVal } = condicional.groups;
        const colInicio = colToNum(c1);
        const colFim = colToNum(c2);
        const linhaDados = parseInt(r1, 10);
        const linhaCriterio = parseInt(critRow, 10);
        const valorCriterio = parseInt(critVal, 10);
        const valores: number[] = [];
        for (let c = colInicio; c <= colFim; c++) {
          const criterio = resolverValor(ws, linhaCriterio, c, visitados);
          if (criterio === valorCriterio) {
            const dv = resolverValor(ws, linhaDados, c, visitados);
            if (dv != null) valores.push(dv as number);
          }
        }
        if (valores.length === 0) return null;
        const total = valores.reduce((acc, x) => acc + x, 0);
        return fn === "AVERAGEIFS" ? total / valores.length : total;
      }

      throw new Error(`Fórmula não suportada na extração: "${formula}" (célula ${chave})`);
    }
  }
  throw new Error(`Tipo de valor inesperado na célula ${chave}: ${JSON.stringify(v)}`);
}

/** Tolerância pra comparar o acumulado da planilha (float nativo do Excel) contra soma/média
 * calculada a partir dos 12 meses — mesma tolerância usada depois na comparação do teste de
 * regressão (ver tests/lib/metasCalc.regressao-excel.test.ts). */
function tolerancia(unidade: string): number {
  return unidade === "%" ? 0.0001 : 0.01;
}

interface LinhaFixture {
  linhaPlanilha: number;
  produto: string | null;
  icIv: "IC" | "IV";
  indicador: string;
  responsavel: string;
  unidade: string;
  metaAno: number | null;
  meses: {
    meta: Record<MesKey, number | null>;
    real: Record<MesKey, number | null>;
  };
  acumMetaPlanilha: number | null;
  acumRealPlanilha: number | null;
  statusAcumPlanilha: string | null;
  tipoAcumuladoMetaInferido: "soma" | "media" | null;
  tipoAcumuladoRealInferido: "soma" | "media" | null;
}

function inferir(unidade: string, acumPlanilha: number | null, valoresPreenchidos: number[]): "soma" | "media" | null {
  if (acumPlanilha == null || valoresPreenchidos.length === 0) return null;
  const soma = valoresPreenchidos.reduce((acc, v) => acc + v, 0);
  const media = soma / valoresPreenchidos.length;
  const tol = tolerancia(unidade);
  const bateSoma = Math.abs(acumPlanilha - soma) <= tol;
  const bateMedia = Math.abs(acumPlanilha - media) <= tol;
  if (bateSoma && !bateMedia) return "soma";
  if (bateMedia && !bateSoma) return "media";
  if (bateSoma && bateMedia) return unidade === "%" ? "media" : "soma"; // empate (ex.: só 1 mês preenchido) — desempate documentado pela checagem manual do OS-017
  return null;
}

async function main() {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(ARQUIVO_ENTRADA);
  const ws = workbook.getWorksheet(ABA);
  if (!ws) throw new Error(`Aba "${ABA}" não encontrada em ${ARQUIVO_ENTRADA}`);

  // Localiza dinamicamente as colunas de cada mês e do bloco ACUM pelos cabeçalhos (linhas 4/5)
  // em vez de assumir posições fixas — a planilha tem espaçadores irregulares entre blocos de
  // mês (ver inspeção manual: Jan→Fev sem gap, Fev→Mar com 2 colunas de gap, demais com 1).
  const colunaMetaPorMes = {} as Record<MesKey, number>;
  let colAcumMeta: number | null = null;
  let colAcumReal: number | null = null;
  for (let c = 1; c <= ws.columnCount; c++) {
    const grupo = ws.getCell(HEADER_ROW_GRUPO, c).value;
    const sub = ws.getCell(HEADER_ROW_SUB, c).value;
    if (grupo === "ACUM" && sub === "Meta") colAcumMeta = c;
    if (grupo === "ACUM" && sub === "Real") colAcumReal = c;
    if (typeof grupo === "string") {
      const mes = (Object.keys(MESES_LABEL) as MesKey[]).find((m) => MESES_LABEL[m] === grupo);
      if (mes && sub === "Meta") colunaMetaPorMes[mes] = c;
    }
  }
  if (colAcumMeta == null || colAcumReal == null) throw new Error("Não encontrei as colunas ACUM Meta/Real no cabeçalho");
  for (const mes of MESES) {
    if (!colunaMetaPorMes[mes]) throw new Error(`Não encontrei a coluna de "${MESES_LABEL[mes]} Meta" no cabeçalho`);
  }
  const colAcumStatus = colAcumReal + 1;

  const linhas: LinhaFixture[] = [];
  for (let r = PRIMEIRA_LINHA_DADOS; r <= ws.rowCount; r++) {
    const icIv = resolverValor(ws, r, COL_IC_IV);
    if (icIv !== "IC" && icIv !== "IV") continue; // linhas separadoras/em branco entre produtos

    const unidade = String(resolverValor(ws, r, COL_UNIDADE) ?? "");
    const metaPorMes = {} as Record<MesKey, number | null>;
    const realPorMes = {} as Record<MesKey, number | null>;
    for (const mes of MESES) {
      const colMeta = colunaMetaPorMes[mes];
      metaPorMes[mes] = resolverValor(ws, r, colMeta) as number | null;
      realPorMes[mes] = resolverValor(ws, r, colMeta + 1) as number | null;
    }

    const acumMetaPlanilha = resolverValor(ws, r, colAcumMeta) as number | null;
    const acumRealPlanilha = resolverValor(ws, r, colAcumReal) as number | null;
    const statusAcumPlanilha = resolverValor(ws, r, colAcumStatus) as string | null;

    const metaPreenchidos = MESES.map((m) => metaPorMes[m]).filter((v): v is number => v != null);
    const realPreenchidos = MESES.map((m) => realPorMes[m]).filter((v): v is number => v != null);

    linhas.push({
      linhaPlanilha: r,
      produto: (resolverValor(ws, r, COL_PRODUTO) as string | null) ?? null,
      icIv,
      indicador: String(resolverValor(ws, r, COL_INDICADOR) ?? ""),
      responsavel: String(resolverValor(ws, r, COL_RESPONSAVEL) ?? ""),
      unidade,
      metaAno: resolverValor(ws, r, COL_META_ANO) as number | null,
      meses: { meta: metaPorMes, real: realPorMes },
      acumMetaPlanilha,
      acumRealPlanilha,
      statusAcumPlanilha,
      tipoAcumuladoMetaInferido: inferir(unidade, acumMetaPlanilha, metaPreenchidos),
      tipoAcumuladoRealInferido: inferir(unidade, acumRealPlanilha, realPreenchidos),
    });
  }

  const inconclusivasMeta = linhas.filter((l) => l.tipoAcumuladoMetaInferido == null).length;
  const inconclusivasReal = linhas.filter((l) => l.tipoAcumuladoRealInferido == null).length;

  const fixture = {
    origem: path.basename(ARQUIVO_ENTRADA),
    aba: ABA,
    extraidoEm: new Date().toISOString(),
    totalLinhas: linhas.length,
    linhas,
  };

  fs.writeFileSync(ARQUIVO_SAIDA, JSON.stringify(fixture, null, 2) + "\n", "utf-8");
  console.log(`Fixture gerada em ${ARQUIVO_SAIDA} com ${linhas.length} linhas.`);
  console.log(
    `Lado Meta inconclusivo (não bateu soma nem média — provável acumulado manual na origem): ${inconclusivasMeta} linha(s).`
  );
  console.log(
    `Lado Real inconclusivo (não bateu soma nem média — provável acumulado manual na origem): ${inconclusivasReal} linha(s).`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
