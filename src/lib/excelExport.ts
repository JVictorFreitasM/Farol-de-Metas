import ExcelJS from "exceljs";
import { Decimal } from "@prisma/client/runtime/library";
import { Setor } from "@prisma/client";
import { campoMeta, campoReal, MESES, MesKey } from "./metasCalc";
import { MetaComRelacoes } from "./serializers";

/** Mapeamento unidade -> número de formatação do Excel, calibrado contra a planilha de
 * referência do cliente (tests/fixtures/Farol_IC_-_IV_2025.xlsx): percentual com 2 casas,
 * moeda em R$, Tons/nº/H/Q como inteiro, demais unidades sem formatação especial. */
function formatoNumerico(unidade: string): string {
  switch (unidade) {
    case "%":
      return "0.00%";
    case "R$":
    case "CDI":
      return '_-"R$"* #,##0.00_-;-"R$"* #,##0.00_-;_-"R$"* "-"??_-;_-@_-';
    case "Tons":
    case "TON":
      return "#,##0";
    case "nº":
    case "H":
    case "Q":
      return "0";
    case "DD":
      return '_-* #,##0_-;-* #,##0_-;_-* "-"??_-;_-@_-';
    default:
      return "General";
  }
}

function paraNumero(valor: Decimal | null): number | null {
  return valor == null ? null : valor.toNumber();
}

const MESES_LABEL: Record<MesKey, string> = {
  Jan: "JAN", Fev: "FEV", Mar: "MAR", Abr: "ABR", Mai: "MAI", Jun: "JUN",
  Jul: "JUL", Ago: "AGO", Set: "SET", Out: "OUT", Nov: "NOV", Dez: "DEZ",
};

const COR_FILL_IV = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } } as const;
const COR_HEADER = "FF000080"; // azul-marinho pedido pro fundo das linhas 3-4
const COR_TITULO = "FF4472C4"; // "Azul, Ênfase 1" (Accent 1 padrão do tema Office)
const FONTE_HEADER = { bold: true, color: { argb: "FFFFFFFF" } };

const TOTAL_COLUNAS = 9 + MESES.length * 3; // Produto..MetaAno (6) + Acum (3) + 12 meses (3 cada) = 45

/** Cada coluna de conteúdo é seguida por uma coluna vazia (espaçadora), pra ficar mais fácil de
 * separar um valor do outro visualmente. Coluna lógica 1 (Produto) cai na física 1, a lógica 2
 * (IC/IV) cai na física 3 (deixando a física 2 vazia), e assim por diante. Exportada para o
 * teste de regressão (tests/export-regression.ts) conseguir ler as mesmas posições sem
 * duplicar/hardcodar o mapeamento aqui.
 */
export function pc(colunaLogica: number): number {
  return 2 * colunaLogica - 1;
}
export { TOTAL_COLUNAS };
const TOTAL_FISICO = pc(TOTAL_COLUNAS);

function larguraColunaLogica(colLogico: number): number {
  if (colLogico === 1) return 28; // Produto
  if (colLogico === 2) return 7; // IC/IV
  if (colLogico === 3) return 34; // Indicador
  if (colLogico === 4) return 18; // Responsável
  if (colLogico === 5) return 7; // UNI
  if (colLogico === 6) return 16; // Meta Ano — cabe "R$ 7.074.238,53" (16 caracteres)
  // Grupos de 3 (Meta/Real/Status) a partir da coluna lógica 7 (Acum, depois um por mês).
  // Só a de Status (a 3ª do grupo) é texto curto ("ok"/"nok"); Meta/Real precisam de espaço
  // pra valores em R$ formatados sem virar "#######".
  return (colLogico - 7) % 3 === 2 ? 8 : 16;
}

