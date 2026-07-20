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
import { ComparativoResponse, obterAnosDisponiveis, obterComparativo, PeriodoTipo } from "../services/metasService";
import { formatValor, formatValorEscalado, paraEscalaExibicao } from "../lib/format";
import { Meta, MESES, MESES_LABEL, Mes } from "../types";

const CORES_ANOS = ["#2563eb", "#ef4444", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899"];

function num(valor: string | number | null): number | null {
  if (valor === null || valor === undefined) return null;
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return Number.isFinite(n) ? n : null;
}

/** Só para percentuais já calculados (0-100), como % Execução — nunca para meta/real bruto,
 * que precisa de formatValor(valor, unidade). */
function fmtPct(valor: string | number | null): string {
  const n = num(valor);
  return n === null ? "-" : `${n.toFixed(1)}%`;
}

export function ComparativoIndicador({ metas, anoAtual }: { metas: Meta[]; anoAtual: number }) {
  const indicadores = useMemo(() => metas.filter((m) => m.ativo), [metas]);
  const setorId = metas[0]?.setor_id;
  const [metaId, setMetaId] = useState<string>("");
  const [periodoTipo, setPeriodoTipo] = useState<PeriodoTipo>("ano");
  const [mes, setMes] = useState<Mes>(MESES[new Date().getMonth()]);
  const [mesInicio, setMesInicio] = useState<Mes>("jan");
  const [mesFim, setMesFim] = useState<Mes>("jun");
  const [trimestre, setTrimestre] = useState<1 | 2 | 3 | 4>(1);
  const [semestre, setSemestre] = useState<1 | 2>(1);
  const [anosDisponiveis, setAnosDisponiveis] = useState<number[]>([]);
  const [anosSelecionados, setAnosSelecionados] = useState<number[]>([anoAtual]);
  const [resultado, setResultado] = useState<ComparativoResponse | null>(null);
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    if (!metaId && indicadores.length > 0) setMetaId(indicadores[0].id);
  }, [indicadores, metaId]);

  useEffect(() => {
    if (!setorId) return;
    obterAnosDisponiveis(setorId)
      .then((anos) => {
        setAnosDisponiveis(anos);
        // Ano atual sempre marcado; pré-marca também o ano anterior, se existir, mantendo o
        // comportamento original de comparar com o ano anterior por padrão.
        setAnosSelecionados((prev) => {
          const base = prev.includes(anoAtual) ? prev : [...prev, anoAtual];
          const anterior = anoAtual - 1;
          return anos.includes(anterior) && !base.includes(anterior) ? [...base, anterior] : base;
        });
      })
      .catch(() => {});
  }, [setorId, anoAtual]);

  const toggleAno = (ano: number) => {
    if (ano === anoAtual) return; // ano principal não pode ser desmarcado
    setAnosSelecionados((prev) => (prev.includes(ano) ? prev.filter((a) => a !== ano) : [...prev, ano]));
  };

  const gerar = async () => {
    if (!metaId) return;
    setCarregando(true);
    try {
      const anosComparacao = anosSelecionados.filter((a) => a !== anoAtual);
      const r = await obterComparativo(metaId, {
        periodo_tipo: periodoTipo,
        mes: periodoTipo === "mes" ? mes : undefined,
        mes_inicio: periodoTipo === "intervalo" ? mesInicio : undefined,
        mes_fim: periodoTipo === "intervalo" ? mesFim : undefined,
        trimestre: periodoTipo === "trimestre" ? trimestre : undefined,
        semestre: periodoTipo === "semestre" ? semestre : undefined,
        anos_comparacao: anosComparacao.join(","),
      });
      setResultado(r);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar comparativo");
      setResultado(null);
    } finally {
      setCarregando(false);
    }
  };

  const unidadeSelecionada = resultado?.unidade ?? indicadores.find((m) => m.id === metaId)?.unidade ?? "";

  const serieChart = useMemo(() => {
    if (!resultado) return [];
    return resultado.serie_meses.map((s) => {
      const entry: Record<string, unknown> = { mes: MESES_LABEL[s.mes] };
      for (const ano of resultado.anos) {
        entry[`Real ${ano}`] = paraEscalaExibicao(s.valores[ano]?.real ?? null, unidadeSelecionada);
      }
      return entry;
    });
  }, [resultado, unidadeSelecionada]);

  const corPorAno = (ano: number) => {
    if (!resultado) return CORES_ANOS[0];
    const idx = resultado.anos.indexOf(ano);
    return CORES_ANOS[idx % CORES_ANOS.length];
  };

  const anoFaltando = anosSelecionados.filter((a) => !resultado?.anos.includes(a));

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

        <button className="btn-primary" onClick={gerar} disabled={!metaId || carregando}>
          {carregando ? "Gerando..." : "Gerar Gráfico"}
        </button>
      </div>

      <div className="filtro-anos">
        <span className="filtro-anos-label">Anos</span>
        <div className="anos-checkboxes">
          {anosDisponiveis.map((ano) => (
            <label key={ano} className={`checkbox-label ${ano === anoAtual ? "checkbox-label-fixo" : ""}`}>
              <input
                type="checkbox"
                checked={anosSelecionados.includes(ano)}
                disabled={ano === anoAtual}
                onChange={() => toggleAno(ano)}
              />
              {ano}
            </label>
          ))}
        </div>
      </div>

      {!resultado && !carregando && <p className="texto-informativo">Selecione um indicador, período e anos, depois clique em "Gerar Gráfico".</p>}

      {resultado && (
        <>
          <div className="cards-row">
            {resultado.periodos.map((p) => (
              <div className="card" key={p.ano}>
                <div className="card-title" style={{ color: corPorAno(p.ano) }}>{p.label}</div>
                <div className="card-value" style={{ color: corPorAno(p.ano) }}>{formatValor(p.real_acum, unidadeSelecionada)}</div>
                <div className="texto-informativo">
                  Meta: {formatValor(p.meta_acum, unidadeSelecionada)} · {" "}
                  <span className={p.status ? `status-${p.status}` : undefined}>{fmtPct(p.percentual_execucao)}</span>
                </div>
              </div>
            ))}
          </div>

          {anoFaltando.length > 0 && (
            <p className="texto-informativo">
              Nenhum indicador equivalente ("{resultado.indicador}") encontrado no setor para o(s) ano(s) {anoFaltando.join(", ")}.
            </p>
          )}

          <div className="charts-row">
            <div className="card">
              <div className="card-title">Evolução mensal — Real</div>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={serieChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatValorEscalado(value, unidadeSelecionada)} />
                  <Legend />
                  {resultado.anos.map((ano) => (
                    <Line
                      key={ano}
                      type="monotone"
                      dataKey={`Real ${ano}`}
                      stroke={corPorAno(ano)}
                      strokeWidth={2}
                      connectNulls
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="card">
              <div className="card-title">Comparação mês a mês — Real</div>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={serieChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="mes" />
                  <YAxis />
                  <Tooltip formatter={(value: number) => formatValorEscalado(value, unidadeSelecionada)} />
                  <Legend />
                  {resultado.anos.map((ano) => (
                    <Bar key={ano} dataKey={`Real ${ano}`} fill={corPorAno(ano)} radius={[4, 4, 0, 0]} />
                  ))}
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
                    {resultado.anos.map((ano) => (
                      <th key={`meta-${ano}`} style={{ color: corPorAno(ano) }}>Meta {ano}</th>
                    ))}
                    {resultado.anos.map((ano) => (
                      <th key={`real-${ano}`} style={{ color: corPorAno(ano) }}>Real {ano}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {resultado.serie_meses.map((s) => (
                    <tr key={s.mes}>
                      <td>{MESES_LABEL[s.mes]}</td>
                      {resultado.anos.map((ano) => (
                        <td key={`meta-${ano}-${s.mes}`}>{formatValor(s.valores[ano]?.meta ?? null, unidadeSelecionada)}</td>
                      ))}
                      {resultado.anos.map((ano) => (
                        <td key={`real-${ano}-${s.mes}`}>{formatValor(s.valores[ano]?.real ?? null, unidadeSelecionada)}</td>
                      ))}
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
