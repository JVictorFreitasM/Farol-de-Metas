import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AppLayout } from "../components/AppLayout";
import { DashboardCards } from "../components/DashboardCards";
import { StatusRoscaChart, TendenciaMensalChart } from "../components/DashboardCharts";
import { useAuth } from "../hooks/useAuth";
import { comparativaSetores, dashboardSetor } from "../services/relatoriosService";
import { ComparativaSetor, DashboardResumo } from "../types";

export function DashboardPage() {
  const { usuario } = useAuth();
  const [ano] = useState(new Date().getFullYear());
  const [dados, setDados] = useState<DashboardResumo | null>(null);
  const [ranking, setRanking] = useState<ComparativaSetor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ativo = true;
    setLoading(true);
    dashboardSetor(usuario?.role === "responsavel" ? usuario.setor_id ?? undefined : undefined, ano, "ano")
      .then((d) => ativo && setDados(d))
      .catch((err) => toast.error(err.message))
      .finally(() => ativo && setLoading(false));

    if (usuario?.role === "gerente" || usuario?.role === "admin") {
      comparativaSetores(ano, "ano")
        .then((r) => ativo && setRanking(r.setores))
        .catch(() => {});
    }
    return () => {
      ativo = false;
    };
  }, [ano, usuario]);

  return (
    <AppLayout titulo={`Dashboard > ${ano}`}>
      {loading && <p>Carregando...</p>}
      {dados && (
        <>
          <DashboardCards dados={dados} />

          <div className="cards-row">
            <div className="card card-total-setores">
              {(usuario?.role === "gerente" || usuario?.role === "admin") && (
                <>
                  <div className="card-title">🏢 Total de Setores</div>
                  <div className="card-value">{ranking.length}</div>
                </>
              )}
            </div>
          </div>

          <div className="charts-row">
            <div className="card">
              <div className="card-title">Tendência Mensal</div>
              <TendenciaMensalChart evolucao={dados.evolucao_mensal} />
            </div>
            <div className="card">
              <div className="card-title">Status por Indicador</div>
              <StatusRoscaChart statusOk={dados.resumo.status_ok} statusNok={dados.resumo.status_nok} />
            </div>
          </div>

          {(usuario?.role === "gerente" || usuario?.role === "admin") && ranking.length > 0 && (
            <div className="card">
              <div className="card-title">🏆 Ranking de Setores</div>
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Setor</th>
                    <th>% Atingimento</th>
                  </tr>
                </thead>
                <tbody>
                  {ranking.map((s) => (
                    <tr key={s.nome_setor}>
                      <td>{s.ranking}</td>
                      <td>{s.nome_setor}</td>
                      <td>{s.percentual_atingimento.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </AppLayout>
  );
}
