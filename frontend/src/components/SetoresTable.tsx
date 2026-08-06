import { Setor } from "../types";

export function SetoresTable({
  setores,
  onEditar,
  onInativar,
  onAtivar,
}: {
  setores: Setor[];
  onEditar: (setor: Setor) => void;
  onInativar: (setor: Setor) => void;
  onAtivar: (setor: Setor) => void;
}) {
  return (
    <table className="auditoria-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Email</th>
          <th>Status</th>
          <th>Ações</th>
        </tr>
      </thead>
      <tbody>
        {setores.length === 0 && (
          <tr>
            <td colSpan={4}>Nenhum setor encontrado.</td>
          </tr>
        )}
        {setores.map((s) => (
          <tr key={s.id} className={!s.ativo ? "indicador-row-inativo" : ""}>
            <td>{s.nome}</td>
            <td>{s.email ?? "-"}</td>
            <td className={s.ativo ? "acao-create" : "acao-delete"}>{s.ativo ? "Ativo" : "Inativo"}</td>
            <td>
              <button className="btn-secondary" onClick={() => onEditar(s)}>Editar</button>{" "}
              {s.ativo ? (
                <button className="btn-link btn-link-warning" onClick={() => onInativar(s)}>Inativar</button>
              ) : (
                <button className="btn-link btn-link-success" onClick={() => onAtivar(s)}>Ativar</button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
