import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../hooks/useAuth";

export function ConfiguracoesPage() {
  const { usuario } = useAuth();

  return (
    <AppLayout titulo="Configurações">
      <div className="card">
        <div className="card-title">Perfil</div>
        <p>Nome: {usuario?.nome}</p>
        <p>Email: {usuario?.email}</p>
        <p>Perfil: {usuario?.role}</p>
      </div>
    </AppLayout>
  );
}
