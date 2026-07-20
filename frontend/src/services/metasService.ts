import { apiFetch } from "./api";
import { Meta, Mes, Setor, StatusMeta, TipoMeta } from "../types";

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

// OS-013: nome/unidade/hierarquia/regras de agregação já vivem no Indicador (criado à parte via
// /indicadores) — criar uma Meta só referencia um indicador_id existente e os campos que variam
// por ano.
export interface CriarMetaBody {
  indicador_id: string;
  ano: number;
  ordem?: number;
  responsavel: string;
  tipo_meta: TipoMeta;
  meta_manual_acum?: number;
  meta_ano?: number;
  meta?: MesesBody;
}

export function criarMeta(body: CriarMetaBody) {
  return apiFetch(`/metas`, { method: "POST", body: JSON.stringify(body) });
}

export function editarMeta(id: string, body: { meta_ano?: number; meta?: MesesBody }) {
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
  /** Anos extras para comparar, separados por vírgula (ex: "2023,2024"). "" = nenhum (só o principal). */
  anos_comparacao?: string;
}

export interface PeriodoResumo {
  ano: number;
  label: string;
  meta_acum: string | number | null;
  real_acum: string | number | null;
  percentual_execucao: string | number | null;
  status: StatusMeta | null;
}

export interface ComparativoResponse {
  meta_id: string;
  indicador: string;
  unidade: string;
  ano_principal: number;
  /** Anos incluídos na resposta, na ordem: principal primeiro, depois os de comparação. */
  anos: number[];
  /** Um resumo por ano, na mesma ordem de `anos`. */
  periodos: PeriodoResumo[];
  serie_meses: {
    mes: Mes;
    /** Chaveado pelo ano (como string, por causa de JSON) — um valor por ano em `anos`. */
    valores: Record<string, { meta: string | number | null; real: string | number | null }>;
  }[];
}

export function obterComparativo(id: string, params: ComparativoPeriodoParams): Promise<ComparativoResponse> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  return apiFetch<ComparativoResponse>(`/metas/${id}/comparativo?${query.toString()}`);
}

export function obterAnosDisponiveis(setorId: string): Promise<number[]> {
  return apiFetch<number[]>(`/metas/anos-disponiveis?setor_id=${setorId}`);
}

export interface ImportarAnoBody {
  ano_origem: number;
  ano_destino: number;
  copiar_metas: boolean;
  copiar_produtos: boolean;
  setor_id: string;
  ajuste_percentual: number;
  confirmar_sobrescrever: boolean;
}

export interface ImportarAnoResponse {
  sucesso: boolean;
  metas_importadas: number;
  produtos_importados: number;
  avisos: string[];
  novas_meta_ids: string[];
}

export function importarAno(body: ImportarAnoBody): Promise<ImportarAnoResponse> {
  return apiFetch<ImportarAnoResponse>(`/metas/importar-ano`, { method: "POST", body: JSON.stringify(body) });
}
