import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AppLayout } from "../components/AppLayout";
import { AuditoriaLog } from "../components/AuditoriaLog";
import { useAuth } from "../hooks/useAuth";
import { listarAuditoria } from "../services/auditoriaService";
import { AcaoAuditoria, AuditoriaRegistro } from "../types";

export function AuditoriaPage() {
  const { usuario } = useAuth();
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [acao, setAcao] = useState<AcaoAuditoria | "">("");
  const [registros, setRegistros] = useState<AuditoriaRegistro[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    listarAuditoria({
      setor_id: usuario?.role === "responsavel" ? usuario.setor_id ?? undefined : undefined,
      data_inicio: dataInicio || undefined,
      data_fim: dataFim || undefined,
      acao: acao || undefined,
      limite: 50,
    })
      .then((r) => setRegistros(r.data))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  }, [dataInicio, dataFim, acao, usuario]);

  const filtros = (
    <div className="filtros">
      <label>
        Data Início
        <input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
      </label>
      <label>
        Data Fim
        <input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
      </label>
      <label>
        Ação
        <select value={acao} onChange={(e) => setAcao(e.target.value as AcaoAuditoria | "")}>
          <option value="">Todos</option>
          <option value="CREATE">CREATE</option>
          <option value="READ">READ</option>
          <option value="UPDATE">UPDATE</option>
          <option value="DELETE">DELETE</option>
        </select>
      </label>
    </div>
  );

  return (
    <AppLayout titulo="Auditoria" filtros={filtros}>
      {loading ? <p>Carregando...</p> : <AuditoriaLog registros={registros} />}
    </AppLayout>
  );
}
