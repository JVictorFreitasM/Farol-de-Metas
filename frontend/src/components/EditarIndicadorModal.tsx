import { useState } from "react";
import { toast } from "react-toastify";
import { EditarIndicadorBody } from "../services/indicadoresService";
import { useProdutos } from "../hooks/useProdutos";
import { useIndicadores } from "../hooks/useIndicadores";
import { Indicador, TipoAgregacaoMeta, TipoAgregacaoReal } from "../types";

const UNIDADES = ["%", "R$", "UN", "Tons", "nº", "D", "DD", "H", "Q", "CDI"];

/** Edição do Indicador em si (nome/unidade/produto/regras de agregação) — diferente de
 * CriarMetaModal, que cria Indicador + Meta juntos. Aqui só existe PATCH /indicadores/:id;
 * ic_iv e pai_id não são editáveis (estruturais, o backend não aceita mudá-los). */
export function EditarIndicadorModal({
  indicador,
  onSalvar,
  onFechar,
}: {
  indicador: Indicador;
  onSalvar: (id: string, body: EditarIndicadorBody) => Promise<void>;
  onFechar: () => void;
}) {
  const [nome, setNome] = useState(indicador.nome);
  const [unidade, setUnidade] = useState(indicador.unidade);
  const [produtoId, setProdutoId] = useState(indicador.produto_id ?? "");
  const [agregaIvs, setAgregaIvs] = useState(indicador.agrega_ivs);
  const [tipoAcumuladoMeta, setTipoAcumuladoMeta] = useState(indicador.tipo_acumulado_meta);
  const [tipoAcumuladoReal, setTipoAcumuladoReal] = useState(indicador.tipo_acumulado_real);
  const [tipoAgregacaoMeta, setTipoAgregacaoMeta] = useState(indicador.tipo_agregacao_meta);
  const [tipoAgregacaoReal, setTipoAgregacaoReal] = useState(indicador.tipo_agregacao_real);
  const [realManualAcum, setRealManualAcum] = useState(
    indicador.real_manual_acum != null ? String(indicador.real_manual_acum) : ""
  );
  const [salvando, setSalvando] = useState(false);

  const { produtos } = useProdutos({ setor_id: indicador.setor_id, status: "ativo" });
  const { indicadores } = useIndicadores({ setor_id: indicador.setor_id, incluir_inativos: true });
  const ehIc = indicador.ic_iv === "IC";

  // OS-019: aviso não-bloqueante, mesma comparação (case-insensitive + trim) do backend —
  // exclui o próprio indicador (editar sem trocar o nome não deve disparar o aviso).
  const nomeNormalizado = nome.trim().toLowerCase();
  const nomeDuplicado =
    nomeNormalizado.length > 0 &&
    indicadores.some((i) => i.id !== indicador.id && i.nome.trim().toLowerCase() === nomeNormalizado);

  const handleSalvar = async () => {
    if (!nome.trim()) return toast.error("Informe o nome do indicador");
    if (ehIc && agregaIvs && tipoAgregacaoReal === "real_manual" && !realManualAcum) {
      return toast.error("Informe o valor fixo do Real (real_manual_acum)");
    }

    setSalvando(true);
    try {
      await onSalvar(indicador.id, {
        nome: nome.trim(),
        unidade,
        produto_id: ehIc ? produtoId || null : undefined,
        agrega_ivs: ehIc ? agregaIvs : undefined,
        tipo_acumulado_meta: tipoAcumuladoMeta,
        tipo_acumulado_real: tipoAcumuladoReal,
        tipo_agregacao_meta: ehIc && agregaIvs ? tipoAgregacaoMeta : undefined,
        tipo_agregacao_real: ehIc && agregaIvs ? tipoAgregacaoReal : undefined,
        real_manual_acum: ehIc && agregaIvs && tipoAgregacaoReal === "real_manual" ? Number(realManualAcum) : undefined,
      });
      onFechar();
    } catch {
      // erro já vira toast dentro de onSalvar (useIndicadores.editar) — só mantém o modal aberto
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="card-title">
          Editar indicador <span className={`badge-ic-iv ${ehIc ? "badge-ic" : "badge-iv"}`}>{indicador.ic_iv}</span>
        </div>

        <div className="modal-form">
          <label className="form-group">
            Indicador
            <input className="form-input" value={nome} onChange={(e) => setNome(e.target.value)} />
            {nomeDuplicado && (
              <span style={{ color: "var(--warning)", fontSize: "0.85em" }}>
                Já existe um indicador com esse nome neste setor.
              </span>
            )}
          </label>

          <label className="form-group">
            Unidade
            <select className="form-input" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>

          {ehIc && (
            <label className="form-group">
              Produto (opcional)
              <select className="form-input" value={produtoId} onChange={(e) => setProdutoId(e.target.value)}>
                <option value="">Sem produto</option>
                {produtos.map((p) => (
                  <option key={p.id} value={p.id}>{p.nome}</option>
                ))}
              </select>
            </label>
          )}

          <label className="form-group">
            Tipo de acumulado (Meta)
            <select
              className="form-input"
              value={tipoAcumuladoMeta}
              onChange={(e) => setTipoAcumuladoMeta(e.target.value as "soma" | "media" | "manual")}
            >
              <option value="soma">Soma</option>
              <option value="media">Média</option>
              <option value="manual">Manual (valor fixo)</option>
            </select>
          </label>

          <label className="form-group">
            Tipo de acumulado (Real)
            <select
              className="form-input"
              value={tipoAcumuladoReal}
              onChange={(e) => setTipoAcumuladoReal(e.target.value as "soma" | "media" | "manual")}
            >
              <option value="soma">Soma</option>
              <option value="media">Média</option>
              <option value="manual">Manual (valor fixo)</option>
            </select>
          </label>

          {ehIc && (
            <label className="form-group form-checkbox">
              <input type="checkbox" checked={agregaIvs} onChange={(e) => setAgregaIvs(e.target.checked)} />
              Agrega valores dos IVs automaticamente
            </label>
          )}

          {ehIc && agregaIvs && (
            <>
              <label className="form-group">
                Agregação da Meta
                <select
                  className="form-input"
                  value={tipoAgregacaoMeta}
                  onChange={(e) => setTipoAgregacaoMeta(e.target.value as TipoAgregacaoMeta)}
                >
                  <option value="soma">Soma dos IVs</option>
                  <option value="media">Média dos IVs</option>
                  <option value="meta_manual">Manual (Meta digitada direto)</option>
                </select>
              </label>

              <label className="form-group">
                Agregação do Real
                <select
                  className="form-input"
                  value={tipoAgregacaoReal}
                  onChange={(e) => setTipoAgregacaoReal(e.target.value as TipoAgregacaoReal)}
                >
                  <option value="soma">Soma dos IVs</option>
                  <option value="media">Média dos IVs</option>
                  <option value="proporcao_agregada">Proporção agregada (soma reais / soma metas)</option>
                  <option value="real_manual">Manual (valor fixo)</option>
                </select>
              </label>

              {tipoAgregacaoReal === "real_manual" && (
                <label className="form-group">
                  Real Manual (valor fixo)
                  <input
                    className="form-input"
                    type="number"
                    value={realManualAcum}
                    onChange={(e) => setRealManualAcum(e.target.value)}
                  />
                </label>
              )}
            </>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
    </div>
  );
}
