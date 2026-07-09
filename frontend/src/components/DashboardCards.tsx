import { DashboardResumo } from "../types";

export function DashboardCards({ dados }: { dados: DashboardResumo }) {
  const { resumo } = dados;
  const statusGeral = resumo.percentual_atingimento >= 50 ? "🟢 OK" : "🔴 NOK";

  return (
    <div className="cards-row">
      <div className="card">
        <div className="card-title">📊 Setor</div>
        <div className="card-value">{dados.setor}</div>
      </div>
      <div className="card">
        <div className="card-title">🎯 Metas Atingidas</div>
        <div className="card-value">
          {resumo.status_ok}/{resumo.total_indicadores} ({resumo.percentual_atingimento.toFixed(0)}%)
        </div>
      </div>
      <div className="card">
        <div className="card-title">Status Geral</div>
        <div className="card-value">{statusGeral}</div>
      </div>
    </div>
  );
}
