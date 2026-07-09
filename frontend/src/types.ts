export type Role = "responsavel" | "gerente" | "admin";
export type IcIv = "IC" | "IV";
export type TipoMeta = "maior_melhor" | "menor_melhor";
export type StatusMeta = "ok" | "nok";
export type AcaoAuditoria = "CREATE" | "READ" | "UPDATE" | "DELETE";

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  setor_id: string | null;
  role: Role;
}

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
export type Mes = (typeof MESES)[number];

export interface MetaFilho {
  id: string;
  ic_iv: IcIv;
  indicador: string;
  acumulado: string | number | null;
  status: StatusMeta | null;
}

export interface Meta {
  id: string;
  setor_id: string;
  nome_setor?: string;
  pai_id: string | null;
  ano: number;
  produto: string;
  ic_iv: IcIv;
  indicador: string;
  responsavel: string;
  unidade: string;
  tipo_meta: TipoMeta;
  meta_ano: string | number | null;
  valor_jan: string | number | null;
  valor_fev: string | number | null;
  valor_mar: string | number | null;
  valor_abr: string | number | null;
  valor_mai: string | number | null;
  valor_jun: string | number | null;
  valor_jul: string | number | null;
  valor_ago: string | number | null;
  valor_set: string | number | null;
  valor_out: string | number | null;
  valor_nov: string | number | null;
  valor_dez: string | number | null;
  acumulado: string | number | null;
  status: StatusMeta | null;
  editavel: boolean;
  atualizado_por_usuario: string | null;
  atualizado_em: string;
  filhos?: MetaFilho[];
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  pagina: number;
  limite: number;
  total_paginas?: number;
}

export interface DashboardResumo {
  setor: string;
  ano: number;
  periodo: string;
  resumo: {
    total_indicadores: number;
    status_ok: number;
    status_nok: number;
    percentual_atingimento: number;
  };
  metas_por_status: { status: StatusMeta; quantidade: number; exemplos: string[] }[];
  evolucao_mensal: { mes: string; status_ok: number; status_nok: number; acumulado_geral: string | number }[];
  ic_com_problemas: {
    indicador: string;
    acumulado: string | number;
    meta_ano: string | number | null;
    percentual: string | number | null;
    filhos_nok: string[];
  }[];
}

export interface ComparativaSetor {
  nome_setor: string;
  total_indicadores: number;
  status_ok: number;
  percentual_atingimento: number;
  ranking: number;
}

export interface ComparativaResponse {
  ano: number;
  periodo: string;
  setores: ComparativaSetor[];
}

export interface AuditoriaRegistro {
  id: string;
  timestamp: string;
  usuario: string | null;
  acao: AcaoAuditoria;
  tabela: string;
  registro_id: string | null;
  campos_alterados?: Record<string, { antes: unknown; depois: unknown }>;
  ip_address: string | null;
}
