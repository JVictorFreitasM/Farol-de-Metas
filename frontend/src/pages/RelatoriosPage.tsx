import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AppLayout } from "../components/AppLayout";
import { RelatorioComparativa } from "../components/RelatorioComparativa";
import { ExportarExcelModal } from "../components/ExportarExcelModal";
import { StatusRoscaChart, TendenciaMensalChart } from "../components/DashboardCharts";
import { useAuth } from "../hooks/useAuth";
import { gerarOpcoesAno, useAnoSelecionado } from "../hooks/useAnoSelecionado";
import { comparativaSetores, dashboardSetor } from "../services/relatoriosService";
import { listarSetores } from "../services/metasService";
import { formatValor } from "../lib/format";
import { ComparativaSetor, DashboardResumo, Setor } from "../types";

type Aba = "dashboard" | "comparativa";

export function RelatoriosPage() {
  const { usuario } = useAuth();
  const podeVerComparativa = usuario?.role === "gerente" || usuario?.role === "admin";
  const [aba, setAba] = useState<Aba>("dashboard");
  const [ano, setAno] = useAnoSelecionado();
  const [setores, setSetores] = useState<Setor[]>([]);
  const [setorId, setSetorId] = useState<string | undefined>(
    usuario?.role === "responsavel" ? usuario.setor_id ?? undefined : undefined
  );
  const [dados, setDados] = useState<DashboardResumo | null>(null);
  const [comparativa, setComparativa] = useState<ComparativaSetor[]>([]);
  const [modalExportarAberto, setModalExportarAberto] = useState(false);

  useEffect(() => {
    listarSetores()
      .then(setSetores)
      .catch((err) => toast.error(err.message));
  }, []);

  useEffect(() => {
    if (aba === "dashboard") {
      if (!setorId) {
        setDados(null);
        return;
      }
      dashboardSetor(setorId, ano, "ano")
        .then(setDados)
        .catch((err) => toast.error(err.message));
    } else {
      comparativaSetores(ano, "ano")
        .then((r) => setComparativa(r.setores))
        .catch((err) => toast.error(err.message));
    }
  }, [aba, ano, setorId]);

  const filtros = (
    <div className="filtros">
      <label>
        Ano
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {gerarOpcoesAno().map((opcao) => (
            <option key={opcao} value={opcao}>{opcao}</option>
          ))}
        </select>
      </label>
      {podeVerComparativa && aba === "dashboard" && (
        <label>
          Setor
          <select value={setorId ?? ""} onChange={(e) => setSetorId(e.target.value || undefined)}>
            <option value="">Selecione...</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
      )}
      <button className="btn-primary" onClick={() => setModalExportarAberto(true)}>Exportar Excel</button>
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

      {aba === "dashboard" && podeVerComparativa && !setorId && <p>Selecione um setor para ver o dashboard.</p>}

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
                    <th>IVs NOK</th>
                  </tr>
                </thead>
                <tbody>
                  {dados.ic_com_problemas.map((ic) => (
                    <tr key={ic.indicador}>
                      <td>{ic.indicador}</td>
                      <td>{formatValor(ic.acumulado, ic.unidade)}</td>
                      <td>{formatValor(ic.meta_ano, ic.unidade)}</td>
                      <td>{ic.percentual !== null ? `${ic.percentual}%` : "-"}</td>
                      <td>{ic.ivs_nok.join(", ")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}

      {aba === "comparativa" && podeVerComparativa && <RelatorioComparativa setores={comparativa} />}

      {modalExportarAberto && usuario && (
        <ExportarExcelModal
          setores={setores}
          usuario={usuario}
          anoInicial={ano}
          onFechar={() => setModalExportarAberto(false)}
        />
      )}
    </AppLayout>
  );
}
