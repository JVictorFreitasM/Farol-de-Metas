import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { DashboardResumo, Mes, MESES_LABEL } from "../types";

interface IndicadorResumo {
  id: string;
  indicador: string;
  responsavel: string;
}

interface IndicadorNaoBatido extends IndicadorResumo {
  percentual: number;
}

export function DashboardCards({
  dados,
  mes,
  metasPendentes,
  metasNaoBatidas,
  consolidacao,
  expandido,
  onToggleExpandir,
}: {
  dados: DashboardResumo;
  mes: Mes;
  metasPendentes: IndicadorResumo[];
  metasNaoBatidas: IndicadorNaoBatido[];
  consolidacao: { percentual: number; completo: boolean };
  expandido: boolean;
  onToggleExpandir: () => void;
}) {
  const { resumo } = dados;
  const statusGeral = resumo.percentual_atingimento >= 50 ? "🟢 OK" : "🔴 NOK";
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!expandido) return;
    const aoClicarFora = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onToggleExpandir();
      }
    };
    document.addEventListener("mousedown", aoClicarFora);
    return () => document.removeEventListener("mousedown", aoClicarFora);
  }, [expandido, onToggleExpandir]);

  return (
    <div className="cards-row">
      <div className="card card-setor-expandivel" ref={cardRef}>
        <div
          className="card-setor-clicavel"
          role="button"
          tabIndex={0}
          aria-expanded={expandido}
          onClick={onToggleExpandir}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              onToggleExpandir();
            }
          }}
        >
          <div className="card-title">
            <span className={`chevron ${expandido ? "expanded" : ""}`}>▼</span> 📊 Setor
          </div>
          <div className="card-value">
            {dados.setor}{" "}
            <span
              className={`status-dot ${consolidacao.completo ? "status-dot-ok" : "status-dot-nok"}`}
              title={`${consolidacao.percentual.toFixed(0)}% preenchido em ${MESES_LABEL[mes]}`}
            />
          </div>
        </div>

        <div className={`colapsavel card-setor-colapsavel ${expandido ? "" : "colapsado"}`}>
          <div>
            <div className="card-setor-detalhes">
              <div className="card-setor-secao">
                <strong>Metas Pendentes ({MESES_LABEL[mes]})</strong>
                {metasPendentes.length === 0 ? (
                  <p className="texto-informativo">Todas as metas foram preenchidas neste mês.</p>
                ) : (
                  <ul className="metas-pendentes-lista">
                    {metasPendentes.map((m) => (
                      <li key={m.id}>
                        <strong>{m.indicador}</strong> — {m.responsavel}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="card-setor-secao">
                <strong>Metas Não Batidas ({MESES_LABEL[mes]})</strong>
                {metasNaoBatidas.length === 0 ? (
                  <p className="texto-informativo">Nenhuma meta abaixo do esperado neste mês.</p>
                ) : (
                  <ul className="metas-pendentes-lista">
                    {metasNaoBatidas.map((m) => (
                      <li key={m.id}>
                        <strong>{m.indicador}</strong> — {m.responsavel}{" "}
                        <span className={m.percentual < 75 ? "texto-diferenca" : "texto-percentual"}>
                          ({m.percentual.toFixed(0)}%)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <Link className="btn-secondary" to="/metas" onClick={(e) => e.stopPropagation()}>
                Editar
              </Link>
            </div>
          </div>
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
