import { useState } from "react";
import { toast } from "react-toastify";
import { ApiRequestError } from "../services/api";
import { ImportarAnoBody, ImportarAnoResponse } from "../services/metasService";

export function ImportarMetasModal({
  setorId,
  anoAtual,
  anosDisponiveis,
  onImportar,
  onFechar,
}: {
  setorId: string;
  anoAtual: number;
  anosDisponiveis: number[];
  onImportar: (body: ImportarAnoBody) => Promise<ImportarAnoResponse | null>;
  onFechar: () => void;
}) {
  const [anoOrigem, setAnoOrigem] = useState(
    anosDisponiveis.find((a) => a !== anoAtual) ?? anosDisponiveis[0] ?? anoAtual - 1
  );
  const [copiarMetas, setCopiarMetas] = useState(true);
  const [copiarProdutos, setCopiarProdutos] = useState(false);
  const [ajustePercentual, setAjustePercentual] = useState(0);
  const [importando, setImportando] = useState(false);
  const [conflito, setConflito] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ImportarAnoResponse | null>(null);

  const executar = async (confirmarSobrescrever: boolean) => {
    if (anoOrigem === anoAtual) return toast.error("Ano de origem deve ser diferente do ano de destino");

    setImportando(true);
    setConflito(null);
    try {
      const resp = await onImportar({
        ano_origem: anoOrigem,
        ano_destino: anoAtual,
        copiar_metas: copiarMetas,
        copiar_produtos: copiarProdutos,
        setor_id: setorId,
        ajuste_percentual: ajustePercentual,
        confirmar_sobrescrever: confirmarSobrescrever,
      });
      if (resp) setResultado(resp);
    } catch (err) {
      if (err instanceof ApiRequestError && err.status === 409) {
        setConflito(err.message);
      } else {
        toast.error(err instanceof Error ? err.message : "Erro ao importar metas");
      }
    } finally {
      setImportando(false);
    }
  };

  if (resultado) {
    return (
      <div className="modal-overlay" onClick={onFechar}>
        <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
          <div className="card-title">Importação concluída</div>
          <div className="modal-form">
            <p>✅ {resultado.metas_importadas} indicador(es) importado(s)</p>
            <p>✅ {resultado.produtos_importados} produto(s) importado(s)</p>
            {resultado.avisos.length > 0 && (
              <div className="form-group form-group-full">
                <p>⚠️ Avisos:</p>
                <ul>
                  {resultado.avisos.map((aviso, i) => (
                    <li key={i}>{aviso}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="modal-footer">
            <button className="btn-primary" onClick={onFechar}>Ir para Metas</button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="card-title">Importar metas do ano anterior</div>

        <div className="modal-form">
          <label className="form-group">
            Ano origem
            <select className="form-input" value={anoOrigem} onChange={(e) => setAnoOrigem(Number(e.target.value))}>
              {anosDisponiveis.length === 0 && <option value={anoOrigem}>{anoOrigem}</option>}
              {anosDisponiveis.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </label>

          <label className="form-group">
            Ano destino
            <input className="form-input" value={anoAtual} disabled />
          </label>

          <label className="form-group form-group-full form-checkbox">
            <input type="checkbox" checked={copiarMetas} onChange={(e) => setCopiarMetas(e.target.checked)} />
            Copiar valores de meta
          </label>

          <label className="form-group form-group-full form-checkbox">
            <input type="checkbox" checked={copiarProdutos} onChange={(e) => setCopiarProdutos(e.target.checked)} />
            Copiar produtos
          </label>

          <label className="form-group form-group-full">
            Ajuste de % nas metas (ex: 10 = +10%, -10 = -10%)
            <input
              className="form-input"
              type="number"
              value={ajustePercentual}
              onChange={(e) => setAjustePercentual(Number(e.target.value))}
              disabled={!copiarMetas}
            />
          </label>

          {conflito && (
            <div className="form-group form-group-full" style={{ color: "#ef4444" }}>
              <p>{conflito}</p>
              <button className="btn-secondary" onClick={() => executar(true)} disabled={importando}>
                Sobrescrever indicadores existentes
              </button>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={() => executar(false)} disabled={importando}>
            {importando ? "Importando..." : "Importar"}
          </button>
        </div>
      </div>
    </div>
  );
}
