import { Produto } from "../types";

export function ProdutosTable({
  produtos,
  podeGerenciar,
  onEditar,
  onDeletar,
}: {
  produtos: Produto[];
  podeGerenciar: boolean;
  onEditar: (produto: Produto) => void;
  onDeletar: (produto: Produto) => void;
}) {
  return (
    <table className="auditoria-table">
      <thead>
        <tr>
          <th>Nome</th>
          <th>Descrição</th>
          <th>Metas</th>
          <th>Status</th>
          {podeGerenciar && <th>Ações</th>}
        </tr>
      </thead>
      <tbody>
        {produtos.length === 0 && (
          <tr>
            <td colSpan={podeGerenciar ? 5 : 4}>Nenhum produto encontrado.</td>
          </tr>
        )}
        {produtos.map((p) => (
          <tr key={p.id}>
            <td>{p.nome}</td>
            <td>{p.descricao ?? "-"}</td>
            <td>{p._count?.metas ?? 0}</td>
            <td className={p.status === "ativo" ? "acao-create" : "acao-delete"}>
              {p.status === "ativo" ? "Ativo" : "Inativo"}
            </td>
            {podeGerenciar && (
              <td>
                <button className="btn-secondary" onClick={() => onEditar(p)}>Editar</button>{" "}
                <button className="btn-secondary" onClick={() => onDeletar(p)}>Excluir</button>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
