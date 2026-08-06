import { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { Role } from "../types";

export function ProtectedRoute({ children, roles }: { children: ReactNode; roles?: Role[] }) {
  const { usuario, loading, erroVinculo } = useAuth();

  if (loading) return <div className="loading-screen">Carregando...</div>;
  // Autenticado no IdP mas sem Usuario local vinculado (OS-009-B/C) — não há para onde
  // navegar localmente, a ação é administrativa (vincular idpUserId), não um novo login.
  if (erroVinculo) return <div className="loading-screen">Acesso não configurado: {erroVinculo}</div>;
  // usuario null aqui só acontece momentaneamente antes do redirect para o login do IdP
  // (disparado pelo AuthProvider) — não há mais rota local "/login" para navegar.
  if (!usuario) return <div className="loading-screen">Redirecionando para o login...</div>;
  if (roles && !roles.includes(usuario.role)) return <Navigate to="/dashboard" replace />;

  return <>{children}</>;
}
