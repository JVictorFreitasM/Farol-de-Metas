import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AppLayout } from "../components/AppLayout";
import { RelatorioComparativa } from "../components/RelatorioComparativa";
import { StatusRoscaChart, TendenciaMensalChart } from "../components/DashboardCharts";
import { useAuth } from "../hooks/useAuth";
import { comparativaSetores, dashboardSetor } from "../services/relatoriosService";
import { ComparativaSetor, DashboardResumo } from "../types";

type Aba = "dashboard" | "comparativa";

export function RelatoriosPage() {
  const { usuario } = useAuth();
  const podeVerComparativa = usuario?.role === "gerente" || usuario?.role === "admin";
  const [aba, setAba] = useState<Aba>("dashboard");
  const [ano, setAno] = useState(new Date().getFullYear());
  const [dados, setDados] = useState<DashboardResumo | null>(null);
  const [setores, setSetores] = useState<ComparativaSetor[]>([]);

  useEffect(() => {
    if (aba === "dashboard") {
      dashboardSetor(usuario?.role === "responsavel" ? usuario.setor_id ?? undefined : undefined, ano, "ano")
        .then(setDados)
        .catch((err) => toast.error(err.message));
    } else {
      comparativaSetores(ano, "ano")
        .then((r) => setSetores(r.setores))
        .catch((err) => toast.error(err.message));
    }
  }, [aba, ano, usuario]);

  const filtros = (
    <div className="filtros">
      <label>
        Ano
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {[ano - 1, ano, ano + 1].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>
    </div>
  );

  return (
    <AppLayout titulo="Relatórios" filtros={filtros}>
      <div className="tabs">
        <button className={aba === "dashboard" ? "active" : ""} onClick={() => setAba("dashboard")}>
          Dashboard do Setor
        </button>
        {podeVerComparativa && (
          <button className={aba === "comparativa" ? "active" : ""} onClick={() => setAba("comparativa")}>
            Comparativa
          </button>
        )}
      </div>

      {aba === "dashboard" && dados && (
        <>
          <div className="charts-row">
            <div className="card">
              <div className="card-title">Tendência Mensal</div>
              <TendenciaMensalChart evolucao={dados.evolucao_mensal} />
            </div>
            <div className="card">
              <div className="card-title">Status OK/NOK</div>
              <StatusRoscaChart statusOk={dados.resumo.status_ok} statusNok={dados.resumo.status_nok} />
            </div>
          </div>

          <div className="card">
            <div className="card-title">ICs com Problemas</div>
            {dados.ic_com_problemas.length === 0 ? (
              <p>Nenhum IC com problemas no período.</p>
            ) : (
              <table className="ranking-table">
                <thead>
                  <tr>
                    <th>Indicador</th>
                    <th>Acumulado</th>
                    <th>Meta</th>
                    <th>%</th>
                    <th>Filhos NOK</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.ic_com_problemas.map((ic) => (
                    <tr key={ic.indicador}>
                      <td>{ic.indicador}</td>
                      <td>{ic.acumulado}</td>
                      <td>{ic.meta_ano ?? "-"}</td>
                      <td>{ic.percentual ?? "-"}</td>
                      <td>{ic.filhos_nok.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {aba === "comparativa" && podeVerComparativa && <RelatorioComparativa setores={setores} />}
    </AppLayout>
  );
}
