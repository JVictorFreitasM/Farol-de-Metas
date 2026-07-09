import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ComparativaSetor } from "../types";

export function RelatorioComparativa({ setores }: { setores: ComparativaSetor[] }) {
  if (setores.length === 0) return <p>Sem dados para o período.</p>;

  const melhor = setores[0];

  return (
    <>
      <div className="badge-melhor-setor">
        🥇 Melhor setor: {melhor.nome_setor} ({melhor.percentual_atingimento.toFixed(0)}%)
      </div>

      <ResponsiveContainer width="100%" height={Math.max(240, setores.length * 40)}>
        <BarChart data={setores} layout="vertical" margin={{ left: 40 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis type="number" domain={[0, 100]} />
          <YAxis type="category" dataKey="nome_setor" width={140} />
          <Tooltip />
          <Bar dataKey="percentual_atingimento" fill="#3b82f6" name="% Atingimento" />
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
