import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { login as loginRequest } from "../services/authService";
import { ANO_SESSION_KEY } from "./useAnoSelecionado";
import { Usuario } from "../types";

interface AuthContextValue {
  usuario: Usuario | null;
  loading: boolean;
  login: (email: string, senha: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function decodeUsuarioFromToken(token: string): Usuario | null {
  try {
    const base64Url = token.split(".")[1];
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded));
    return {
      id: payload.sub,
      nome: payload.nome,
      email: payload.email,
      setor_id: payload.setorId ?? null,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      const decoded = decodeUsuarioFromToken(token);
      if (decoded) setUsuario(decoded);
      else localStorage.removeItem("auth_token");
    }
    setLoading(false);
  }, []);

  const login = async (email: string, senha: string) => {
    const data = await loginRequest(email, senha);
    localStorage.setItem("auth_token", data.token);
    setUsuario(data.usuario);
  };

  const logout = () => {
    localStorage.removeItem("auth_token");
    sessionStorage.removeItem(ANO_SESSION_KEY);
    setUsuario(null);
    window.location.href = "/login";
  };

  return <AuthContext.Provider value={{ usuario, loading, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
