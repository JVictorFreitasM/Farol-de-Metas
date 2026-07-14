import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { MetasMonthCards } from "../components/MetasMonthCards";
import { MetasIndicadoresCards } from "../components/MetasIndicadoresCards";
import { MetasDashboard } from "../components/MetasDashboard";
import { CriarMetaModal } from "../components/CriarMetaModal";
import { useAuth } from "../hooks/useAuth";
import { useMetas } from "../hooks/useMetas";
import { gerarOpcoesAno, useAnoSelecionado } from "../hooks/useAnoSelecionado";
import { MESES, MESES_LABEL, Mes } from "../types";

type Aba = "tabela" | "dashboard";

export function MetasPage() {
  const { usuario } = useAuth();
  const isGerente = usuario?.role === "admin" || usuario?.role === "gerente";

  const [ano, setAno] = useAnoSelecionado();
  const [setorId, setSetorId] = useState<string | undefined>(
    usuario?.role === "responsavel" ? usuario.setor_id ?? undefined : undefined
  );
  const [aba, setAba] = useState<Aba>("tabela");
  const [modalAberto, setModalAberto] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState<Mes>(() => MESES[new Date().getMonth()]);
  const [mesEscolhidoManualmente, setMesEscolhidoManualmente] = useState(false);

  const { metas, setores, loading, recarregar, salvarReal, criar, deletar } = useMetas({ ano, setor_id: setorId });

  useEffect(() => {
    if (mesEscolhidoManualmente || metas.length === 0) return;
    const ics = metas.filter((m) => m.ic_iv === "IC");
    for (let i = MESES.length - 1; i >= 0; i--) {
      if (ics.some((m) => m.meses[MESES[i]].real !== null)) {
        setMesSelecionado(MESES[i]);
        return;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [metas]);

  const filtros = (
    <div className="filtros">
      <label>
        Ano
        <select value={ano} onChange={(e) => setAno(Number(e.target.value))}>
          {gerarOpcoesAno().map((opcao) => (
            <option key={opcao} value={opcao}>{opcao}</option>
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

  const toolbar = (
    <div className="metas-toolbar">
      {isGerente ? (
        <button className="btn-primary" onClick={() => setModalAberto(true)}>+ Novo indicador</button>
      ) : (
        <span />
      )}
      <button className="btn-secondary" onClick={recarregar}>↻ Atualizar</button>
    </div>
  );

  return (
    <AppLayout titulo={`Metas > ${ano}`} filtros={filtros}>
      {loading && <p>Carregando...</p>}
      {!loading && !setorId && <p>Selecione um setor para visualizar as metas.</p>}
      {!loading && setorId && usuario && aba === "tabela" && (
        <>
          <MetasMonthCards
            metas={metas}
            mesSelecionado={mesSelecionado}
            onMesSelecionado={(mes) => {
              setMesEscolhidoManualmente(true);
              setMesSelecionado(mes);
            }}
          />
          {toolbar}
          <h3 style={{ margin: "8px 0 16px" }}>Indicadores — {MESES_LABEL[mesSelecionado]}</h3>
          <MetasIndicadoresCards
            metas={metas}
            mes={mesSelecionado}
            usuarioRole={usuario.role}
            usuarioSetorId={usuario.setor_id}
            onSalvarReal={salvarReal}
            onDeletar={deletar}
          />
        </>
      )}
      {!loading && setorId && aba === "dashboard" && (
        <>
          {toolbar}
          <MetasDashboard metas={metas} ano={ano} />
        </>
      )}

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
