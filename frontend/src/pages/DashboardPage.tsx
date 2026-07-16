import { Fragment, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import { AppLayout } from "../components/AppLayout";
import { DashboardCards } from "../components/DashboardCards";
import { StatusRoscaChart, TendenciaMensalChart } from "../components/DashboardCharts";
import { useAuth } from "../hooks/useAuth";
import { gerarOpcoesAno, useAnoSelecionado } from "../hooks/useAnoSelecionado";
import { useSetorSelecionado } from "../hooks/useSetorSelecionado";
import { comparativaSetores, dashboardSetor } from "../services/relatoriosService";
import { listarMetas, listarSetores } from "../services/metasService";
import { ComparativaSetor, DashboardResumo, Meta, MESES, MESES_LABEL, Mes, Setor, StatusMeta } from "../types";

interface MesStatus {
  mes: Mes;
  total: number;
  pendentes: number;
  status: StatusMeta | null;
}
type DetalheSetor = { loading: true } | { loading: false; mesesStatus: MesStatus[] };

/** Para cada um dos 12 meses, verifica se todos os indicadores ativos do setor (IC + IV) têm
 * "real" preenchido. Preenchimento é diferente de atingimento: um IC sem dado também conta como
 * pendência, mesmo que não entre no cálculo de % Atingimento (que é só sobre IVs). */
function computarMesesStatus(metas: Meta[]): MesStatus[] {
  const todos = metas.filter((m) => m.ativo);
  return MESES.map((mes) => {
    const total = todos.length;
    const pendentes = todos.filter((m) => m.meses[mes].real === null).length;
    const status: StatusMeta | null = total > 0 ? (pendentes === 0 ? "ok" : "nok") : null;
    return { mes, total, pendentes, status };
  });
}

export function DashboardPage() {
  const { usuario } = useAuth();
  const isGerente = usuario?.role === "gerente" || usuario?.role === "admin";
  const podeTrocarSetor = usuario?.role === "admin" || (usuario?.role === "gerente" && !usuario.setor_id);
  const [ano, setAno] = useAnoSelecionado();
  const [mes, setMes] = useState<Mes>(MESES[new Date().getMonth()]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorId, setSetorId] = useSetorSelecionado();
  const [dados, setDados] = useState<DashboardResumo | null>(null);
  const [metasSetor, setMetasSetor] = useState<Meta[]>([]);
  const [ranking, setRanking] = useState<ComparativaSetor[]>([]);
  const [setorExpandido, setSetorExpandido] = useState<string | null>(null);
  const [detalhes, setDetalhes] = useState<Record<string, DetalheSetor>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isGerente) return;
    listarSetores()
      .then(setSetores)
      .catch((err) => toast.error(err.message));
  }, [isGerente]);

  // Admin/gerente sem setor fixo: escolhe o primeiro setor disponível se nenhum estiver selecionado.
  useEffect(() => {
    if (!setorId && setores.length > 0) {
      setSetorId(setores[0].id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setores]);

  useEffect(() => {
    if (isGerente) {
      comparativaSetores(ano, "ano", mes)
        .then((r) => setRanking(r.setores))
        .catch(() => {});
    }
  }, [ano, mes, isGerente]);

  // Detalhe da linha mostra os 12 meses do ano — invalida o cache e recolhe ao trocar o ano.
  useEffect(() => {
    setDetalhes({});
    setSetorExpandido(null);
  }, [ano]);

  useEffect(() => {
    let ativo = true;
    if (!setorId) {
      setDados(null);
      setMetasSetor([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all([dashboardSetor(setorId, ano, "ano"), listarMetas({ setor_id: setorId, ano })])
      .then(([d, m]) => {
        if (!ativo) return;
        setDados(d);
        setMetasSetor(m.data);
      })
      .catch((err) => toast.error(err.message))
      .finally(() => ativo && setLoading(false));
    return () => {
      ativo = false;
    };
  }, [ano, setorId]);

  const consolidacao = useMemo(() => {
    const todos = metasSetor.filter((m) => m.ativo);
    const pendentes = todos.filter((m) => m.meses[mes].real === null).length;
    const total = todos.length;
    const percentual = total > 0 ? ((total - pendentes) / total) * 100 : 0;
    return { percentual, completo: total > 0 && pendentes === 0 };
  }, [metasSetor, mes]);

  const alternarLinha = (alvoSetorId: string) => {
    const jaAberto = setorExpandido === alvoSetorId;
    setSetorExpandido(jaAberto ? null : alvoSetorId);
    if (podeTrocarSetor) setSetorId(alvoSetorId);
    if (!jaAberto && !detalhes[alvoSetorId]) {
      setDetalhes((prev) => ({ ...prev, [alvoSetorId]: { loading: true } }));
      listarMetas({ setor_id: alvoSetorId, ano })
        .then((r) => setDetalhes((prev) => ({ ...prev, [alvoSetorId]: { loading: false, mesesStatus: computarMesesStatus(r.data) } })))
        .catch(() => setDetalhes((prev) => ({ ...prev, [alvoSetorId]: { loading: false, mesesStatus: [] } })));
    }
  };

  const renderDetalhe = (detalhe: DetalheSetor | undefined) => {
    if (!detalhe) return null;
    if (detalhe.loading) return <p className="texto-informativo">Carregando...</p>;
    return (
      <>
        <div className="setor-detalhe-titulo">Meses faltantes</div>
        <div className="month-cards-section">
          <div className="month-cards-container">
            {detalhe.mesesStatus.map((m) => (
              <div key={m.mes} className="month-card month-card-somente-leitura">
                <div className="month-card-label">{MESES_LABEL[m.mes]}</div>
                <div className="month-card-value">{m.total - m.pendentes}/{m.total}</div>
                <div className={`month-card-status ${m.status ?? "null"}`}>
                  {m.status ? m.status.toUpperCase() : "-"}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="setor-detalhe-acoes">
          <button
            className="btn-secondary"
            onClick={(e) => {
              e.stopPropagation();
              setSetorExpandido(null);
            }}
          >
            Voltar
          </button>
        </div>
      </>
    );
  };

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
        <label>
          Mês
          <select value={mes} onChange={(e) => setMes(e.target.value as Mes)}>
            {MESES.map((opcao) => (
              <option key={opcao} value={opcao}>{MESES_LABEL[opcao]}</option>
            ))}
          </select>
        </label>
      </div>

      {isGerente && ranking.length > 0 && (
        <div className="card">
          <div className="card-title">🏆 Ranking de Setores</div>
          <table className="ranking-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Setor</th>
                <th>Consolidação Geral</th>
                <th>Pendentes</th>
                <th>% Atingimento</th>
              </tr>
            </thead>
            <tbody>
              {ranking.map((s) => (
                <Fragment key={s.setor_id}>
                  <tr
                    className={`ranking-row-clicavel ${s.setor_id === setorId ? "ranking-row-ativa" : ""}`}
                    onClick={() => alternarLinha(s.setor_id)}
                  >
                    <td>{s.ranking}</td>
                    <td>
                      <span className={`chevron ${setorExpandido === s.setor_id ? "expanded" : ""}`}>▼</span>{" "}
                      {s.nome_setor}
                      {podeTrocarSetor && s.setor_id === setorId ? " ✓" : ""}
                    </td>
                    <td>
                      {s.consolidacao_geral && (
                        <span title={`${s.consolidacao_geral.percentual_preenchido.toFixed(0)}% preenchido em ${MESES_LABEL[mes]}`}>
                          <span className={`status-dot ${s.consolidacao_geral.completo ? "status-dot-ok" : "status-dot-nok"}`} />{" "}
                          {s.consolidacao_geral.percentual_preenchido.toFixed(0)}%
                        </span>
                      )}
                    </td>
                    <td>{s.metas_pendentes.length > 0 ? `${s.metas_pendentes.length} pendentes` : "—"}</td>
                    <td>{s.percentual_atingimento.toFixed(1)}%</td>
                  </tr>
                  <tr className="setor-detalhe-row">
                    <td className="setor-detalhe-cell" colSpan={5}>
                      <div className={`colapsavel setor-detalhe-colapsavel ${setorExpandido === s.setor_id ? "" : "colapsado"}`}>
                        <div>
                          <div className="setor-detalhe">{renderDetalhe(detalhes[s.setor_id])}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loading && <p>Carregando...</p>}
      {!loading && isGerente && !setorId && <p>Nenhum setor disponível.</p>}

      {dados && (
        <>
          <DashboardCards dados={dados} mes={mes} consolidacao={consolidacao} />

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
