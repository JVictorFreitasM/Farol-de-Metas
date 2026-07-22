import { apiFetch } from "./api";
import { ConfiguracaoSistema, DesbloqueioPreenchimento } from "../types";

export function obterConfiguracao(): Promise<ConfiguracaoSistema> {
  return apiFetch<ConfiguracaoSistema>(`/configuracoes`);
}

export function editarConfiguracao(diaLimitePreenchimento: number): Promise<ConfiguracaoSistema> {
  return apiFetch<ConfiguracaoSistema>(`/configuracoes`, {
    method: "PUT",
    body: JSON.stringify({ dia_limite_preenchimento: diaLimitePreenchimento }),
  });
}

export interface ListarDesbloqueiosParams {
  setor_id?: string;
  ano?: number;
}

export function listarDesbloqueios(params: ListarDesbloqueiosParams = {}): Promise<{ data: DesbloqueioPreenchimento[] }> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return apiFetch<{ data: DesbloqueioPreenchimento[] }>(`/configuracoes/desbloqueios?${query.toString()}`);
}

export interface CriarDesbloqueioBody {
  setor_id: string;
  ano: number;
  mes: number;
}

export function criarDesbloqueio(body: CriarDesbloqueioBody): Promise<DesbloqueioPreenchimento> {
  return apiFetch<DesbloqueioPreenchimento>(`/configuracoes/desbloqueios`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function removerDesbloqueio(id: string) {
  return apiFetch(`/configuracoes/desbloqueios/${id}`, { method: "DELETE" });
}
