import { useState } from "react";
import { toast } from "react-toastify";
import { CriarMetaBody } from "../services/metasService";
import { criarIndicador, deletarIndicador } from "../services/indicadoresService";
import { useProdutos } from "../hooks/useProdutos";
import { useIndicadores } from "../hooks/useIndicadores";
import { gerarOpcoesAno } from "../hooks/useAnoSelecionado";
import { IcIv, Setor, TipoAgregacaoMeta, TipoAgregacaoReal, TipoMeta } from "../types";

const UNIDADES = ["%", "R$", "UN", "Tons", "nº", "D", "DD", "H", "Q", "CDI"];

export function CriarMetaModal({
  setores,
  setorIdInicial,
  anoInicial,
  onSalvar,
  onFechar,
}: {
  setores: Setor[];
  setorIdInicial?: string;
  anoInicial: number;
  onSalvar: (body: CriarMetaBody) => Promise<void>;
  onFechar: () => void;
}) {
  const [setorId, setSetorId] = useState(setorIdInicial ?? "");
  const [ano, setAno] = useState(anoInicial);
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

  // incluir_inativos: true pra bater com a checagem do backend, que não distingue ativo/inativo
  // ao rejeitar nome duplicado — um indicador inativo com o mesmo nome também bloqueia a criação.
  const { indicadores } = useIndicadores({ setor_id: setorId, incluir_inativos: true });
  const icsDoSetor = indicadores.filter((i) => i.ic_iv === "IC" && i.ativo);
  const { produtos } = useProdutos({ setor_id: setorId, status: "ativo" });

  // OS-019: aviso não-bloqueante de nome duplicado, mesma comparação (case-insensitive + trim)
  // que o backend usa como fonte de verdade — só antecipa o feedback, não substitui a validação.
  const nomeNormalizado = indicador.trim().toLowerCase();
  const nomeDuplicado = nomeNormalizado.length > 0 && indicadores.some((i) => i.nome.trim().toLowerCase() === nomeNormalizado);

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
      // OS-019: catch próprio aqui — sem ele, um erro na criação do indicador (ex: nome
      // duplicado) subia sem toast nenhum, só um unhandled rejection no console.
      let novoIndicador;
      try {
        novoIndicador = await criarIndicador({
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
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Erro ao criar o indicador");
        return;
      }

      try {
        await onSalvar({
          indicador_id: novoIndicador.id,
          ano,
          responsavel: responsavel.trim(),
          tipo_meta: tipoMeta,
          meta_manual_acum:
            icIv === "IC" && agregaIvs && tipoAgregacaoMeta === "meta_manual" ? Number(metaManualAcum) : undefined,
          meta_ano: metaAno ? Number(metaAno) : undefined,
        });
      } catch (err) {
        // O indicador já foi criado, mas a meta falhou — sem isso, ele fica órfão (sem meta em
        // nenhum ano) e invisível na tela, já que a listagem é alimentada pelas Metas, não pelos
        // Indicadores diretamente. Desfaz o indicador para não deixar esse fantasma no banco.
        await deletarIndicador(novoIndicador.id).catch(() => {});
        toast.error(
          err instanceof Error
            ? `Indicador não foi salvo: ${err.message}`
            : "Indicador não foi salvo: erro ao criar a meta"
        );
        return;
      }
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
            Ano
            <select className="form-input" value={ano} onChange={(e) => setAno(Number(e.target.value))}>
              {gerarOpcoesAno().map((a) => (
                <option key={a} value={a}>{a}</option>
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
            {nomeDuplicado && (
              <span style={{ color: "var(--warning)", fontSize: "0.85em" }}>
                Já existe um indicador com esse nome neste setor.
              </span>
            )}
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
