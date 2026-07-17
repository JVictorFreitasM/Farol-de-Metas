/** Indicadores com unidade "%" guardam a fração decimal no banco (0.01 = 1%).
 * Use para qualquer valor bruto de meta/real/acumulado — não para percentuais já calculados
 * (ex: % de atingimento, que já vem na escala 0-100 e não deve ser multiplicado de novo). */
export function formatValor(valor: string | number | null | undefined, unidade: string): string {
  if (valor === null || valor === undefined) return "-";
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  if (!Number.isFinite(n)) return "-";
  if (unidade === "%") {
    return `${(n * 100).toLocaleString("pt-BR", { maximumFractionDigits: 2 })}%`;
  }
  return n.toLocaleString("pt-BR", { maximumFractionDigits: 4 });
}

/** Mesma conversão de formatValor, mas retorna número puro (sem formatação/sufixo) —
 * para eixos e séries de gráficos, onde o "%" precisa ser aplicado como escala, não texto. */
export function paraEscalaExibicao(valor: string | number | null | undefined, unidade: string): number | null {
  if (valor === null || valor === undefined) return null;
  const n = typeof valor === "string" ? parseFloat(valor) : valor;
  if (!Number.isFinite(n)) return null;
  return unidade === "%" ? n * 100 : n;
}
