import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { AcumuloEspecificoBody, obterAcumuladoPeriodo } from "../services/metasService";
import { formatValor } from "../lib/format";
import { Meta, MESES, MESES_LABEL, Mes } from "../types";

/** Só para percentuais já calculados (0-100), como "Atingimento" — nunca para meta/real bruto,
 * que precisa de formatValor(valor, unidade) para converter corretamente indicadores em "%". */
function formatPercentual(valor: string | number | null): string {
  if (valor === null || valor === undefined) return "-";
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 1 }) : "-";
}

function calcularPercentual(meta: Meta): string {
  const acumMeta = typeof meta.acum_meta === "string" ? parseFloat(meta.acum_meta) : meta.acum_meta;
  const acumReal = typeof meta.acum_real === "string" ? parseFloat(meta.acum_real) : meta.acum_real;
  if (!acumMeta) return "-";
  return `${(((acumReal ?? 0) / acumMeta) * 100).toFixed(1)}%`;
}

const FECHAR_DELAY_MS = 200;
const MARGEM = 8;

const LABEL_AGREGACAO_META: Record<Meta["tipo_agregacao_meta"], string> = {
  soma: "Soma dos IVs",
  media: "Média dos IVs",
  meta_manual: "Manual",
};
const LABEL_AGREGACAO_REAL: Record<Meta["tipo_agregacao_real"], string> = {
  soma: "Soma dos IVs",
  media: "Média dos IVs",
  proporcao_agregada: "Proporção agregada",
  real_manual: "Manual",
};
const LABEL_TIPO_ACUMULADO: Record<Meta["tipo_acumulado_meta"], string> = {
  soma: "Soma",
  media: "Média",
  manual: "Manual",
};

