import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AppLayout } from "../components/AppLayout";
import { DashboardCards } from "../components/DashboardCards";
import { StatusRoscaChart, TendenciaMensalChart } from "../components/DashboardCharts";
import { MetasNaoPreenchidas } from "../components/MetasNaoPreenchidas";
import { useAuth } from "../hooks/useAuth";
import { gerarOpcoesAno, useAnoSelecionado } from "../hooks/useAnoSelecionado";
import { comparativaSetores, dashboardSetor } from "../services/relatoriosService";
import { listarSetores } from "../services/metasService";
import { ComparativaSetor, DashboardResumo, Setor } from "../types";

export function DashboardPage() {
  const { usuario } = useAuth();
  const isGerente = usuario?.role === "gerente" || usuario?.role === "admin";
  const [ano, setAno] = useAnoSelecionado();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorId, setSetorId] = useState<string | undefined>(usuario?.role === "responsavel" ? usuario.setor_id ?? undefined : undefined);
  const [dados, setDados] = useState<DashboardResumo | null>(null);
  const [ranking, setRanking] = useState<ComparativaSetor[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isGerente) return;
    listarSetores()
      .then(setSetores)
      .catch((err) => toast.error(err.message));
  }, [isGerente]);

  useEffect(() => {
    if (isGerente) {
      comparativaSetores(ano, "ano")
        .then((r) => setRanking(r.setores))
        .catch(() => {});
    }
  }, [ano, isGerente]);

  useEffect(() => {
    let ativo = true;
    if (!setorId) {
      setDados(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    dashboardSetor(setorId, ano, "ano")
      .then((d) => ativo && setDados(d))
      .catch((err) => toast.error(err.message))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [ano, setorId]);

  return (
    <AppLayout titulo={`Dashboard > ${ano}`}>
      <div className="filtros" style={{ marginBottom: 16 }}>
        <label>
          Ano
          <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
            {gerarOpcoesAno().map((opcao) => (
              <option key={opcao} value={opcao}>{opcao}</option>
            ))}
          </select>
        </label>
        {isGerente && (
          <label>
            Setor
            <select value={setorId ?? ""} onChange={(e) => setSetorId(e.target.value || undefined)}>
              <option value="">Selecione um setor...</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </label>
        )}
      </div>

      {isGerente && ranking.length > 0 && (
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

      {loading && <p>Carregando...</p>}
      {!loading && isGerente && !setorId && <p>Selecione um setor acima para ver o detalhamento.</p>}

      {dados && (
        <>
          <DashboardCards dados={dados} />

          <MetasNaoPreenchidas metas={dados.metas_incompletas} />

          <div className="charts-row">
            <div className="card">
              <div className="card-title">Evolução Mensal (OK x NOK)</div>
              <TendenciaMensalChart evolucao={dados.evolucao_mensal} />
            </div>
            <div className="card">
              <div className="card-title">Status por Indicador</div>
              <StatusRoscaChart statusOk={dados.resumo.status_ok} statusNok={dados.resumo.status_nok} />
            </div>
          </div>
        </>
      )}
    </AppLayout>
  );
}
