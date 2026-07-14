import { apiFetch } from "./api";
import { PaginatedResponse, Produto, ProdutoComMetas, StatusProduto } from "../types";

export interface ListarProdutosParams {
  setor_id?: string;
  status?: StatusProduto | "todos";
  search?: string;
  pagina?: number;
  limite?: number;
}

export function listarProdutos(params: ListarProdutosParams): Promise<PaginatedResponse<Produto>> {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== "") query.set(key, String(value));
  });
  return apiFetch<PaginatedResponse<Produto>>(`/produtos?${query.toString()}`);
}

export function obterProduto(id: string): Promise<ProdutoComMetas> {
  return apiFetch<ProdutoComMetas>(`/produtos/${id}`);
}

export interface CriarProdutoBody {
  nome: string;
  descricao?: string;
  setor_id?: string;
  status?: StatusProduto;
}

export function criarProduto(body: CriarProdutoBody) {
  return apiFetch<Produto>(`/produtos`, { method: "POST", body: JSON.stringify(body) });
}

export interface EditarProdutoBody {
  nome?: string;
  descricao?: string;
  status?: StatusProduto;
}

export function editarProduto(id: string, body: EditarProdutoBody) {
  return apiFetch<Produto>(`/produtos/${id}`, { method: "PUT", body: JSON.stringify(body) });
}

export function deletarProduto(id: string) {
  return apiFetch(`/produtos/${id}`, { method: "DELETE" });
}
