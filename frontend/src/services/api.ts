import { ANO_SESSION_KEY } from "../hooks/useAnoSelecionado";
import { SETOR_SESSION_KEY } from "../hooks/sessionKeys";

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
    sessionStorage.removeItem(SETOR_SESSION_KEY);
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

/** Para downloads de arquivo (ex: exportação Excel) — resposta binária, não JSON. Mesmo
 * tratamento de auth/erro do apiFetch, mas devolve o blob e o nome de arquivo sugerido pelo
 * backend (Content-Disposition) em vez de fazer parse de JSON. */
export async function apiFetchBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const token = localStorage.getItem("auth_token");
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const resp = await fetch(`${API_BASE}${path}`, { headers });

  if (resp.status === 401) {
    localStorage.removeItem("auth_token");
    sessionStorage.removeItem(ANO_SESSION_KEY);
    sessionStorage.removeItem(SETOR_SESSION_KEY);
    if (window.location.pathname !== "/login") {
      window.location.href = "/login";
    }
    throw new ApiRequestError(401, "Sessão expirada");
  }

  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    throw new ApiRequestError(resp.status, body?.erro ?? `Erro ${resp.status}`);
  }

  const disposition = resp.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="?([^"]+)"?/);
  const filename = match ? match[1] : "relatorio.xlsx";
  const blob = await resp.blob();
  return { blob, filename };
}
