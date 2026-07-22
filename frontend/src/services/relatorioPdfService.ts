import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { listarMetas } from "./metasService";
import { Meta, MESES, MESES_LABEL, Setor } from "../types";

function formatNumero(valor: string | number | null): string {
  if (valor === null || valor === undefined) return "-";
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return Number.isFinite(n) ? n.toString() : "-";
}

function statusTexto(status: string | null): string {
  if (status === "ok") return "OK";
  if (status === "nok") return "NOK";
  return "-";
}

function montarLinhas(metas: Meta[]): string[][] {
  const ivsPorPai = new Map<string, Meta[]>();
  const raiz: Meta[] = [];
  for (const meta of metas) {
    if (meta.pai_id) {
      const lista = ivsPorPai.get(meta.pai_id) ?? [];
      lista.push(meta);
      ivsPorPai.set(meta.pai_id, lista);
    } else {
      raiz.push(meta);
    }
  }

  const linhas: string[][] = [];

  function linhaDaMeta(meta: Meta, nivel: number, produtoVisivel: boolean): string[] {
    const prefixo = nivel > 0 ? "  ".repeat(nivel) + "- " : "";
    const meses = MESES.flatMap((mes) => [
      formatNumero(meta.meses[mes].meta),
      formatNumero(meta.meses[mes].real),
      statusTexto(meta.meses[mes].status),
    ]);
    return [
      produtoVisivel ? meta.produto ?? "" : "",
      meta.ic_iv,
      `${prefixo}${meta.indicador}`,
      meta.responsavel,
      meta.unidade,
      formatNumero(meta.meta_ano),
      ...meses,
      formatNumero(meta.acum_meta),
      formatNumero(meta.acum_real),
      statusTexto(meta.status_acum),
    ];
  }

  function processar(lista: Meta[], nivel: number) {
    let ultimoProduto: string | null = null;
    for (const meta of lista) {
      const mostrarProduto = !!meta.produto && meta.produto !== ultimoProduto && nivel === 0;
      if (meta.produto) ultimoProduto = meta.produto;
      linhas.push(linhaDaMeta(meta, nivel, mostrarProduto));
      const ivs = ivsPorPai.get(meta.id) ?? [];
      if (ivs.length) processar(ivs, nivel + 1);
    }
  }

  processar(raiz, 0);
  return linhas;
}

const CABECALHO = [
  "Produto",
  "IC/IV",
  "Indicador",
  "Resp.",
  "Unid.",
  "Meta Ano",
  ...MESES.flatMap((mes) => [`${MESES_LABEL[mes]} Meta`, `${MESES_LABEL[mes]} Real`, `${MESES_LABEL[mes]} St.`]),
  "Ac. Meta",
  "Ac. Real",
  "St. Acum",
];

const COL_BASE = 6;
const COL_ACUM_STATUS = COL_BASE + MESES.length * 3 + 2;

export async function gerarRelatorioPdf(ano: number, setores: Setor[]): Promise<void> {
  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a2" });

  doc.setFontSize(16);
  doc.text(`Farol — Relatório de Metas ${ano}`, 40, 40);
  doc.setFontSize(10);
  doc.text(`Gerado em ${new Date().toLocaleString("pt-BR")}`, 40, 58);

  let primeiraSecao = true;

  for (const setor of [...setores].sort((a, b) => a.nome.localeCompare(b.nome))) {
    const resp = await listarMetas({ ano, setor_id: setor.id });
    if (resp.data.length === 0) continue;

    if (!primeiraSecao) doc.addPage();
    primeiraSecao = false;

    doc.setFontSize(13);
    doc.text(`Setor: ${setor.nome}`, 40, 40);

    const linhas = montarLinhas(resp.data);

    autoTable(doc, {
      head: [CABECALHO],
      body: linhas,
      startY: 55,
      styles: { fontSize: 5, cellPadding: 1.5, overflow: "linebreak" },
      headStyles: { fontSize: 5, fillColor: [59, 130, 246] },
      margin: { left: 40, right: 40 },
      didParseCell: (data) => {
        if (data.section !== "body") return;
        const col = data.column.index;
        const isStatusMensal = col >= COL_BASE && col < COL_BASE + MESES.length * 3 && (col - COL_BASE) % 3 === 2;
        const isStatusAcum = col === COL_ACUM_STATUS;
        if (isStatusMensal || isStatusAcum) {
          const valor = data.cell.raw;
          if (valor === "OK") data.cell.styles.textColor = [16, 185, 129];
          else if (valor === "NOK") data.cell.styles.textColor = [239, 68, 68];
        }
      },
    });
  }

  if (primeiraSecao) {
    doc.setFontSize(12);
    doc.text("Nenhum dado encontrado para o ano selecionado.", 40, 80);
  }

  doc.save(`farol-relatorio-${ano}.pdf`);
}
