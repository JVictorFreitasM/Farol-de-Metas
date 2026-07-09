import { apiFetch } from "./api";
import { AuditoriaRegistro, PaginatedResponse } from "../types";

export interface ListarAuditoriaParams {
  setor_id?: string;
  data_inicio?: string;
  data_fim?: string;
  acao?: string;
  usuario_id?: string;
  pagina?: number;
  limite?: number;
}

export function listarAuditoria(params: ListarAuditoriaParams) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return apiFetch<PaginatedResponse<AuditoriaRegistro>>(`/auditoria?${query.toString()}`);
}
