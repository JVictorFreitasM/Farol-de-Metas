import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardResumo } from "../types";

export function MetasNaoPreenchidas({ metas }: { metas: DashboardResumo["metas_incompletas"] }) {
  const [expandido, setExpandido] = useState(false);
  const navigate = useNavigate();
  const mostrar = expandido ? metas : metas.slice(0, 3);

  if (metas.length === 0) {
    return (
      <div className="card">
        <div className="card-title">✓ Metas não preenchidas</div>
        <p className="text-muted">Todos os indicadores estão com os meses em dia.</p>
      </div>
    );
  }

  return (
    <div className="card card-alerta">
      <div className="card-header">
        <div className="card-title">⚠ Metas não preenchidas</div>
        <span className="badge-alerta">{metas.length} pendência{metas.length > 1 ? "s" : ""}</span>
      </div>

      <ul className="metas-incompletas-lista">
        {mostrar.map((m) => (
          <li key={m.id} className="meta-incompleta-item">
            <div className="meta-incompleta-info">
              <div className="meta-incompleta-indicador">{m.indicador}</div>
              <div className="meta-incompleta-responsavel">{m.responsavel}</div>
              <div className="meta-incompleta-meses">
                Faltam: <strong>{m.meses_faltando.join(", ")}</strong>
              </div>
            </div>
            <button className="btn-secondary" onClick={() => navigate("/metas")}>Preencher</button>
          </li>
        ))}
      </ul>

      {!expandido && metas.length > 3 && (
        <button className="btn-link" onClick={() => setExpandido(true)}>
          Ver todas ({metas.length})
        </button>
      )}
    </div>
  );
}
