import { apiFetch, apiFetchBlob } from "./api";
import { ComparativaResponse, DashboardResumo } from "../types";

export function dashboardSetor(setorId: string | undefined, ano: number, periodo: string) {
  const query = new URLSearchParams({ ano: String(ano), periodo });
  if (setorId) query.set("setor_id", setorId);
  return apiFetch<DashboardResumo>(`/relatorios/dashboard?${query.toString()}`);
}

export function comparativaSetores(ano: number, periodo: string, mes?: string) {
  const query = new URLSearchParams({ ano: String(ano), periodo });
  if (mes) query.set("mes", mes);
  return apiFetch<ComparativaResponse>(`/relatorios/comparativa?${query.toString()}`);
}

/** Baixa o Excel gerado (uma aba por setor) e dispara o download no navegador. */
export async function exportarExcel(ano: number, setorIds: string[]): Promise<void> {
  const query = new URLSearchParams({ ano: String(ano), setor_ids: setorIds.join(",") });
  const { blob, filename } = await apiFetchBlob(`/relatorios/exportar-excel?${query.toString()}`);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
