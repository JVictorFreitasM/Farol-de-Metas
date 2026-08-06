import { createContext, ReactNode, useContext, useEffect, useState } from "react";
import { getMe, loginUrl, logoutUrl, UsuarioNaoVinculadoError } from "../services/auth";
import { ANO_SESSION_KEY } from "./useAnoSelecionado";
import { SETOR_SESSION_KEY } from "./sessionKeys";
import { Usuario } from "../types";

interface AuthContextValue {
  usuario: Usuario | null;
  loading: boolean;
  /** Não-nulo quando autenticado no IdP mas sem Usuario local vinculado (OS-009-B/C). */
  erroVinculo: string | null;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [loading, setLoading] = useState(true);
  const [erroVinculo, setErroVinculo] = useState<string | null>(null);

  useEffect(() => {
    getMe()
      .then((data) => {
        if (data) {
          setUsuario(data);
        } else {
          // Não autenticado no IdP — navegação cheia (não é chamada de API), o backend
          // redireciona pro /authorize do IdP.
          window.location.href = loginUrl();
        }
      })
      .catch((err) => {
        if (err instanceof UsuarioNaoVinculadoError) {
          setErroVinculo(err.message);
        } else {
          setErroVinculo("Não foi possível verificar sua sessão. Tente novamente.");
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const logout = () => {
    sessionStorage.removeItem(ANO_SESSION_KEY);
    sessionStorage.removeItem(SETOR_SESSION_KEY);
    window.location.href = logoutUrl();
  };

  return (
    <AuthContext.Provider value={{ usuario, loading, erroVinculo, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