/** Constrói uma aba do relatório para um setor: título, cabeçalho de 2 linhas (grupo de mês +
 * Meta/Real/Status) e as linhas de dados, com produto mesclado verticalmente e hierarquia
 * IC -> IVs indicada por negrito/indentação (a ordem já vem correta do "ordem" da Meta, que
 * preserva a sequência original da planilha — IC seguido dos seus IVs, agrupado por produto).
 * Uma linha em branco separa o cabeçalho dos dados e cada grupo de produto do próximo, e uma
 * coluna em branco separa cada coluna de conteúdo da seguinte — só pra facilitar a leitura
 * visual, sem carregar dado nenhum. */
export function montarAbaSetor(workbook: ExcelJS.Workbook, setor: Setor, ano: number, metas: MetaComRelacoes[]) {
  const nomeAba = setor.nome.replace(/[:\\/?*[\]]/g, " ").slice(0, 31) || "Setor";
  const ws = workbook.addWorksheet(nomeAba, { views: [{ state: "frozen", ySplit: 4 }] });

  ws.mergeCells(1, 1, 1, TOTAL_FISICO);
  const tituloCell = ws.getCell(1, 1);
  tituloCell.value = `FAROL DOS ITENS DE CONTROLE E ITENS DE VERIFICAÇÃO - ${setor.nome} - ${ano}`.toUpperCase();
  tituloCell.font = { bold: true, size: 16, color: { argb: COR_TITULO } };
  tituloCell.alignment = { horizontal: "center", vertical: "middle" };
  ws.getRow(1).height = 26;

  // Fundo azul-marinho contínuo nas linhas 3-4 (inclusive nas colunas-espaçadoras, pra não
  // deixar frestas brancas cortando a faixa do cabeçalho).
  for (const numLinha of [3, 4]) {
    for (let col = 1; col <= TOTAL_FISICO; col++) {
      ws.getCell(numLinha, col).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COR_HEADER } } as ExcelJS.Fill;
    }
  }

  const cabecalhoSimples: [number, string][] = [
    [1, "PRODUTO"],
    [2, "IC/IV"],
    [3, "INDICADOR"],
    [4, "RESPONSÁVEL"],
    [5, "UNI"],
    [6, "META ANO"],
  ];
  for (const [colLogico, label] of cabecalhoSimples) {
    const col = pc(colLogico);
    ws.mergeCells(3, col, 4, col);
    const cell = ws.getCell(3, col);
    cell.value = label;
    cell.font = FONTE_HEADER;
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
  }

  function cabecalhoGrupo(colInicioLogico: number, label: string) {
    const colInicio = pc(colInicioLogico);
    const colFim = pc(colInicioLogico + 2);
    ws.mergeCells(3, colInicio, 3, colFim);
    const cell = ws.getCell(3, colInicio);
    cell.value = label.toUpperCase();
    cell.font = FONTE_HEADER;
    cell.alignment = { horizontal: "center", vertical: "middle" };
    ["META", "REAL", "STATUS"].forEach((sub, i) => {
      const subCell = ws.getCell(4, pc(colInicioLogico + i));
      subCell.value = sub;
      subCell.font = FONTE_HEADER;
      subCell.alignment = { horizontal: "center", vertical: "middle" };
    });
  }

  cabecalhoGrupo(7, "ACUM");
  MESES.forEach((mes, idx) => cabecalhoGrupo(10 + idx * 3, MESES_LABEL[mes]));

  for (let colLogico = 1; colLogico <= TOTAL_COLUNAS; colLogico++) {
    ws.getColumn(pc(colLogico)).width = larguraColunaLogica(colLogico);
  }
  for (let colFisica = 2; colFisica < TOTAL_FISICO; colFisica += 2) {
    ws.getColumn(colFisica).width = 2;
  }

  // Linha 5 fica em branco (gap entre cabeçalho e dados) — dados começam na linha 6.
  let linha = 6;
  let inicioBlocoProduto = linha;
  let produtoAtual: string | null | undefined = undefined;
  let primeiroBloco = true;

  const fecharMergeProduto = (fimLinha: number) => {
    if (fimLinha > inicioBlocoProduto) {
      ws.mergeCells(inicioBlocoProduto, 1, fimLinha, 1);
      ws.getCell(inicioBlocoProduto, 1).alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    }
  };

  for (const meta of metas) {
    const produto = meta.indicador.produto?.nome ?? null;
    const ehIC = meta.indicador.icIv === "IC";

    // Só um IC abre um novo grupo (produto + gap) — um IV normalmente tem produto=null no
    // próprio registro (o produto vive no IC pai), então não deve ser tratado como troca de
    // produto sozinho; ele sempre continua o grupo do IC que veio antes na mesma sequência.
    if (ehIC && (primeiroBloco || produto === null || produto !== produtoAtual)) {
      fecharMergeProduto(linha - 1);
      if (!primeiroBloco) linha++; // linha em branco entre um produto e o próximo
      inicioBlocoProduto = linha;
      produtoAtual = produto;
      primeiroBloco = false;
    }

    const unidade = meta.indicador.unidade;
    const fmt = formatoNumerico(unidade);

    ws.getCell(linha, pc(1)).value = produto ?? "";
    ws.getCell(linha, pc(2)).value = meta.indicador.icIv;
    const indicadorCell = ws.getCell(linha, pc(3));
    indicadorCell.value = meta.indicador.nome;
    indicadorCell.font = { bold: ehIC };
    if (!ehIC) indicadorCell.alignment = { indent: 1 };
    ws.getCell(linha, pc(4)).value = meta.responsavel;
    ws.getCell(linha, pc(5)).value = unidade;

    const metaAnoCell = ws.getCell(linha, pc(6));
    metaAnoCell.value = paraNumero(meta.metaAno) ?? undefined;
    metaAnoCell.numFmt = fmt;

    const acumMetaCell = ws.getCell(linha, pc(7));
    acumMetaCell.value = paraNumero(meta.acumMeta) ?? undefined;
    acumMetaCell.numFmt = fmt;
    const acumRealCell = ws.getCell(linha, pc(8));
    acumRealCell.value = paraNumero(meta.acumReal) ?? undefined;
    acumRealCell.numFmt = fmt;
    ws.getCell(linha, pc(9)).value = meta.statusAcum ?? "";

    MESES.forEach((mes, idx) => {
      const colLogico = 10 + idx * 3;
      const metaCell = ws.getCell(linha, pc(colLogico));
      metaCell.value = paraNumero(meta[campoMeta(mes)] as Decimal | null) ?? undefined;
      metaCell.numFmt = fmt;
      const realCell = ws.getCell(linha, pc(colLogico + 1));
      realCell.value = paraNumero(meta[campoReal(mes)] as Decimal | null) ?? undefined;
      realCell.numFmt = fmt;
      ws.getCell(linha, pc(colLogico + 2)).value = (meta[`status${mes}` as keyof MetaComRelacoes] as string | null) ?? "";
    });

    if (!ehIC) {
      ws.getCell(linha, pc(2)).fill = COR_FILL_IV as ExcelJS.Fill;
    } else {
      ws.getCell(linha, pc(2)).font = { bold: true };
    }

    linha++;
  }
  fecharMergeProduto(linha - 1);

  ws.eachRow({ includeEmpty: false }, (row) => {
    row.eachCell({ includeEmpty: false }, (cell) => {
      cell.border = {
        top: { style: "thin", color: { argb: "FFDDDDDD" } },
        bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
        left: { style: "thin", color: { argb: "FFDDDDDD" } },
        right: { style: "thin", color: { argb: "FFDDDDDD" } },
      };
    });
  });
}

/** Gera o workbook completo (uma aba por setor) e retorna o buffer .xlsx pronto para download. */
export async function gerarWorkbookExcel(
  setoresComMetas: { setor: Setor; metas: MetaComRelacoes[] }[],
  ano: number
): Promise<ExcelJS.Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Farol";
  workbook.created = new Date();

  for (const { setor, metas } of setoresComMetas) {
    montarAbaSetor(workbook, setor, ano, metas);
  }

  return workbook.xlsx.writeBuffer();
}
