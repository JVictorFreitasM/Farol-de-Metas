import { AuditoriaRegistro } from "../types";

export function AuditoriaLog({ registros }: { registros: AuditoriaRegistro[] }) {
  return (
    <table className="auditoria-table">
      <thead>
        <tr>
          <th>Data/Hora</th>
          <th>Usuário</th>
          <th>Ação</th>
          <th>Tabela</th>
          <th>Detalhes</th>
        </tr>
      </thead>
      <tbody>
        {registros.map((r) => (
          <tr key={r.id}>
            <td>{new Date(r.timestamp).toLocaleString("pt-BR")}</td>
            <td>{r.usuario ?? "-"}</td>
            <td className={`acao-${r.acao.toLowerCase()}`}>{r.acao}</td>
            <td>{r.tabela}</td>
            <td>
              {r.campos_alterados
                ? Object.entries(r.campos_alterados)
                    .map(([campo, { antes, depois }]) => `${campo}: ${antes} → ${depois}`)
                    .join("; ")
                : "-"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
