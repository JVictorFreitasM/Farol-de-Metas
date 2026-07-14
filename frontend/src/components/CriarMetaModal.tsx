import { useState } from "react";
import { toast } from "react-toastify";
import { CriarMetaBody } from "../services/metasService";
import { useProdutos } from "../hooks/useProdutos";
import { IcIv, Meta, Setor, TipoMeta } from "../types";

const UNIDADES = ["%", "R$", "UN", "Tons", "nº", "D", "DD", "H", "Q", "CDI"];

export function CriarMetaModal({
  setores,
  setorIdInicial,
  metasExistentes,
  ano,
  onSalvar,
  onFechar,
}: {
  setores: Setor[];
  setorIdInicial?: string;
  metasExistentes: Meta[];
  ano: number;
  onSalvar: (body: CriarMetaBody) => Promise<void>;
  onFechar: () => void;
}) {
  const [setorId, setSetorId] = useState(setorIdInicial ?? "");
  const [icIv, setIcIv] = useState<IcIv>("IC");
  const [paiId, setPaiId] = useState("");
  const [indicador, setIndicador] = useState("");
  const [responsavel, setResponsavel] = useState("");
  const [unidade, setUnidade] = useState(UNIDADES[0]);
  const [tipoMeta, setTipoMeta] = useState<TipoMeta>("maior_melhor");
  const [agregaFilhos, setAgregaFilhos] = useState(false);
  const [tipoAcumulado, setTipoAcumulado] = useState<"soma" | "media">("soma");
  const [metaAno, setMetaAno] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [salvando, setSalvando] = useState(false);

  const icsDoSetor = metasExistentes.filter((m) => m.ic_iv === "IC" && m.ativo && (!setorId || m.setor_id === setorId));
  const { produtos } = useProdutos({ setor_id: setorId, status: "ativo" });

  const handleSalvar = async () => {
    if (!setorId) return toast.error("Selecione um setor");
    if (!indicador.trim()) return toast.error("Informe o indicador");
    if (!responsavel.trim()) return toast.error("Informe o responsável");
    if (icIv === "IV" && !paiId) return toast.error("IVs precisam de um IC pai");

    setSalvando(true);
    try {
      await onSalvar({
        setor_id: setorId,
        ano,
        ic_iv: icIv,
        pai_id: icIv === "IV" ? paiId : undefined,
        indicador: indicador.trim(),
        responsavel: responsavel.trim(),
        unidade,
        tipo_meta: tipoMeta,
        agrega_filhos: icIv === "IC" ? agregaFilhos : undefined,
        tipo_acumulado: tipoAcumulado,
        meta_ano: metaAno ? Number(metaAno) : undefined,
        produto_id: icIv === "IC" && produtoId ? produtoId : undefined,
      });
    } finally {
      setSalvando(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onFechar}>
      <div className="modal-content card" onClick={(e) => e.stopPropagation()}>
        <div className="card-title">Novo indicador</div>

        <div className="modal-form">
          <label className="form-group">
            Setor
            <select className="form-input" value={setorId} onChange={(e) => setSetorId(e.target.value)}>
              <option value="">Selecione...</option>
              {setores.map((s) => (
                <option key={s.id} value={s.id}>{s.nome}</option>
              ))}
            </select>
          </label>

          <label className="form-group">
            Tipo
            <select className="form-input" value={icIv} onChange={(e) => setIcIv(e.target.value as IcIv)}>
              <option value="IC">IC — Indicador de Controle</option>
              <option value="IV">IV — Indicador de Verificação</option>
            </select>
          </label>

          {icIv === "IV" && (
            <label className="form-group">
              IC Pai
              <select className="form-input" value={paiId} onChange={(e) => setPaiId(e.target.value)}>
                <option value="">Selecione...</option>
                {icsDoSetor.map((ic) => (
                  <option key={ic.id} value={ic.id}>{ic.indicador}</option>
                ))}
              </select>
            </label>
          )}

          {icIv === "IC" && (
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
            Indicador
            <input className="form-input" value={indicador} onChange={(e) => setIndicador(e.target.value)} />
          </label>

          <label className="form-group">
            Responsável
            <input className="form-input" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} />
          </label>

          <label className="form-group">
            Unidade
            <select className="form-input" value={unidade} onChange={(e) => setUnidade(e.target.value)}>
              {UNIDADES.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </label>

          <label className="form-group">
            Tipo de meta
            <select className="form-input" value={tipoMeta} onChange={(e) => setTipoMeta(e.target.value as TipoMeta)}>
              <option value="maior_melhor">Maior é melhor</option>
              <option value="menor_melhor">Menor é melhor</option>
            </select>
          </label>

          {icIv === "IC" && (
            <label className="form-group form-checkbox">
              <input type="checkbox" checked={agregaFilhos} onChange={(e) => setAgregaFilhos(e.target.checked)} />
              Agrega valores dos filhos automaticamente
            </label>
          )}

          <label className="form-group">
            Tipo de acumulado
            <select className="form-input" value={tipoAcumulado} onChange={(e) => setTipoAcumulado(e.target.value as "soma" | "media")}>
              <option value="soma">Soma</option>
              <option value="media">Média</option>
            </select>
          </label>

          <label className="form-group">
            Meta Ano
            <input className="form-input" type="number" value={metaAno} onChange={(e) => setMetaAno(e.target.value)} />
          </label>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onFechar}>Cancelar</button>
          <button className="btn-primary" onClick={handleSalvar} disabled={salvando}>
            {salvando ? "Salvando..." : "Criar indicador"}
          </button>
        </div>
      </div>
    </div>
  );
}
