import { useEffect, useState } from "react";
import { toast } from "react-toastify";
import { gerarOpcoesAno } from "../hooks/useAnoSelecionado";
import { exportarExcel } from "../services/relatoriosService";
import { obterAnosDisponiveis } from "../services/metasService";
import { Setor, Usuario } from "../types";

export function ExportarExcelModal({
  setores,
  usuario,
  anoInicial,
  onFechar,
}: {
  setores: Setor[];
  usuario: Usuario;
  anoInicial: number;
  onFechar: () => void;
}) {
  const ehResponsavel = usuario.role === "responsavel";
  // Responsável só exporta o próprio setor — lista fica restrita a ele, sem opção de escolha.
  const setoresDisponiveis = ehResponsavel ? setores.filter((s) => s.id === usuario.setor_id) : setores;

  const [ano, setAno] = useState(anoInicial);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set(setoresDisponiveis.map((s) => s.id)));
  const [gerando, setGerando] = useState(false);

  // O ano selecionado na tela de Relatórios (anoInicial) é o ano corrente por padrão, mas nem
  // sempre tem dados lançados ainda — troca automaticamente pro ano mais recente com dados
  // reais do setor, pra não gerar um Excel só com cabeçalho e nenhuma linha.
  useEffect(() => {
    const primeiroSetorId = setoresDisponiveis[0]?.id;
    if (!primeiroSetorId) return;
    obterAnosDisponiveis(primeiroSetorId)
      .then((anos) => {
        if (anos.length > 0 && !anos.includes(anoInicial)) {
          setAno(anos[0]);
          toast.info(`Ano ${anoInicial} não tem dados lançados — selecionado ${anos[0]}, que é o mais recente disponível.`);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const todosMarcados = setoresDisponiveis.length > 0 && selecionados.size === setoresDisponiveis.length;

  const alternar = (id: string) => {
    if (ehResponsavel) return;
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  };

  const alternarTodos = () => {
    setSelecionados(todosMarcados ? new Set() : new Set(setoresDisponiveis.map((s) => s.id)));
  };

  const gerar = async () => {
    if (selecionados.size === 0) return toast.error("Selecione ao menos um setor");
    setGerando(true);
    try {
      await exportarExcel(ano, [...selecionados]);
      toast.success("Relatório gerado!");
      onFechar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao gerar relatório");
    } finally {
      setGerando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="card-title">Exportar Excel</div>

        <div className="modal-form">
          <label className="form-group">
            Ano
            <select className="form-input" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {gerarOpcoesAno().map((opcao) => (
                <option key={opcao} value={opcao}>{opcao}</option>
              ))}
            </select>
          </label>
        </div>

        <div className="form-group form-group-full" style={{ marginTop: 12 }}>
          Setores
          {!ehResponsavel && (
            <label className="form-checkbox" style={{ marginTop: 6 }}>
              <input type="checkbox" checked={todosMarcados} onChange={alternarTodos} />
              Selecionar todos
            </label>
          )}
          <div style={{ maxHeight: 220, overflowY: "auto", marginTop: 6 }}>
            {setoresDisponiveis.map((s) => (
              <label key={s.id} className="form-checkbox" style={{ display: "flex" }}>
                <input
                  type="checkbox"
                  checked={selecionados.has(s.id)}
                  onChange={() => alternar(s.id)}
                  disabled={ehResponsavel}
                />
                {s.nome}
              </label>
            ))}
            {setoresDisponiveis.length === 0 && <p className="texto-informativo">Nenhum setor disponível.</p>}
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={gerar} disabled={gerando}>
            {gerando ? "Gerando..." : "Gerar relatório"}
          </button>
        </div>
      </div>
    </div>
  );
}
