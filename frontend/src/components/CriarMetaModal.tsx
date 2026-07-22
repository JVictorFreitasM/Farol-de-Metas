import { useState } from "react";
import { toast } from "react-toastify";
import { CriarMetaBody } from "../services/metasService";
import { criarIndicador } from "../services/indicadoresService";
import { useProdutos } from "../hooks/useProdutos";
import { useIndicadores } from "../hooks/useIndicadores";
import { IcIv, Setor, TipoAgregacaoMeta, TipoAgregacaoReal, TipoMeta } from "../types";

const UNIDADES = ["%", "R$", "UN", "Tons", "nº", "D", "DD", "H", "Q", "CDI"];

export function CriarMetaModal({
  setores,
  setorIdInicial,
  ano,
  onSalvar,
  onFechar,
}: {
  setores: Setor[];
  setorIdInicial?: string;
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
  const [agregaIvs, setAgregaIvs] = useState(false);
  const [tipoAcumulado, setTipoAcumulado] = useState<"soma" | "media">("soma");
  const [tipoAgregacaoMeta, setTipoAgregacaoMeta] = useState<TipoAgregacaoMeta>("soma");
  const [tipoAgregacaoReal, setTipoAgregacaoReal] = useState<TipoAgregacaoReal>("soma");
  const [metaManualAcum, setMetaManualAcum] = useState("");
  const [metaAno, setMetaAno] = useState("");
  const [produtoId, setProdutoId] = useState("");
  const [salvando, setSalvando] = useState(false);

  const { indicadores } = useIndicadores({ setor_id: setorId });
  const icsDoSetor = indicadores.filter((i) => i.ic_iv === "IC" && i.ativo);
  const { produtos } = useProdutos({ setor_id: setorId, status: "ativo" });

  const handleSalvar = async () => {
    if (!setorId) return toast.error("Selecione um setor");
    if (!indicador.trim()) return toast.error("Informe o indicador");
    if (!responsavel.trim()) return toast.error("Informe o responsável");
    if (icIv === "IV" && !paiId) return toast.error("IVs precisam de um IC pai");
    if (icIv === "IC" && agregaIvs && tipoAgregacaoMeta === "meta_manual" && !metaManualAcum) {
      return toast.error("Informe o valor da meta manual");
    }

    setSalvando(true);
    try {
      // OS-013: indicador (nome/hierarquia/unidade/agregação) e meta (valores do ano) são
      // entidades separadas agora — criamos o indicador primeiro e referenciamos seu id na meta.
      const novoIndicador = await criarIndicador({
        setor_id: setorId,
        nome: indicador.trim(),
        ic_iv: icIv,
        unidade,
        pai_id: icIv === "IV" ? paiId : undefined,
        produto_id: icIv === "IC" && produtoId ? produtoId : undefined,
        agrega_ivs: icIv === "IC" ? agregaIvs : undefined,
        tipo_acumulado_meta: tipoAcumulado,
        tipo_acumulado_real: tipoAcumulado,
        tipo_agregacao_meta: icIv === "IC" && agregaIvs ? tipoAgregacaoMeta : undefined,
        tipo_agregacao_real: icIv === "IC" && agregaIvs ? tipoAgregacaoReal : undefined,
      });

      await onSalvar({
        indicador_id: novoIndicador.id,
        ano,
        responsavel: responsavel.trim(),
        tipo_meta: tipoMeta,
        meta_manual_acum:
          icIv === "IC" && agregaIvs && tipoAgregacaoMeta === "meta_manual" ? Number(metaManualAcum) : undefined,
        meta_ano: metaAno ? Number(metaAno) : undefined,
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
                  <option key={ic.id} value={ic.id}>{ic.nome}</option>
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
              <input type="checkbox" checked={agregaIvs} onChange={(e) => setAgregaIvs(e.target.checked)} />
              Agrega valores dos IVs automaticamente
            </label>
          )}

          {icIv === "IC" && agregaIvs && (
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
                  <option value="meta_manual">Manual (valor fixo)</option>
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
                </select>
              </label>

              {tipoAgregacaoMeta === "meta_manual" && (
                <label className="form-group">
                  Meta Manual (valor fixo)
                  <input
                    className="form-input"
                    type="number"
                    value={metaManualAcum}
                    onChange={(e) => setMetaManualAcum(e.target.value)}
                  />
                </label>
              )}
            </>
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
