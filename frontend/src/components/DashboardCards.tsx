import { DashboardResumo, Mes, MESES_LABEL } from "../types";

export function DashboardCards({
  dados,
  mes,
  consolidacao,
}: {
  dados: DashboardResumo;
  mes: Mes;
  consolidacao: { percentual: number; completo: boolean };
}) {
  const { resumo } = dados;
  const statusGeral = resumo.percentual_atingimento >= 50 ? "🟢 OK" : "🔴 NOK";

  return (
    <div className="cards-row">
      <div className="card">
        <div className="card-title">📊 Setor</div>
        <div className="card-value">
          {dados.setor}{" "}
          <span
            className={`status-dot ${consolidacao.completo ? "status-dot-ok" : "status-dot-nok"}`}
            title={`${consolidacao.percentual.toFixed(0)}% preenchido em ${MESES_LABEL[mes]}`}
          />
        </div>
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
