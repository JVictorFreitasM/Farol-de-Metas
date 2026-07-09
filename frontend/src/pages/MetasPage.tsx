import { useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { MetasTable } from "../components/MetasTable";
import { useAuth } from "../hooks/useAuth";
import { useMetas } from "../hooks/useMetas";

export function MetasPage() {
  const { usuario } = useAuth();
  const [ano, setAno] = useState(new Date().getFullYear());
  const [setorId, setSetorId] = useState<string | undefined>(usuario?.role === "responsavel" ? usuario.setor_id ?? undefined : undefined);
  const [busca, setBusca] = useState("");

  const { metas, loading, editar } = useMetas({ ano, setor_id: setorId, indicador: busca || undefined, limite: 100 });

  const filtros = (
    <div className="filtros">
      <label>
        Ano
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {[ano - 1, ano, ano + 1].map((a) => (
            <option key={a} value={a}>{a}</option>
          ))}
        </select>
      </label>
      {usuario?.role !== "responsavel" && (
        <label>
          Setor (UUID)
          <input value={setorId ?? ""} onChange={(e) => setSetorId(e.target.value || undefined)} placeholder="setor_id" />
        </label>
      )}
      <label>
        Pesquisa
        <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="indicador..." />
      </label>
    </div>
  );

  return (
    <AppLayout titulo={`Metas > ${ano}`} filtros={filtros}>
      {loading ? <p>Carregando...</p> : <MetasTable metas={metas} onEditar={editar} />}
    </AppLayout>
  );
}
