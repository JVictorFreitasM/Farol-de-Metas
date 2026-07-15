import { Fragment, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import { AppLayout } from "../components/AppLayout";
import { DashboardCards } from "../components/DashboardCards";
import { StatusRoscaChart, TendenciaMensalChart } from "../components/DashboardCharts";
import { MetasNaoPreenchidas } from "../components/MetasNaoPreenchidas";
import { useAuth } from "../hooks/useAuth";
import { gerarOpcoesAno, useAnoSelecionado } from "../hooks/useAnoSelecionado";
import { useSetorSelecionado } from "../hooks/useSetorSelecionado";
import { comparativaSetores, dashboardSetor } from "../services/relatoriosService";
import { listarMetas, listarSetores } from "../services/metasService";
import { ComparativaSetor, DashboardResumo, Meta, MESES, MESES_LABEL, Mes, Setor } from "../types";

export function DashboardPage() {
  const { usuario } = useAuth();
  const isGerente = usuario?.role === "gerente" || usuario?.role === "admin";
  const [ano, setAno] = useAnoSelecionado();
  const [mes, setMes] = useState<Mes>(MESES[new Date().getMonth()]);
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorId, setSetorId] = useSetorSelecionado();
  const [dados, setDados] = useState<DashboardResumo | null>(null);
  const [metasSetor, setMetasSetor] = useState<Meta[]>([]);
  const [ranking, setRanking] = useState<ComparativaSetor[]>([]);
  const [setorExpandido, setSetorExpandido] = useState<string | null>(null);
  const [cardSetorExpandido, setCardSetorExpandido] = useState(false);
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

  const { metasPendentes, metasNaoBatidas, consolidacao } = useMemo(() => {
    const ivs = metasSetor.filter((m) => m.ic_iv === "IV" && m.ativo);
    const pendentes = ivs
      .filter((m) => m.meses[mes].real === null)
      .map((m) => ({ id: m.id, indicador: m.indicador, responsavel: m.responsavel }));
    const naoBatidas = ivs
      .filter((m) => m.meses[mes].real !== null && m.meses[mes].status === "nok")
      .map((m) => {
        const meta = Number(m.meses[mes].meta);
        const real = Number(m.meses[mes].real);
        const percentual = meta ? (real / meta) * 100 : 0;
        return { id: m.id, indicador: m.indicador, responsavel: m.responsavel, percentual };
      });
    const total = ivs.length;
    const percentual = total > 0 ? ((total - pendentes.length) / total) * 100 : 0;
    return {
      metasPendentes: pendentes,
      metasNaoBatidas: naoBatidas,
      consolidacao: { percentual, completo: total > 0 && pendentes.length === 0 },
    };
  }, [metasSetor, mes]);

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
                    className="ranking-row-clicavel"
                    onClick={() => setSetorExpandido(setorExpandido === s.setor_id ? null : s.setor_id)}
                  >
                    <td>{s.ranking}</td>
                    <td>{s.nome_setor}</td>
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
                  {setorExpandido === s.setor_id && s.metas_pendentes.length > 0 && (
                    <tr>
                      <td colSpan={5}>
                        <ul className="metas-pendentes-lista">
                          {s.metas_pendentes.map((m) => (
                            <li key={m.id}>
                              <strong>{m.indicador}</strong> ({m.ic_iv}) — {m.responsavel}{" "}
                              <Link to="/metas">Editar</Link>
                            </li>
                          ))}
                        </ul>
                      </td>
                    </tr>
                  )}
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
          <DashboardCards
            dados={dados}
            mes={mes}
            metasPendentes={metasPendentes}
            metasNaoBatidas={metasNaoBatidas}
            consolidacao={consolidacao}
            expandido={cardSetorExpandido}
            onToggleExpandir={() => setCardSetorExpandido((v) => !v)}
          />

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
