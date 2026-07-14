import { apiFetch } from "./api";
import { IcIv, Meta, Mes, Setor, StatusMeta, TipoMeta } from "../types";

export interface ListarMetasParams {
  setor_id?: string;
  ano: number;
  incluir_inativos?: boolean;
}

export function listarMetas(params: ListarMetasParams): Promise<{ data: Meta[] }> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return apiFetch<{ data: Meta[] }>(`/metas?${query.toString()}`);
}

export function listarSetores(): Promise<Setor[]> {
  return apiFetch<Setor[]>(`/setores`);
}

export interface MesesBody {
  jan?: number;
  fev?: number;
  mar?: number;
  abr?: number;
  mai?: number;
  jun?: number;
  jul?: number;
  ago?: number;
  set?: number;
  out?: number;
  nov?: number;
  dez?: number;
}

export interface CriarMetaBody {
  setor_id: string;
  ano: number;
  ordem?: number;
  produto_id?: string;
  ic_iv: IcIv;
  pai_id?: string;
  indicador: string;
  responsavel: string;
  unidade: string;
  tipo_meta: TipoMeta;
  agrega_filhos?: boolean;
  tipo_acumulado?: "soma" | "media";
  meta_ano?: number;
  meta?: MesesBody;
}

export function criarMeta(body: CriarMetaBody) {
  return apiFetch(`/metas`, { method: "POST", body: JSON.stringify(body) });
}

export function editarMeta(id: string, body: { meta_ano?: number; meta?: MesesBody; produto_id?: string | null }) {
  return apiFetch(`/metas/${id}/meta`, { method: "PUT", body: JSON.stringify(body) });
}

export function editarReal(id: string, body: { real: MesesBody }) {
  return apiFetch(`/metas/${id}/real`, { method: "PUT", body: JSON.stringify(body) });
}

export function deletarMeta(id: string) {
  return apiFetch(`/metas/${id}`, { method: "DELETE" });
}

export function inativarMeta(id: string, motivo?: string) {
  return apiFetch(`/metas/${id}/inativar`, { method: "PATCH", body: JSON.stringify({ motivo }) });
}

export function ativarMeta(id: string) {
  return apiFetch(`/metas/${id}/ativar`, { method: "PATCH" });
}

export interface AcumuladoPeriodoResponse {
  id: string;
  indicador: string;
  periodo: { mes_inicio: Mes; mes_fim: Mes; quantidade_meses: number };
  acumulados: {
    meta: string | number | null;
    real: string | number | null;
    percentual: string | number | null;
    status: StatusMeta | null;
  };
  detalhes: { mes: Mes; meta: string | number | null; real: string | number | null }[];
}

export function obterAcumuladoPeriodo(id: string, mesInicio: Mes, mesFim: Mes): Promise<AcumuladoPeriodoResponse> {
  return apiFetch<AcumuladoPeriodoResponse>(`/metas/${id}/acumulado-periodo?mes_inicio=${mesInicio}&mes_fim=${mesFim}`);
}
