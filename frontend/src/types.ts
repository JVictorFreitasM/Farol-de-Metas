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

export interface Setor {
  id: string;
  nome: string;
  email: string | null;
}

export const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
export type Mes = (typeof MESES)[number];
export const MESES_LABEL: Record<Mes, string> = {
  jan: "Jan", fev: "Fev", mar: "Mar", abr: "Abr", mai: "Mai", jun: "Jun",
  jul: "Jul", ago: "Ago", set: "Set", out: "Out", nov: "Nov", dez: "Dez",
};

export interface MetaFilho {
  id: string;
  ic_iv: IcIv;
  indicador: string;
  acum_meta: string | number | null;
  acum_real: string | number | null;
  status_acum: StatusMeta | null;
}

export interface MesValores {
  meta: string | number | null;
  real: string | number | null;
  status: StatusMeta | null;
}

export type MesesMeta = Record<Mes, MesValores>;

export interface Meta {
  id: string;
  setor_id: string;
  nome_setor?: string;
  pai_id: string | null;
  ano: number;
  ordem: number;
  produto: string | null;
  ic_iv: IcIv;
  indicador: string;
  responsavel: string;
  unidade: string;
  tipo_meta: TipoMeta;
  agrega_filhos: boolean;
  tipo_acumulado: "soma" | "media";
  meta_ano: string | number | null;
  meses: MesesMeta;
  acum_meta: string | number | null;
  acum_real: string | number | null;
  status_acum: StatusMeta | null;
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
  evolucao_mensal: { mes: string; status_ok: number; status_nok: number }[];
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
