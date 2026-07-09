import { useState } from "react";

export type Periodo = "mes" | "trim" | "semestre" | "ano";

export interface Filtros {
  ano: number;
  periodo: Periodo;
  setorId?: string;
}

export function useFilters(initial?: Partial<Filtros>) {
  const [filtros, setFiltros] = useState<Filtros>({
    ano: initial?.ano ?? new Date().getFullYear(),
    periodo: initial?.periodo ?? "ano",
    setorId: initial?.setorId,
  });

  const setAno = (ano: number) => setFiltros((f) => ({ ...f, ano }));
  const setPeriodo = (periodo: Periodo) => setFiltros((f) => ({ ...f, periodo }));
  const setSetorId = (setorId: string | undefined) => setFiltros((f) => ({ ...f, setorId }));

  return { filtros, setAno, setPeriodo, setSetorId };
}
