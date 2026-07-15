import { ANO_SESSION_KEY } from "../hooks/useAnoSelecionado";

const API_BASE = "/api";

export class ApiRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem("auth_token");

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers });

  // 401 em /auth/login é falha de credenciais, não sessão expirada — segue para o
  // tratamento padrão abaixo, que repassa a mensagem específica vinda do backend.
  if (resp.status === 401 && path !== "/auth/login") {
    localStorage.removeItem("auth_token");
    sessionStorage.removeItem(ANO_SESSION_KEY);
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiRequestError(401, "Sessão expirada");
  }

  const body = resp.status === 204 ? null : await resp.json().catch(() => null);

  if (!resp.ok) {
    throw new ApiRequestError(resp.status, body?.erro ?? `Erro ${resp.status}`);
  }

  return body as T;
}
