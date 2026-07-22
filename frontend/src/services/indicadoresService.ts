import { apiFetch } from "./api";
import { Indicador, IcIv, TipoAgregacaoMeta, TipoAgregacaoReal } from "../types";

export interface ListarIndicadoresParams {
  setor_id?: string;
  incluir_inativos?: boolean;
}

export function listarIndicadores(params: ListarIndicadoresParams): Promise<{ data: Indicador[] }> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return apiFetch<{ data: Indicador[] }>(`/indicadores?${query.toString()}`);
}

export interface CriarIndicadorBody {
  setor_id: string;
  nome: string;
  ic_iv: IcIv;
  unidade: string;
  pai_id?: string;
  produto_id?: string;
  agrega_ivs?: boolean;
  tipo_acumulado_meta?: "soma" | "media" | "manual";
  tipo_acumulado_real?: "soma" | "media" | "manual";
  tipo_agregacao_meta?: TipoAgregacaoMeta;
  tipo_agregacao_real?: TipoAgregacaoReal;
  real_manual_acum?: number;
}

export function criarIndicador(body: CriarIndicadorBody): Promise<Indicador> {
  return apiFetch<Indicador>(`/indicadores`, { method: "POST", body: JSON.stringify(body) });
}

export interface EditarIndicadorBody {
  nome?: string;
  unidade?: string;
  produto_id?: string | null;
  agrega_ivs?: boolean;
  tipo_acumulado_meta?: "soma" | "media" | "manual";
  tipo_acumulado_real?: "soma" | "media" | "manual";
  tipo_agregacao_meta?: TipoAgregacaoMeta;
  tipo_agregacao_real?: TipoAgregacaoReal;
  real_manual_acum?: number | null;
}

export function editarIndicador(id: string, body: EditarIndicadorBody): Promise<Indicador> {
  return apiFetch<Indicador>(`/indicadores/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}

export function deletarIndicador(id: string) {
  return apiFetch(`/indicadores/${id}`, { method: "DELETE" });
}
