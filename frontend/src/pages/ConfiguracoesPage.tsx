import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { AppLayout } from "../components/AppLayout";
import { useAuth } from "../hooks/useAuth";
import { listarSetores } from "../services/metasService";
import {
  criarDesbloqueio,
  editarConfiguracao,
  listarDesbloqueios,
  obterConfiguracao,
  removerDesbloqueio,
} from "../services/configuracoesService";
import { DesbloqueioPreenchimento, MESES, MESES_LABEL, Setor } from "../types";

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

      {usuario?.role === "admin" && <FechamentoMensalConfig />}
    </AppLayout>
  );
}

// OS-016: dia-limite de preenchimento (global) + desbloqueios pontuais por setor/mês/ano.
function FechamentoMensalConfig() {
  const [setores, setSetores] = useState<Setor[]>([]);

  const [diaLimite, setDiaLimite] = useState("");
  const [carregandoConfig, setCarregandoConfig] = useState(true);
  const [salvandoDia, setSalvandoDia] = useState(false);

  const [desbloqueios, setDesbloqueios] = useState<DesbloqueioPreenchimento[]>([]);
  const [carregandoDesbloqueios, setCarregandoDesbloqueios] = useState(true);
  const [filtroSetorId, setFiltroSetorId] = useState("");
  const [filtroAno, setFiltroAno] = useState("");

  const [novoSetorId, setNovoSetorId] = useState("");
  const [novoAno, setNovoAno] = useState(String(new Date().getFullYear()));
  const [novoMes, setNovoMes] = useState("1");
  const [liberando, setLiberando] = useState(false);

  useEffect(() => {
    listarSetores().then(setSetores);
  }, []);

  useEffect(() => {
    setCarregandoConfig(true);
    obterConfiguracao()
      .then((config) => setDiaLimite(String(config.dia_limite_preenchimento)))
      .catch((err) => toast.error(err instanceof Error ? err.message : "Erro ao carregar configuração"))
      .finally(() => setCarregandoConfig(false));
  }, []);

  const carregarDesbloqueios = async () => {
    setCarregandoDesbloqueios(true);
    try {
      const resp = await listarDesbloqueios({
        setor_id: filtroSetorId || undefined,
        ano: filtroAno ? Number(filtroAno) : undefined,
      });
      setDesbloqueios(resp.data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao carregar desbloqueios");
    } finally {
      setCarregandoDesbloqueios(false);
    }
  };

  useEffect(() => {
    carregarDesbloqueios();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtroSetorId, filtroAno]);

  const salvarDiaLimite = async () => {
    const numero = parseInt(diaLimite, 10);
    if (!Number.isFinite(numero) || numero < 1 || numero > 28) {
      toast.error("Informe um dia entre 1 e 28");
      return;
    }
    setSalvandoDia(true);
    try {
      await editarConfiguracao(numero);
      toast.success("Dia-limite atualizado!");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao salvar configuração");
    } finally {
      setSalvandoDia(false);
    }
  };

  const liberar = async () => {
    if (!novoSetorId) return toast.error("Selecione um setor");
    if (!novoAno) return toast.error("Informe o ano");
    setLiberando(true);
    try {
      await criarDesbloqueio({ setor_id: novoSetorId, ano: Number(novoAno), mes: Number(novoMes) });
      toast.success("Setor/mês liberado!");
      await carregarDesbloqueios();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao liberar setor/mês");
    } finally {
      setLiberando(false);
    }
  };

  const remover = async (d: DesbloqueioPreenchimento) => {
    if (!confirm(`Voltar a travar ${MESES_LABEL[MESES[d.mes - 1]]}/${d.ano} para o setor "${d.setor}"?`)) return;
    try {
      await removerDesbloqueio(d.id);
      toast.success("Desbloqueio removido!");
      await carregarDesbloqueios();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao remover desbloqueio");
    }
  };

  return (
    <>
      <div className="card">
        <div className="card-title">Fechamento mensal de preenchimento</div>
        <p className="texto-informativo">
          Passado este dia do mês, o mês anterior (e todos os anteriores a ele) trava para
          responsável e gerente em Meta e Real. Administradores nunca são bloqueados.
        </p>

        {carregandoConfig ? (
          <p>Carregando...</p>
        ) : (
          <div className="modal-form">
            <label className="form-group">
              Dia-limite de preenchimento
              <input
                className="form-input"
                type="number"
                min={1}
                max={28}
                value={diaLimite}
                onChange={(e) => setDiaLimite(e.target.value)}
              />
            </label>
          </div>
        )}
        <div className="metas-toolbar">
          <button className="btn-primary" onClick={salvarDiaLimite} disabled={salvandoDia || carregandoConfig}>
            {salvandoDia ? "Salvando..." : "Salvar"}
          </button>
          <span />
        </div>
      </div>

      <div className="card">
        <div className="card-title">Desbloqueios de preenchimento</div>
        <p className="texto-informativo">
          Libera um setor específico para editar Meta/Real de um mês/ano já fechado, sem afetar
          os demais meses ou setores.
        </p>

        <div className="modal-form">
          <label className="form-group">
            Setor
            <select className="form-input" value={novoSetorId} onChange={(e) => setNovoSetorId(e.target.value)}>
              <option value="">Selecione...</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </label>
          <label className="form-group">
            Ano
            <input className="form-input" type="number" value={novoAno} onChange={(e) => setNovoAno(e.target.value)} />
          </label>
          <label className="form-group">
            Mês
            <select className="form-input" value={novoMes} onChange={(e) => setNovoMes(e.target.value)}>
              {MESES.map((mes, idx) => (
                <option key={mes} value={idx + 1}>{MESES_LABEL[mes]}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="metas-toolbar">
          <button className="btn-primary" onClick={liberar} disabled={liberando}>
            {liberando ? "Liberando..." : "+ Liberar setor/mês"}
          </button>
          <span />
        </div>

        <div className="filtros">
          <label>
            Filtrar por setor
            <select value={filtroSetorId} onChange={(e) => setFiltroSetorId(e.target.value)}>
              <option value="">Todos</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </label>
          <label>
            Filtrar por ano
            <input type="number" value={filtroAno} onChange={(e) => setFiltroAno(e.target.value)} placeholder="Todos" />
          </label>
        </div>

        {carregandoDesbloqueios ? (
          <p>Carregando...</p>
        ) : (
          <table className="auditoria-table">
            <thead>
              <tr>
                <th>Setor</th>
                <th>Mês</th>
                <th>Ano</th>
                <th>Liberado em</th>
                <th>Ações</th>
              </tr>
            </thead>
            <tbody>
              {desbloqueios.length === 0 && (
                <tr>
                  <td colSpan={5}>Nenhum desbloqueio ativo.</td>
                </tr>
              )}
              {desbloqueios.map((d) => (
                <tr key={d.id}>
                  <td>{d.setor}</td>
                  <td>{MESES_LABEL[MESES[d.mes - 1]]}</td>
                  <td>{d.ano}</td>
                  <td>{new Date(d.liberado_em).toLocaleString("pt-BR")}</td>
                  <td>
                    <button className="btn-secondary" onClick={() => remover(d)}>Remover</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
