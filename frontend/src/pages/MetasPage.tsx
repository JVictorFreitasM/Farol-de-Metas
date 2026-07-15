import { useEffect, useState } from "react";
import { AppLayout } from "../components/AppLayout";
import { MetasMonthCards } from "../components/MetasMonthCards";
import { MetasIndicadoresCards } from "../components/MetasIndicadoresCards";
import { MetasDashboard } from "../components/MetasDashboard";
import { CriarMetaModal } from "../components/CriarMetaModal";
import { useAuth } from "../hooks/useAuth";
import { useMetas } from "../hooks/useMetas";
import { gerarOpcoesAno, useAnoSelecionado } from "../hooks/useAnoSelecionado";
import { useSetorSelecionado } from "../hooks/useSetorSelecionado";
import { AcumuladoPeriodoResponse, obterAcumuladoPeriodo } from "../services/metasService";
import { MESES, MESES_LABEL, Mes } from "../types";

type Aba = "tabela" | "dashboard";

export function MetasPage() {
  const { usuario } = useAuth();
  const isGerente = usuario?.role === "admin" || usuario?.role === "gerente";
  const podeCriar = usuario?.role === "gerente";

  const [ano, setAno] = useAnoSelecionado();
  const [setorId, setSetorId] = useSetorSelecionado();
  const [aba, setAba] = useState<Aba>("tabela");
  const [modalAberto, setModalAberto] = useState(false);
  const [mesSelecionado, setMesSelecionado] = useState<Mes>(() => MESES[new Date().getMonth()]);
  const [mesEscolhidoManualmente, setMesEscolhidoManualmente] = useState(false);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [periodoInicio, setPeriodoInicio] = useState<Mes | "">("");
  const [periodoFim, setPeriodoFim] = useState<Mes | "">("");
  const [acumuladosPeriodo, setAcumuladosPeriodo] = useState<Record<string, AcumuladoPeriodoResponse>>({});

  const { metas, setores, loading, recarregar, salvarReal, salvarMetaManual, criar, deletar, inativar, ativar } = useMetas({
    ano,
    setor_id: setorId,
    incluir_inativos: mostrarInativos,
  });

  useEffect(() => {
    if (!periodoInicio || !periodoFim || metas.length === 0) {
      setAcumuladosPeriodo({});
      return;
    }
    let ativo = true;
    Promise.all(
      metas.map((m) =>
        obterAcumuladoPeriodo(m.id, periodoInicio, periodoFim)
          .then((r) => [m.id, r] as const)
          .catch(() => null)
      )
    ).then((resultados) => {
      if (!ativo) return;
      const mapa: Record<string, AcumuladoPeriodoResponse> = {};
      for (const item of resultados) {
        if (item) mapa[item[0]] = item[1];
      }
      setAcumuladosPeriodo(mapa);
    });
    return () => {
      ativo = false;
    };
  }, [periodoInicio, periodoFim, metas]);

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
      {isGerente && (
        <label className="form-checkbox">
          <input type="checkbox" checked={mostrarInativos} onChange={(e) => setMostrarInativos(e.target.checked)} />
          Mostrar inativos
        </label>
      )}
      <label>
        Período de
        <select value={periodoInicio} onChange={(e) => setPeriodoInicio((e.target.value || "") as Mes | "")}>
          <option value="">Anual</option>
          {MESES.map((opcao) => (
            <option key={opcao} value={opcao}>{MESES_LABEL[opcao]}</option>
          ))}
        </select>
      </label>
      <label>
        até
        <select value={periodoFim} onChange={(e) => setPeriodoFim((e.target.value || "") as Mes | "")}>
          <option value="">Anual</option>
          {MESES.map((opcao) => (
            <option key={opcao} value={opcao}>{MESES_LABEL[opcao]}</option>
          ))}
        </select>
      </label>
      <div className="tabs">
        <button className={aba === "tabela" ? "active" : ""} onClick={() => setAba("tabela")}>Tabela</button>
        <button className={aba === "dashboard" ? "active" : ""} onClick={() => setAba("dashboard")}>Dashboard</button>
      </div>
    </div>
  );

  const toolbar = (
    <div className="metas-toolbar">
      {podeCriar ? (
        <button className="btn-primary" onClick={() => setModalAberto(true)}>+ Novo indicador</button>
      ) : usuario?.role === "admin" ? (
        <span className="texto-informativo">Apenas gerentes podem criar indicadores.</span>
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
            acumuladosPeriodo={periodoInicio && periodoFim ? acumuladosPeriodo : undefined}
            onSalvarReal={salvarReal}
            onSalvarMetaManual={salvarMetaManual}
            onDeletar={deletar}
            onInativar={inativar}
            onAtivar={ativar}
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
