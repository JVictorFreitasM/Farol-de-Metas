import { useState } from "react";
import { toast } from "react-toastify";
import { Produto, StatusProduto } from "../types";

export function ProdutosModal({
  produto,
  onSalvar,
  onFechar,
}: {
  produto?: Produto | null;
  onSalvar: (body: { nome: string; descricao?: string; status: StatusProduto }) => Promise<void>;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(produto?.nome ?? "");
  const [descricao, setDescricao] = useState(produto?.descricao ?? "");
  const [status, setStatus] = useState<StatusProduto>(produto?.status ?? "ativo");
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    if (!nome.trim()) return toast.error("Informe o nome do produto");

    setSalvando(true);
    try {
      await onSalvar({ nome: nome.trim(), descricao: descricao.trim() || undefined, status });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="card-title">{produto ? "Editar produto" : "Novo produto"}</div>

        <div className="modal-form">
          <label className="form-group form-group-full">
            Nome
            <input className="form-input" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>

          <label className="form-group form-group-full">
            Descrição
            <textarea
              className="form-input"
              rows={3}
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
            />
          </label>

          <label className="form-group form-group-full">
            Status
            <select className="form-input" value={status} onChange={(e) => setStatus(e.target.value as StatusProduto)}>
              <option value="ativo">Ativo</option>
              <option value="inativo">Inativo</option>
            </select>
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
