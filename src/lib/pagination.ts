import { Request } from "express";

export interface PaginationParams {
  pagina: number;
  limite: number;
  skip: number;
}

export function parsePagination(req: Request): PaginationParams {
  const pagina = Math.max(1, parseInt(String(req.query.pagina ?? "1"), 10) || 1);
  const limite = Math.min(100, Math.max(1, parseInt(String(req.query.limite ?? "20"), 10) || 20));
  return { pagina, limite, skip: (pagina - 1) * limite };
}

export function paginatedResponse<T>(data: T[], total: number, { pagina, limite }: PaginationParams) {
  return {
    data,
    total,
    pagina,
    limite,
    total_paginas: Math.max(1, Math.ceil(total / limite)),
  };
}
