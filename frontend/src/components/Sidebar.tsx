import { NavLink } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import farolIcon from "../assets/farol_de_metas_icon.svg";

export function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { usuario, logout } = useAuth();

  return (
    <aside className={`sidebar ${open ? "open" : ""}`}>
      <div className="sidebar-logo">
        <img src={farolIcon} alt="Farol de Metas" className="sidebar-logo-img" />
        FAROL
      </div>

      <nav className="sidebar-nav">
        <div className="sidebar-section">Principal</div>
        <NavLink to="/dashboard" onClick={onClose}>Dashboard</NavLink>

        <div className="sidebar-section">Dados</div>
        <NavLink to="/metas" onClick={onClose}>Metas</NavLink>
        {(usuario?.role === "gerente" || usuario?.role === "admin") && (
          <NavLink to="/produtos" onClick={onClose}>Produtos</NavLink>
        )}

        <div className="sidebar-section">Análise</div>
        <NavLink to="/relatorios" onClick={onClose}>Relatórios</NavLink>
        <NavLink to="/auditoria" onClick={onClose}>Auditoria</NavLink>

        <div className="sidebar-section">Sistema</div>
        <NavLink to="/configuracoes" onClick={onClose}>Configurações</NavLink>
        <button className="sidebar-logout" onClick={logout}>Sair</button>
      </nav>

      {usuario && (
        <div className="sidebar-usuario">
          <strong>{usuario.nome}</strong>
          <span>{usuario.role}</span>
        </div>
      )}
    </aside>
  );
}
