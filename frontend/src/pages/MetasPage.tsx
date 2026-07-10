import { useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { MetasTable } from "../components/MetasTable";
import { MetasDashboard } from "../components/MetasDashboard";
import { CriarMetaModal } from "../components/CriarMetaModal";
import { useAuth } from "../hooks/useAuth";
import { useMetas } from "../hooks/useMetas";

type Aba = "tabela" | "dashboard";

export function MetasPage() {
  const { usuario } = useAuth();
  const isGerente = usuario?.role === "admin" || usuario?.role === "gerente";

  const [ano, setAno] = useState(new Date().getFullYear());
  const [setorId, setSetorId] = useState<string | undefined>(
    usuario?.role === "responsavel" ? usuario.setor_id ?? undefined : undefined
  );
  const [aba, setAba] = useState<Aba>("tabela");
  const [modalAberto, setModalAberto] = useState(false);

  const { metas, setores, loading, recarregar, salvarMeta, salvarReal, criar, deletar } = useMetas({ ano, setor_id: setorId });

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
      {isGerente && (
        <label>
          Setor
          <select value={setorId ?? ""} onChange={(e) => setSetorId(e.target.value || undefined)}>
            <option value="">Selecione...</option>
            {setores.map((s) => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </label>
      )}
      <div className="tabs">
        <button className={aba === "tabela" ? "active" : ""} onClick={() => setAba("tabela")}>Tabela</button>
        <button className={aba === "dashboard" ? "active" : ""} onClick={() => setAba("dashboard")}>Dashboard</button>
      </div>
    </div>
  );

  return (
    <AppLayout titulo={`Metas > ${ano}`} filtros={filtros}>
      <div className="metas-toolbar">
        <button className="btn-secondary" onClick={recarregar}>Atualizar</button>
        {isGerente && (
          <button className="btn-primary" onClick={() => setModalAberto(true)}>+ Novo indicador</button>
        )}
      </div>

      {loading && <p>Carregando...</p>}
      {!loading && !setorId && <p>Selecione um setor para visualizar as metas.</p>}
      {!loading && setorId && usuario && aba === "tabela" && (
        <MetasTable
          metas={metas}
          usuarioRole={usuario.role}
          usuarioSetorId={usuario.setor_id}
          onSalvarMeta={(id, body) => (body.meta ? salvarMeta(id, body) : Promise.resolve())}
          onSalvarReal={salvarReal}
          onDeletar={deletar}
        />
      )}
      {!loading && setorId && aba === "dashboard" && <MetasDashboard metas={metas} ano={ano} />}

      {modalAberto && (
        <CriarMetaModal
          setores={setores}
          setorIdInicial={setorId}
          metasExistentes={metas}
          ano={ano}
          onSalvar={async (body) => {
            await criar(body);
            setModalAberto(false);
          }}
          onFechar={() => setModalAberto(false)}
        />
      )}
    </AppLayout>
  );
}