export function AcumuladoTooltip({
  meta,
  children,
  podeEditarMetaManual,
  onSalvarMetaManual,
  onSalvarAcumuloEspecifico,
}: {
  meta: Meta;
  children: ReactNode;
  podeEditarMetaManual?: boolean;
  onSalvarMetaManual?: (id: string, valor: number) => Promise<void>;
  onSalvarAcumuloEspecifico?: (id: string, body: AcumuloEspecificoBody) => Promise<void>;
}) {
  const [visivel, setVisivel] = useState(false);
  const [posicao, setPosicao] = useState({ top: 0, left: 0, direcao: "cima" as "cima" | "baixo" });
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [mesInicio, setMesInicio] = useState<Mes>("jan");
  const [mesFim, setMesFim] = useState<Mes>("dez");
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof obterAcumuladoPeriodo>> | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [editandoMetaManual, setEditandoMetaManual] = useState(false);
  const [valorMetaManual, setValorMetaManual] = useState("");

  // OS-018: "Acúmulo específico" — configuração persistida (por linha), diferente do
  // "Acumulado por período" acima, que é só uma consulta ad-hoc (não grava nada).
  const [acumuloAberto, setAcumuloAberto] = useState(false);
  const [acumuloAtivo, setAcumuloAtivo] = useState(meta.acumulo_especifico);
  const [acumMetaInicio, setAcumMetaInicio] = useState<Mes>(meta.acum_meta_mes_inicio ?? "jan");
  const [acumMetaFim, setAcumMetaFim] = useState<Mes>(meta.acum_meta_mes_fim ?? "dez");
  const [acumRealInicio, setAcumRealInicio] = useState<Mes>(meta.acum_real_mes_inicio ?? "jan");
  const [acumRealFim, setAcumRealFim] = useState<Mes>(meta.acum_real_mes_fim ?? "dez");
  const [salvandoAcumulo, setSalvandoAcumulo] = useState(false);

  const ehMetaManual = meta.agrega_ivs && meta.tipo_agregacao_meta === "meta_manual";
  // Mesmas incompatibilidades validadas no backend (ver resolverAcumuloEspecifico) — escondida
  // em vez de mostrada-e-rejeitada, já que a linha "Tipo Acum." acima já deixa essa config visível.
  const podeConfigurarAcumuloEspecifico =
    podeEditarMetaManual && !meta.agrega_ivs && meta.tipo_acumulado_meta !== "manual" && meta.tipo_acumulado_real !== "manual";

  const abrirAcumuloEspecifico = () => {
    setAcumuloAtivo(meta.acumulo_especifico);
    setAcumMetaInicio(meta.acum_meta_mes_inicio ?? "jan");
    setAcumMetaFim(meta.acum_meta_mes_fim ?? "dez");
    setAcumRealInicio(meta.acum_real_mes_inicio ?? "jan");
    setAcumRealFim(meta.acum_real_mes_fim ?? "dez");
    setAcumuloAberto(true);
  };

  const salvarAcumuloEspecifico = async () => {
    if (!onSalvarAcumuloEspecifico) return;

    if (acumuloAtivo) {
      if (MESES.indexOf(acumMetaFim) < MESES.indexOf(acumMetaInicio)) {
        toast.error("Meta: o mês final deve ser igual ou posterior ao mês inicial");
        return;
      }
      if (MESES.indexOf(acumRealFim) < MESES.indexOf(acumRealInicio)) {
        toast.error("Real: o mês final deve ser igual ou posterior ao mês inicial");
        return;
      }
    }

    setSalvandoAcumulo(true);
    try {
      await onSalvarAcumuloEspecifico(
        meta.id,
        acumuloAtivo
          ? {
              acumulo_especifico: true,
              acum_meta_mes_inicio: acumMetaInicio,
              acum_meta_mes_fim: acumMetaFim,
              acum_real_mes_inicio: acumRealInicio,
              acum_real_mes_fim: acumRealFim,
            }
          : { acumulo_especifico: false }
      );
      setAcumuloAberto(false);
    } catch {
      // erro já reportado via toast pelo hook chamador (useMetas.salvarAcumuloEspecifico)
    } finally {
      setSalvandoAcumulo(false);
    }
  };

  const iniciarEdicaoMetaManual = () => {
    if (!podeEditarMetaManual || !ehMetaManual) return;
    setValorMetaManual(meta.meta_manual_acum != null ? String(meta.meta_manual_acum) : "");
    setEditandoMetaManual(true);
  };

  const salvarMetaManual = async () => {
    const numero = parseFloat(valorMetaManual);
    setEditandoMetaManual(false);
    if (Number.isNaN(numero) || !onSalvarMetaManual) return;
    await onSalvarMetaManual(meta.id, numero);
  };
  const containerRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const fecharTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cancelarFechamento = () => {
    if (fecharTimer.current) {
      clearTimeout(fecharTimer.current);
      fecharTimer.current = null;
    }
  };

  const posicionar = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (rect) setPosicao((p) => ({ top: rect.top - MARGEM, left: rect.left, direcao: p.direcao }));
  };

  // Após cada render com o tooltip visível, mede a altura real e corrige a posição
  // caso o conteúdo (ex: seletor de período aberto) estoure o topo ou o rodapé da tela.
  useLayoutEffect(() => {
    if (!visivel) return;
    const triggerRect = containerRef.current?.getBoundingClientRect();
    const tooltipRect = tooltipRef.current?.getBoundingClientRect();
    if (!triggerRect || !tooltipRect) return;

    const alturaTooltip = tooltipRect.height;
    const cabeAcima = triggerRect.top - alturaTooltip - MARGEM >= 0;
    const direcaoDesejada: "cima" | "baixo" = cabeAcima ? "cima" : "baixo";

    const topDesejado = direcaoDesejada === "cima" ? triggerRect.top - MARGEM : triggerRect.bottom + MARGEM;

    setPosicao((p) => (p.direcao === direcaoDesejada && p.top === topDesejado ? p : { ...p, top: topDesejado, direcao: direcaoDesejada }));
  }, [visivel, periodoAberto, resultado]);

  const abrir = () => {
    cancelarFechamento();
    posicionar();
    setVisivel(true);
  };

  const agendarFechamento = () => {
    cancelarFechamento();
    fecharTimer.current = setTimeout(() => {
      setVisivel(false);
      setPeriodoAberto(false);
      setResultado(null);
    }, FECHAR_DELAY_MS);
  };

  const handleAplicarPeriodo = async () => {
    if (MESES.indexOf(mesInicio) > MESES.indexOf(mesFim)) {
      toast.error("Mês inicial deve ser anterior ou igual ao mês final");
      return;
    }
    setCarregando(true);
    try {
      const resp = await obterAcumuladoPeriodo(meta.id, mesInicio, mesFim);
      setResultado(resp);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro ao calcular acumulado do período");
    } finally {
      setCarregando(false);
    }
  };

  return (
    <span
      ref={containerRef}
      className="acumulado-tooltip-trigger"
      onMouseEnter={abrir}
      onMouseLeave={agendarFechamento}
      onClick={(e) => {
        e.stopPropagation();
        if (visivel) agendarFechamento();
        else abrir();
      }}
    >
      {children}

      {visivel && (
        <div
          ref={tooltipRef}
          className="acumulado-tooltip"
          style={{
            top: posicao.top,
            left: posicao.left,
            transform: posicao.direcao === "cima" ? "translateY(-100%)" : undefined,
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={cancelarFechamento}
          onMouseLeave={agendarFechamento}
        >
          <div className="acumulado-tooltip-header">{meta.indicador}</div>
          <div className="acumulado-tooltip-body">
            <div className="acumulado-tooltip-row">
              <span>Meta Anual</span>
              <span>{formatValor(meta.meta_ano, meta.unidade)}</span>
            </div>
            <div className="acumulado-tooltip-row">
              <span>Acum. Meta</span>
              {editandoMetaManual ? (
                <input
                  type="number"
                  autoFocus
                  className="acumulado-tooltip-input"
                  value={valorMetaManual}
                  onChange={(e) => setValorMetaManual(e.target.value)}
                  onBlur={salvarMetaManual}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") (e.target as HTMLInputElement).blur();
                    if (e.key === "Escape") setEditandoMetaManual(false);
                  }}
                />
              ) : (
                <span
                  className={podeEditarMetaManual && ehMetaManual ? "acumulado-tooltip-editavel" : undefined}
                  title={podeEditarMetaManual && ehMetaManual ? "Clique para editar a meta manual" : undefined}
                  onClick={iniciarEdicaoMetaManual}
                >
                  {formatValor(meta.acum_meta, meta.unidade)}
                </span>
              )}
            </div>
            <div className="acumulado-tooltip-row">
              <span>Acum. Real</span>
              <span>{formatValor(meta.acum_real, meta.unidade)}</span>
            </div>
            <div className="acumulado-tooltip-row">
              <span>Tipo Acum. (Meta)</span>
              <span>{LABEL_TIPO_ACUMULADO[meta.tipo_acumulado_meta]}</span>
            </div>
            <div className="acumulado-tooltip-row">
              <span>Tipo Acum. (Real)</span>
              <span>{LABEL_TIPO_ACUMULADO[meta.tipo_acumulado_real]}</span>
            </div>
            {meta.agrega_ivs && (
              <div className="acumulado-tooltip-row">
                <span>Agregação</span>
                <span>
                  {LABEL_AGREGACAO_META[meta.tipo_agregacao_meta]} / {LABEL_AGREGACAO_REAL[meta.tipo_agregacao_real]}
                </span>
              </div>
            )}
            <div className="acumulado-tooltip-divider" />
            <div className="acumulado-tooltip-row">
              <span>Atingimento</span>
              <span className={meta.status_acum ? `status-${meta.status_acum}` : undefined}>
                {calcularPercentual(meta)}
              </span>
            </div>
            <div className={`acumulado-tooltip-status ${meta.status_acum ?? "vazio"}`}>
              {meta.status_acum === "ok" ? "✓ OK" : meta.status_acum === "nok" ? "✗ Não atingido" : "Sem dados"}
            </div>

            <div className="acumulado-tooltip-divider" />

            {!periodoAberto ? (
              <button className="btn-link acumulado-tooltip-periodo-toggle" onClick={() => setPeriodoAberto(true)}>
                Acumulado por período...
              </button>
            ) : (
              <div className="acumulado-periodo">
                <div className="acumulado-periodo-selects">
                  <select value={mesInicio} onChange={(e) => setMesInicio(e.target.value as Mes)}>
                    {MESES.map((mes) => (
                      <option key={mes} value={mes}>{MESES_LABEL[mes]}</option>
                    ))}
                  </select>
                  <span>até</span>
                  <select value={mesFim} onChange={(e) => setMesFim(e.target.value as Mes)}>
                    {MESES.map((mes) => (
                      <option key={mes} value={mes}>{MESES_LABEL[mes]}</option>
                    ))}
                  </select>
                </div>
                <button className="btn-primary acumulado-periodo-aplicar" onClick={handleAplicarPeriodo} disabled={carregando}>
                  {carregando ? "Calculando..." : "Aplicar"}
                </button>

                {resultado && (
                  <div className="acumulado-periodo-resultado">
                    <div className="acumulado-tooltip-row">
                      <span>Período</span>
                      <span>{resultado.periodo.quantidade_meses} mês(es)</span>
                    </div>
                    <div className="acumulado-tooltip-row">
                      <span>Acum. Meta</span>
                      <span>{formatValor(resultado.acumulados.meta, meta.unidade)}</span>
                    </div>
                    <div className="acumulado-tooltip-row">
                      <span>Acum. Real</span>
                      <span>{formatValor(resultado.acumulados.real, meta.unidade)}</span>
                    </div>
                    <div className="acumulado-tooltip-row">
                      <span>Atingimento</span>
                      <span className={resultado.acumulados.status ? `status-${resultado.acumulados.status}` : undefined}>
                        {resultado.acumulados.percentual != null ? `${formatPercentual(resultado.acumulados.percentual)}%` : "-"}
                      </span>
                    </div>
                    <div className={`acumulado-tooltip-status ${resultado.acumulados.status ?? "vazio"}`}>
                      {resultado.acumulados.status === "ok"
                        ? "✓ OK"
                        : resultado.acumulados.status === "nok"
                        ? "✗ Não atingido"
                        : "Sem dados"}
                    </div>
                  </div>
                )}
              </div>
            )}

            {podeConfigurarAcumuloEspecifico && (
              <>
                <div className="acumulado-tooltip-divider" />
                {!acumuloAberto ? (
                  <button className="btn-link acumulado-tooltip-periodo-toggle" onClick={abrirAcumuloEspecifico}>
                    Acúmulo específico...
                  </button>
                ) : (
                  <div className="acumulado-periodo">
                    <label className="form-checkbox">
                      <input
                        type="checkbox"
                        checked={acumuloAtivo}
                        onChange={(e) => setAcumuloAtivo(e.target.checked)}
                      />
                      Acumular Meta e Real em intervalos específicos (em vez do ano inteiro)
                    </label>

                    {acumuloAtivo && (
                      <>
                        <div className="acumulado-tooltip-row">
                          <span>Meta</span>
                          <div className="acumulado-periodo-selects">
                            <select value={acumMetaInicio} onChange={(e) => setAcumMetaInicio(e.target.value as Mes)}>
                              {MESES.map((mes) => (
                                <option key={mes} value={mes}>{MESES_LABEL[mes]}</option>
                              ))}
                            </select>
                            <span>até</span>
                            <select value={acumMetaFim} onChange={(e) => setAcumMetaFim(e.target.value as Mes)}>
                              {MESES.map((mes) => (
                                <option key={mes} value={mes}>{MESES_LABEL[mes]}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <div className="acumulado-tooltip-row">
                          <span>Real</span>
                          <div className="acumulado-periodo-selects">
                            <select value={acumRealInicio} onChange={(e) => setAcumRealInicio(e.target.value as Mes)}>
                              {MESES.map((mes) => (
                                <option key={mes} value={mes}>{MESES_LABEL[mes]}</option>
                              ))}
                            </select>
                            <span>até</span>
                            <select value={acumRealFim} onChange={(e) => setAcumRealFim(e.target.value as Mes)}>
                              {MESES.map((mes) => (
                                <option key={mes} value={mes}>{MESES_LABEL[mes]}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </>
                    )}

                    <button className="btn-primary acumulado-periodo-aplicar" onClick={salvarAcumuloEspecifico} disabled={salvandoAcumulo}>
                      {salvandoAcumulo ? "Salvando..." : "Salvar"}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </span>
  );
}
