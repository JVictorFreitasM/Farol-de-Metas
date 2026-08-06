import { useState } from "react";
import { toast } from "react-toastify";
import { Setor } from "../types";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function SetoresModal({
  setor,
  onSalvar,
  onFechar,
}: {
  setor?: Setor | null;
  onSalvar: (body: { nome: string; email?: string | null }) => Promise<void>;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(setor?.nome ?? "");
  const [email, setEmail] = useState(setor?.email ?? "");
  const [salvando, setSalvando] = useState(false);

  const handleSalvar = async () => {
    const nomeTrim = nome.trim();
    const emailTrim = email.trim();
    if (!nomeTrim) return toast.error("Informe o nome do setor");
    if (emailTrim && !EMAIL_REGEX.test(emailTrim)) return toast.error("Email inválido");

    setSalvando(true);
    try {
      // Editando: string vazia limpa o email (null); string preenchida atualiza. Criando: omite
      // o campo por completo quando vazio (email é opcional na criação, não faz sentido null lá).
      await onSalvar({
        nome: nomeTrim,
        email: emailTrim ? emailTrim : setor ? null : undefined,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="card-title">{setor ? "Editar setor" : "Novo setor"}</div>

        <div className="modal-form">
          <label className="form-group form-group-full">
            Nome
            <input className="form-input" value={nome} onChange={(e) => setNome(e.target.value)} />
          </label>

          <label className="form-group form-group-full">
            Email (opcional)
            <input
              className="form-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="setor@empresa.com"
            />
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
