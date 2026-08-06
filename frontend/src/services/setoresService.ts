import { apiFetch } from "./api";
import { Setor } from "../types";

// OS-020: service dedicado para a gestão de Setor (admin). listarSetores() sem params já existe
// em metasService.ts e é usado por vários seletores read-only espalhados pelo app — mantido lá
// intocado (baixo risco) em vez de migrar os 5 pontos de consumo. Esta versão aceita
// incluir_inativos, necessário só pela tela de gestão.
export interface ListarSetoresParams {
  incluir_inativos?: boolean;
}

export function listarSetores(params: ListarSetoresParams = {}): Promise<Setor[]> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined) query.set(key, String(value));
  });
  const qs = query.toString();
  return apiFetch<Setor[]>(`/setores${qs ? `?${qs}` : ""}`);
}

export interface CriarSetorBody {
  nome: string;
  email?: string;
}

export function criarSetor(body: CriarSetorBody) {
  return apiFetch<Setor>(`/setores`, { method: "POST", body: JSON.stringify(body) });
}

export interface EditarSetorBody {
  nome?: string;
  email?: string | null;
  ativo?: boolean;
}

export function editarSetor(id: string, body: EditarSetorBody) {
  return apiFetch<Setor>(`/setores/${id}`, { method: "PATCH", body: JSON.stringify(body) });
}
