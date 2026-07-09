import { apiFetch } from "./api";
import { ComparativaResponse, DashboardResumo } from "../types";

export function dashboardSetor(setorId: string | undefined, ano: number, periodo: string) {
  const query = new URLSearchParams({ ano: String(ano), periodo });
  if (setorId) query.set("setor_id", setorId);
  return apiFetch<DashboardResumo>(`/relatorios/dashboard?${query.toString()}`);
}

export function comparativaSetores(ano: number, periodo: string) {
  const query = new URLSearchParams({ ano: String(ano), periodo });
  return apiFetch<ComparativaResponse>(`/relatorios/comparativa?${query.toString()}`);
}
