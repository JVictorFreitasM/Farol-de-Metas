import { ReactNode, useLayoutEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { obterAcumuladoPeriodo } from "../services/metasService";
import { Meta, MESES, MESES_LABEL, Mes } from "../types";

function formatNumero(valor: string | number | null): string {
  if (valor === null || valor === undefined) return "-";
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  return Number.isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 4 }) : "-";
}

function calcularPercentual(meta: Meta): string {
  const acumMeta = typeof meta.acum_meta === "string" ? parseFloat(meta.acum_meta) : meta.acum_meta;
  const acumReal = typeof meta.acum_real === "string" ? parseFloat(meta.acum_real) : meta.acum_real;
  if (!acumMeta) return "-";
  return `${(((acumReal ?? 0) / acumMeta) * 100).toFixed(1)}%`;
}

const FECHAR_DELAY_MS = 200;
const MARGEM = 8;

export function AcumuladoTooltip({ meta, children }: { meta: Meta; children: ReactNode }) {
  const [visivel, setVisivel] = useState(false);
  const [posicao, setPosicao] = useState({ top: 0, left: 0, direcao: "cima" as "cima" | "baixo" });
  const [periodoAberto, setPeriodoAberto] = useState(false);
  const [mesInicio, setMesInicio] = useState<Mes>("jan");
  const [mesFim, setMesFim] = useState<Mes>("dez");
  const [resultado, setResultado] = useState<Awaited<ReturnType<typeof obterAcumuladoPeriodo>> | null>(null);
  const [carregando, setCarregando] = useState(false);
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
              <span>{formatNumero(meta.meta_ano)}</span>
            </div>
            <div className="acumulado-tooltip-row">
              <span>Acum. Meta</span>
              <span>{formatNumero(meta.acum_meta)}</span>
            </div>
            <div className="acumulado-tooltip-row">
              <span>Acum. Real</span>
              <span>{formatNumero(meta.acum_real)}</span>
            </div>
            <div className="acumulado-tooltip-row">
              <span>Tipo Acum.</span>
              <span>{meta.tipo_acumulado === "media" ? "Média" : "Soma"}</span>
            </div>
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
                      <span>{formatNumero(resultado.acumulados.meta)}</span>
                    </div>
                    <div className="acumulado-tooltip-row">
                      <span>Acum. Real</span>
                      <span>{formatNumero(resultado.acumulados.real)}</span>
                    </div>
                    <div className="acumulado-tooltip-row">
                      <span>Atingimento</span>
                      <span className={resultado.acumulados.status ? `status-${resultado.acumulados.status}` : undefined}>
                        {resultado.acumulados.percentual != null ? `${formatNumero(resultado.acumulados.percentual)}%` : "-"}
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
          </div>
        </div>
      )}
    </span>
  );
}
