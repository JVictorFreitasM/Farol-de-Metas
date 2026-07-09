import { apiFetch } from "./api";
import { Meta, PaginatedResponse } from "../types";

export interface ListarMetasParams {
  setor_id?: string;
  ano: number;
  ic_iv?: "IC" | "IV";
  produto?: string;
  indicador?: string;
  pagina?: number;
  limite?: number;
}

export function listarMetas(params: ListarMetasParams): Promise<PaginatedResponse<Meta>> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return apiFetch<PaginatedResponse<Meta>>(`/metas?${query.toString()}`);
}

export interface AtualizarMetaBody {
  meta_ano?: number;
  valor_jan?: number;
  valor_fev?: number;
  valor_mar?: number;
  valor_abr?: number;
  valor_mai?: number;
  valor_jun?: number;
  valor_jul?: number;
  valor_ago?: number;
  valor_set?: number;
  valor_out?: number;
  valor_nov?: number;
  valor_dez?: number;
}

export function atualizarMeta(id: string, body: AtualizarMetaBody) {
  return apiFetch(`/metas/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

export function duplicarMeta(id: string, anoNovo: number, resetarValores: boolean) {
  return apiFetch(`/metas/${id}/duplicar`, {
    method: "POST",
    body: JSON.stringify({ ano_novo: anoNovo, resetar_valores: resetarValores }),
  });
}
