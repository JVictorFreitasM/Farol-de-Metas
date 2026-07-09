import { ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";

export function Topbar({
  titulo,
  onToggleSidebar,
  onToggleTheme,
  darkMode,
  filtros,
}: {
  titulo: string;
  onToggleSidebar: () => void;
  onToggleTheme: () => void;
  darkMode: boolean;
  filtros?: ReactNode;
}) {
  const { usuario } = useAuth();

  return (
    <header className="topbar">
      <button className="hamburger" onClick={onToggleSidebar} aria-label="Menu">
        ☰
      </button>
      <div className="topbar-breadcrumb">{titulo}</div>
      <div className="topbar-filtros">{filtros}</div>
      <div className="topbar-right">
        <button className="theme-toggle" onClick={onToggleTheme} aria-label="Alternar tema">
          {darkMode ? "☀️" : "🌙"}
        </button>
        <span className="topbar-usuario">{usuario?.nome}</span>
      </div>
    </header>
  );
}
