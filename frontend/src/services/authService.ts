import { apiFetch } from "./api";
import { Usuario } from "../types";

export interface LoginResponse {
  token: string;
  usuario: Usuario;
}

export function login(email: string, senha: string): Promise<LoginResponse> {
  return apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, senha }),
  });
}
