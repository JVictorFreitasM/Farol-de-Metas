export type Role = "responsavel" | "gerente" | "admin";
export type IcIv = "IC" | "IV";
export type TipoMeta = "maior_melhor" | "menor_melhor";
export type StatusMeta = "ok" | "nok";
export type TipoAgregacaoMeta = "soma" | "media" | "meta_manual";
export type TipoAgregacaoReal = "soma" | "media" | "proporcao_agregada" | "real_manual";
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

export type StatusProduto = "ativo" | "inativo";

export interface Produto {
  id: string;
  nome: string;
  descricao: string | null;
  setor_id: string;
  status: StatusProduto;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
  atualizado_por: string | null;
  _count?: { indicadores: number };
}

export interface ProdutoComIndicadores extends Produto {
  indicadores?: {
    id: string;
    nome: string;
    icIv: IcIv;
    unidade: string;
  }[];
}

// OS-013: dados fixos do indicador (nome, unidade, hierarquia, regras de agregação) — não
// variam por ano. Cada ano é uma linha em Meta apontando para o mesmo Indicador.
export interface Indicador {
  id: string;
  setor_id: string;
  nome: string;
  ic_iv: IcIv;
  unidade: string;
  pai_id: string | null;
  produto_id: string | null;
  produto: string | null;
  agrega_filhos: boolean;
  // OS-015: separado por lado — nem sempre Meta e Real seguem a mesma regra de acumulação.
  tipo_acumulado_meta: "soma" | "media" | "manual";
  tipo_acumulado_real: "soma" | "media" | "manual";
  tipo_agregacao_meta: TipoAgregacaoMeta;
  tipo_agregacao_real: TipoAgregacaoReal;
  // Valor fixo de real acumulado do IC agregador, usado quando tipo_agregacao_real=real_manual.
  real_manual_acum: string | number | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
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
  indicador_id: string;
  pai_id: string | null;
  ano: number;
  ordem: number;
  produto_id: string | null;
  produto: string | null;
  ic_iv: IcIv;
  indicador: string;
  responsavel: string;
  unidade: string;
  tipo_meta: TipoMeta;
  agrega_filhos: boolean;
  tipo_acumulado_meta: "soma" | "media" | "manual";
  tipo_acumulado_real: "soma" | "media" | "manual";
  tipo_agregacao_meta: TipoAgregacaoMeta;
  tipo_agregacao_real: TipoAgregacaoReal;
  real_manual_acum: string | number | null;
  meta_manual_acum: string | number | null;
  acum_meta_manual: string | number | null;
  acum_real_manual: string | number | null;
  meta_ano: string | number | null;
  meses: MesesMeta;
  acum_meta: string | number | null;
  acum_real: string | number | null;
  status_acum: StatusMeta | null;
  atualizado_por_usuario: string | null;
  atualizado_em: string;
  ativo: boolean;
  inativado_em: string | null;
  inativado_por_usuario: string | null;
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
    unidade: string;
    acumulado: string | number;
    meta_ano: string | number | null;
    percentual: string | number | null;
    filhos_nok: string[];
  }[];
  metas_incompletas: {
    id: string;
    indicador: string;
    responsavel: string;
    meses_faltando: string[];
    quantidade_faltando: number;
  }[];
}

export interface MetaPendente {
  id: string;
  indicador: string;
  ic_iv: "IC" | "IV";
  responsavel: string;
}

export interface ComparativaSetor {
  setor_id: string;
  nome_setor: string;
  total_indicadores: number;
  status_ok: number;
  percentual_atingimento: number;
  ranking: number;
  consolidacao_geral: { percentual_preenchido: number; completo: boolean } | null;
  metas_pendentes: MetaPendente[];
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
