import { useState } from "react";
import ReactECharts from "echarts-for-react";
import { Meta, MESES, MESES_LABEL, Mes } from "../types";
import { MonthCardsOverview } from "./MonthCardsOverview";

const COR_OK = "#10b981";
const COR_NOK = "#ef4444";
const COR_NEUTRO = "#94a3b8";
const COR_PRIMARIA = "#3b82f6";

export function MetasDashboard({ metas, ano }: { metas: Meta[]; ano: number }) {
  const ics = metas.filter((m) => m.ic_iv === "IC");

  const [mesSelecionado, setMesSelecionado] = useState<Mes>(() => {
    for (let i = MESES.length - 1; i >= 0; i--) {
      if (ics.some((m) => m.meses[MESES[i]].real !== null)) {
        return MESES[i];
      }
    }
    return MESES[MESES.length - 1];
  });

  const qtdOk = ics.filter((m) => m.meses[mesSelecionado].status === "ok").length;
  const qtdNok = ics.filter((m) => m.meses[mesSelecionado].status === "nok").length;
  const qtdSemDados = ics.filter((m) => m.meses[mesSelecionado].status === null).length;

  const porSetor = new Map<string, { ok: number; nok: number }>();
  for (const ic of ics) {
    const nome = ic.nome_setor ?? "-";
    const atual = porSetor.get(nome) ?? { ok: 0, nok: 0 };
    if (ic.status_acum === "ok") atual.ok++;
    else if (ic.status_acum === "nok") atual.nok++;
    porSetor.set(nome, atual);
  }
  const setoresLabels = [...porSetor.keys()];
  const dadosOk = setoresLabels.map((s) => porSetor.get(s)!.ok);
  const dadosNok = setoresLabels.map((s) => porSetor.get(s)!.nok);

  const mesIndex = MESES.indexOf(mesSelecionado);
  const inicioIndex = Math.max(0, mesIndex - 3);
  const mesesGrafico = MESES.slice(inicioIndex, mesIndex + 1);
  const labelsGrafico = mesesGrafico.map((mes) => MESES_LABEL[mes]);
  const dadosPorMes = mesesGrafico.map((mes) => ics.filter((ic) => ic.meses[mes].status === "ok").length);

  const opcaoRosca = {
    tooltip: { trigger: "item" },
    legend: { bottom: 0 },
    series: [
      {
        type: "pie",
        radius: ["50%", "70%"],
        data: [
          { value: qtdOk, name: "OK", itemStyle: { color: COR_OK } },
          { value: qtdNok, name: "NOK", itemStyle: { color: COR_NOK } },
          { value: qtdSemDados, name: "Sem dados", itemStyle: { color: COR_NEUTRO } },
        ],
        label: { show: true, formatter: "{b}: {c} ({d}%)" },
      },
    ],
  };

  const opcaoBarras = {
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    legend: { top: 0 },
    grid: { left: "18%", right: "5%", top: 40, bottom: 20 },
    xAxis: { type: "value" },
    yAxis: { type: "category", data: setoresLabels },
    series: [
      { name: "OK", type: "bar", stack: "total", itemStyle: { color: COR_OK, borderRadius: [0, 4, 4, 0] }, data: dadosOk },
      { name: "NOK", type: "bar", stack: "total", itemStyle: { color: COR_NOK }, data: dadosNok },
    ],
  };

  const opcaoLinha = {
    tooltip: { trigger: "axis" },
    grid: { left: "5%", right: "5%", top: 30, bottom: 30 },
    xAxis: { type: "category", data: labelsGrafico },
    yAxis: { type: "value" },
    series: [
      {
        type: "line",
        smooth: true,
        areaStyle: { color: "rgba(59,130,246,0.12)" },
        itemStyle: { color: COR_PRIMARIA },
        lineStyle: { color: COR_PRIMARIA, width: 2 },
        data: dadosPorMes,
      },
    ],
  };

  return (
    <div>
      <MonthCardsOverview metas={ics} mesSelecionado={mesSelecionado} onMesSelecionado={setMesSelecionado} />

      <div className="cards-row">
        <div className="card">
          <div className="card-title">Total de ICs</div>
          <div className="card-value">{ics.length}</div>
        </div>
        <div className="card">
          <div className="card-title">ICs em OK</div>
          <div className="card-value status-ok">{qtdOk}</div>
        </div>
        <div className="card">
          <div className="card-title">ICs em NOK</div>
          <div className="card-value status-nok">{qtdNok}</div>
        </div>
        <div className="card">
          <div className="card-title">Sem dados</div>
          <div className="card-value">{qtdSemDados}</div>
        </div>
      </div>

      <div className="charts-row">
        <div className="card">
          <div className="card-title">Status geral dos ICs — {MESES_LABEL[mesSelecionado]}</div>
          <ReactECharts option={opcaoRosca} style={{ height: 280 }} />
        </div>
        <div className="card">
          <div className="card-title">ICs por setor</div>
          <ReactECharts option={opcaoBarras} style={{ height: 280 }} />
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          Evolução mensal — ICs em OK ({labelsGrafico[0]} a {labelsGrafico[labelsGrafico.length - 1]}, {ano})
        </div>
        <ReactECharts option={opcaoLinha} style={{ height: 240 }} />
      </div>
    </div>
  );
}
