import { ReactNode, useEffect, useState } from "react";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";

export function AppLayout({ titulo, filtros, children }: { titulo: string; filtros?: ReactNode; children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem("theme") === "dark");

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? "dark" : "light";
    localStorage.setItem("theme", darkMode ? "dark" : "light");
  }, [darkMode]);

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="app-main">
        <Topbar
          titulo={titulo}
          filtros={filtros}
          darkMode={darkMode}
          onToggleTheme={() => setDarkMode((d) => !d)}
          onToggleSidebar={() => setSidebarOpen((o) => !o)}
        />
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}
