import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ComparativoResponse, obterComparativo, PeriodoTipo } from "../services/metasService";
import { Meta, MESES, MESES_LABEL, Mes } from "../types";

const COR_PRINCIPAL = "#2563eb";
const COR_COMPARACAO = "#ef4444";

function num(valor: string | number | null): number | null {
  if (valor === null || valor === undefined) return null;
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return Number.isFinite(n) ? n : null;
}

function fmt(valor: string | number | null): string {
  const n = num(valor);
  return n === null ? "-" : n.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

function fmtPct(valor: string | number | null): string {
  const n = num(valor);
  return n === null ? "-" : `${n.toFixed(1)}%`;
}

export function ComparativoIndicador({ metas, anoAtual }: { metas: Meta[]; anoAtual: number }) {
  const indicadores = useMemo(() => metas.filter((m) => m.ativo), [metas]);
  const [metaId, setMetaId] = useState<string>("");
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("ano");
  const [mes, setMes] = useState<Mes>(MESES[new Date().getMonth()]);
  const [mesInicio, setMesInicio] = useState<Mes>("jan");
  const [mesFim, setMesFim] = useState<Mes>("jun");
  const [trimestre, setTrimestre] = useState<1 | 2 | 3 | 4>(1);
  const [semestre, setSemestre] = useState<1 | 2>(1);
  const [anoComparacao, setAnoComparacao] = useState<number>(anoAtual - 1);
  const [resultado, setResultado] = useState<ComparativoResponse | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!metaId && indicadores.length > 0) setMetaId(indicadores[0].id);
  }, [indicadores, metaId]);

  const gerar = async () => {
    if (!metaId) return;
    setCarregando(true);
    try {
      const r = await obterComparativo(metaId, {
        periodo_tipo: periodoTipo,
        mes: periodoTipo === "mes" ? mes : undefined,
        mes_inicio: periodoTipo === "intervalo" ? mesInicio : undefined,
        mes_fim: periodoTipo === "intervalo" ? mesFim : undefined,
        trimestre: periodoTipo === "trimestre" ? trimestre : undefined,
        semestre: periodoTipo === "semestre" ? semestre : undefined,
        ano_comparacao: anoComparacao,
      });
      setResultado(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar comparativo");
      setResultado(null);
    } finally {
      setCarregando(false);
    }
  };

  const serieChart = useMemo(() => {
    if (!resultado) return [];
    return resultado.serie_meses.map((s) => ({
      mes: MESES_LABEL[s.mes],
      [`Real ${resultado.periodo_principal.ano}`]: num(s.periodo_principal.real),
      [`Real ${resultado.periodo_comparacao?.ano ?? anoComparacao}`]: num(s.periodo_comparacao.real),
    }));
  }, [resultado, anoComparacao]);

  const chavesPrincipal = resultado ? `Real ${resultado.periodo_principal.ano}` : "";
  const chavesComparacao = resultado ? `Real ${resultado.periodo_comparacao?.ano ?? anoComparacao}` : "";

  return (
    <div className="comparativo-wrapper">
      <div className="filtros" style={{ marginBottom: 16 }}>
        <label>
          Indicador
          <select value={metaId} onChange={(e) => setMetaId(e.target.value)}>
            {indicadores.map((m) => (
              <option key={m.id} value={m.id}>
                {m.ic_iv === "IV" ? "— " : ""}
                {m.indicador}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo de período
          <select value={periodoTipo} onChange={(e) => setPeriodoTipo(e.target.value as PeriodoTipo)}>
            <option value="mes">Mês</option>
            <option value="intervalo">Intervalo de meses</option>
            <option value="trimestre">Trimestre</option>
            <option value="semestre">Semestre</option>
            <option value="ano">Ano</option>
          </select>
        </label>

        {periodoTipo === "mes" && (
          <label>
            Mês
            <select value={mes} onChange={(e) => setMes(e.target.value as Mes)}>
              {MESES.map((m) => (
                <option key={m} value={m}>{MESES_LABEL[m]}</option>
              ))}
            </select>
          </label>
        )}

        {periodoTipo === "intervalo" && (
          <>
            <label>
              De
              <select value={mesInicio} onChange={(e) => setMesInicio(e.target.value as Mes)}>
                {MESES.map((m) => (
                  <option key={m} value={m}>{MESES_LABEL[m]}</option>
                ))}
              </select>
            </label>
            <label>
              até
              <select value={mesFim} onChange={(e) => setMesFim(e.target.value as Mes)}>
                {MESES.map((m) => (
                  <option key={m} value={m}>{MESES_LABEL[m]}</option>
                ))}
              </select>
            </label>
          </>
        )}

        {periodoTipo === "trimestre" && (
          <label>
            Trimestre
            <select value={trimestre} onChange={(e) => setTrimestre(Number(e.target.value) as 1 | 2 | 3 | 4)}>
              <option value={1}>Q1 (Jan–Mar)</option>
              <option value={2}>Q2 (Abr–Jun)</option>
              <option value={3}>Q3 (Jul–Set)</option>
              <option value={4}>Q4 (Out–Dez)</option>
            </select>
          </label>
        )}

        {periodoTipo === "semestre" && (
          <label>
            Semestre
            <select value={semestre} onChange={(e) => setSemestre(Number(e.target.value) as 1 | 2)}>
              <option value={1}>H1 (Jan–Jun)</option>
              <option value={2}>H2 (Jul–Dez)</option>
            </select>
          </label>
        )}

        <label>
          Comparar com o ano
          <input
            type="number"
            value={anoComparacao}
            onChange={(e) => setAnoComparacao(Number(e.target.value))}
            style={{ width: 80 }}
          />
        </label>

        <button className="btn-primary" onClick={gerar} disabled={!metaId || carregando}>
          {carregando ? "Gerando..." : "Gerar Gráfico"}
        </button>
      </div>

      {!resultado && !carregando && <p className="texto-informativo">Selecione um indicador e período, depois clique em "Gerar Gráfico".</p>}

      {resultado && (
        <>
          <div className="cards-row">
            <div className="card">
              <div className="card-title">Real — {resultado.periodo_principal.label}</div>
              <div className="card-value" style={{ color: COR_PRINCIPAL }}>{fmt(resultado.periodo_principal.real_acum)}</div>
              {resultado.periodo_comparacao && (
                <div className="texto-informativo">
                  vs <span style={{ color: COR_COMPARACAO }}>{fmt(resultado.periodo_comparacao.real_acum)}</span> em {resultado.periodo_comparacao.label}
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-title">Meta — {resultado.periodo_principal.label}</div>
              <div className="card-value">{fmt(resultado.periodo_principal.meta_acum)}</div>
              {resultado.periodo_comparacao && (
                <div className="texto-informativo">vs {fmt(resultado.periodo_comparacao.meta_acum)} em {resultado.periodo_comparacao.label}</div>
              )}
            </div>
            <div className="card">
              <div className="card-title">% Execução</div>
              <div className={`card-value ${resultado.periodo_principal.status ? `status-${resultado.periodo_principal.status}` : ""}`}>
                {fmtPct(resultado.periodo_principal.percentual_execucao)}
              </div>
              {resultado.periodo_comparacao && (
                <div className="texto-informativo">vs {fmtPct(resultado.periodo_comparacao.percentual_execucao)}</div>
              )}
            </div>
            <div className="card">
              <div className="card-title">Variação (Real)</div>
              {resultado.variacao ? (
                <div className={`card-value ${num(resultado.variacao.real_delta)! >= 0 ? "status-ok" : "status-nok"}`}>
                  {num(resultado.variacao.real_delta)! >= 0 ? "▲" : "▼"} {fmt(resultado.variacao.real_delta)}{" "}
                  <span style={{ fontSize: 14 }}>({fmtPct(resultado.variacao.real_delta_percentual)})</span>
                </div>
              ) : (
                <div className="texto-informativo">Sem dados de {anoComparacao} para comparar.</div>
              )}
            </div>
          </div>

          {!resultado.periodo_comparacao && (
            <p className="texto-informativo">
              Nenhum indicador equivalente ("{resultado.indicador}") encontrado no setor para o ano {anoComparacao}. Mostrando apenas o período principal.
            </p>
          )}

          <div className="charts-row">
            <div className="card">
              <div className="card-title">Evolução mensal — Real</div>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={serieChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey={chavesPrincipal} stroke={COR_PRINCIPAL} strokeWidth={2} connectNulls />
                  <Line type="monotone" dataKey={chavesComparacao} stroke={COR_COMPARACAO} strokeWidth={2} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <div className="card-title">Comparação mês a mês — Real</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={serieChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={chavesPrincipal} fill={COR_PRINCIPAL} radius={[4, 4, 0, 0]} />
                  <Bar dataKey={chavesComparacao} fill={COR_COMPARACAO} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Detalhamento mês a mês</div>
            <div className="metas-table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Mês</th>
                    <th>Meta {resultado.periodo_principal.ano}</th>
                    <th>Real {resultado.periodo_principal.ano}</th>
                    <th>Meta {resultado.periodo_comparacao?.ano ?? anoComparacao}</th>
                    <th>Real {resultado.periodo_comparacao?.ano ?? anoComparacao}</th>
                  </tr>
                </thead>
                <tbody>
                  {resultado.serie_meses.map((s) => (
                    <tr key={s.mes}>
                      <td>{MESES_LABEL[s.mes]}</td>
                      <td>{fmt(s.periodo_principal.meta)}</td>
                      <td>{fmt(s.periodo_principal.real)}</td>
                      <td>{fmt(s.periodo_comparacao.meta)}</td>
                      <td>{fmt(s.periodo_comparacao.real)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
