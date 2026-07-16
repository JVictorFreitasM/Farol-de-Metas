import { apiFetch } from "./api";
import { IcIv, Meta, Mes, Setor, StatusMeta, TipoAgregacaoMeta, TipoAgregacaoReal, TipoMeta } from "../types";

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
  tipo_agregacao_meta?: TipoAgregacaoMeta;
  tipo_agregacao_real?: TipoAgregacaoReal;
  meta_manual_acum?: number;
  meta_ano?: number;
  meta?: MesesBody;
}

export function criarMeta(body: CriarMetaBody) {
  return apiFetch(`/metas`, { method: "POST", body: JSON.stringify(body) });
}

export function editarMeta(id: string, body: { meta_ano?: number; meta?: MesesBody; produto_id?: string | null }) {
  return apiFetch(`/metas/${id}/meta`, { method: "PUT", body: JSON.stringify(body) });
}

export function editarMetaManual(id: string, metaManualAcum: number) {
  return apiFetch(`/metas/${id}/meta-manual`, { method: "PUT", body: JSON.stringify({ meta_manual_acum: metaManualAcum }) });
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

export type PeriodoTipo = "mes" | "intervalo" | "trimestre" | "semestre" | "ano";

export interface ComparativoPeriodoParams {
  periodo_tipo: PeriodoTipo;
  mes?: Mes;
  mes_inicio?: Mes;
  mes_fim?: Mes;
  trimestre?: 1 | 2 | 3 | 4;
  semestre?: 1 | 2;
  ano_comparacao?: number;
}

interface PeriodoResumo {
  label: string;
  tipo: PeriodoTipo;
  ano: number;
  meta_acum: string | number | null;
  real_acum: string | number | null;
  percentual_execucao: string | number | null;
  status: StatusMeta | null;
}

export interface ComparativoResponse {
  meta_id: string;
  indicador: string;
  periodo_principal: PeriodoResumo;
  periodo_comparacao: PeriodoResumo | null;
  variacao: {
    real_delta: string | number | null;
    real_delta_percentual: string | number | null;
    meta_delta: string | number | null;
    meta_delta_percentual: string | number | null;
  } | null;
  serie_meses: {
    mes: Mes;
    periodo_principal: { meta: string | number | null; real: string | number | null };
    periodo_comparacao: { meta: string | number | null; real: string | number | null };
  }[];
}

export function obterComparativo(id: string, params: ComparativoPeriodoParams): Promise<ComparativoResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  return apiFetch<ComparativoResponse>(`/metas/${id}/comparativo?${query.toString()}`);
}
