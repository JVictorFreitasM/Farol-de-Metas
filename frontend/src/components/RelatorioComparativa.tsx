import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ComparativaSetor } from "../types";

const CORES_ATINGIMENTO = {
  verde: "#4CAF50",
  amarelo: "#FFC107",
  laranja: "#FF9800",
  vermelho: "#F44336",
};

function corPorAtingimento(percentual: number): string {
  if (percentual > 75) return CORES_ATINGIMENTO.verde;
  if (percentual >= 50) return CORES_ATINGIMENTO.amarelo;
  if (percentual >= 25) return CORES_ATINGIMENTO.laranja;
  return CORES_ATINGIMENTO.vermelho;
}

export function RelatorioComparativa({ setores }: { setores: ComparativaSetor[] }) {
  if (setores.length === 0) return <p>Sem dados para o período.</p>;

  const melhor = setores[0];

  return (
    <>
      <div className="badge-melhor-setor">
        🥇 Melhor setor: {melhor.nome_setor} ({melhor.percentual_atingimento.toFixed(0)}%)
      </div>

      <div className="legenda-cores-atingimento">
        <span><span className="legenda-cor" style={{ background: CORES_ATINGIMENTO.verde }} /> &gt; 75%</span>
        <span><span className="legenda-cor" style={{ background: CORES_ATINGIMENTO.amarelo }} /> 50–74%</span>
        <span><span className="legenda-cor" style={{ background: CORES_ATINGIMENTO.laranja }} /> 25–49%</span>
        <span><span className="legenda-cor" style={{ background: CORES_ATINGIMENTO.vermelho }} /> &lt; 25%</span>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(240, setores.length * 40)}>
        <BarChart data={setores} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 100]} />
          <YAxis type="category" dataKey="nome_setor" width={140} />
          <Tooltip />
          <Bar dataKey="percentual_atingimento" name="% Atingimento">
            {setores.map((s) => (
              <Cell key={s.nome_setor} fill={corPorAtingimento(s.percentual_atingimento)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      <table className="ranking-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Setor</th>
            <th>Indicadores</th>
            <th>OK</th>
            <th>% Atingimento</th>
          </tr>
        </thead>
        <tbody>
          {setores.map((s) => (
            <tr key={s.nome_setor}>
              <td>{s.ranking}</td>
              <td>{s.nome_setor}</td>
              <td>{s.total_indicadores}</td>
              <td>{s.status_ok}</td>
              <td>{s.percentual_atingimento.toFixed(1)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
