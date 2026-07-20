/** Indicadores com unidade "%" guardam a fração decimal no banco (0.01 = 1%).
 * Use para qualquer valor bruto de meta/real/acumulado — não para percentuais já calculados
 * (ex: % de atingimento, que já vem na escala 0-100 e não deve ser multiplicado de novo).
 *
 * Todo valor formatado carrega o identificador da unidade junto (R$ 1.234,00 / 500 Tons /
 * 3 D / 12,3%) — sem isso, números soltos de indicadores diferentes (dias, toneladas, reais)
 * ficam visualmente idênticos e é fácil confundir o que cada um representa. */
export function formatValor(valor: string | number | null | undefined, unidade: string): string {
  if (valor === null || valor === undefined) return "-";
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  if (!Number.isFinite(n)) return "-";

  if (unidade === "%") {
    return `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  }
  if (unidade === "R$") {
    return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  }

  const numeroFormatado = n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  return unidade ? `${numeroFormatado} ${unidade}` : numeroFormatado;
}

/** Mesma conversão de formatValor, mas retorna número puro (sem formatação/sufixo) —
 * para eixos e séries de gráficos, onde o "%" precisa ser aplicado como escala, não texto. */
export function paraEscalaExibicao(valor: string | number | null | undefined, unidade: string): number | null {
  if (valor === null || valor === undefined) return null;
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  if (!Number.isFinite(n)) return null;
  return unidade === "%" ? n * 100 : n;
}

/** Formata um valor que já passou por paraEscalaExibicao (ex: dado de gráfico, onde "%" já
 * está multiplicado por 100) — mesma identificação de unidade do formatValor, sem reaplicar
 * a conversão de escala. Use em tooltips/labels de gráfico. */
export function formatValorEscalado(valor: number | null | undefined, unidade: string): string {
  if (valor === null || valor === undefined || !Number.isFinite(valor)) return "-";
  if (unidade === "%") return `${valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  if (unidade === "R$") return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const numeroFormatado = valor.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
  return unidade ? `${numeroFormatado} ${unidade}` : numeroFormatado;
}
