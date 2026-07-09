import {
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { DashboardResumo } from "../types";

const COLORS = { ok: "#10b981", nok: "#ef4444" };

export function TendenciaMensalChart({ evolucao }: { evolucao: DashboardResumo["evolucao_mensal"] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <LineChart data={evolucao}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="mes" />
        <YAxis />
        <Tooltip />
        <Legend />
        <Line type="monotone" dataKey="status_ok" name="OK" stroke={COLORS.ok} />
        <Line type="monotone" dataKey="status_nok" name="NOK" stroke={COLORS.nok} />
      </LineChart>
    </ResponsiveContainer>
  );
}

export function StatusRoscaChart({ statusOk, statusNok }: { statusOk: number; statusNok: number }) {
  const data = [
    { name: "OK", value: statusOk },
    { name: "NOK", value: statusNok },
  ];
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={90} dataKey="value">
          {data.map((entry) => (
            <Cell key={entry.name} fill={entry.name === "OK" ? COLORS.ok : COLORS.nok} />
          ))}
        </Pie>
        <Tooltip />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
