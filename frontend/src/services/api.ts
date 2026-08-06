import { ANO_SESSION_KEY } from "../hooks/useAnoSelecionado";
import { SETOR_SESSION_KEY } from "../hooks/sessionKeys";
import { loginUrl } from "./auth";

const API_BASE = "/api";

export class ApiRequestError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// OS-009-C: autenticação agora é via cookie de sessão (httpOnly, gerido pelo backend), não
// mais Authorization: Bearer — fetch já envia cookies por padrão em requisições same-origin.
function redirecionarParaLogin() {
  sessionStorage.removeItem(ANO_SESSION_KEY);
  sessionStorage.removeItem(SETOR_SESSION_KEY);
  window.location.href = loginUrl();
}

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  // redirect:"manual" — sessão/token inválido vira um 302 do backend pro login do IdP (outra
  // origem); um fetch normal tentaria seguir esse redirect e provavelmente falharia por CORS,
  // já que o /authorize do IdP é feito pra navegação de página inteira, não para fetch/XHR.
  const resp = await fetch(`${API_BASE}${path}`, { ...options, headers, redirect: "manual" });

  if (resp.type === "opaqueredirect") {
    redirecionarParaLogin();
    throw new ApiRequestError(401, "Sessão expirada");
  }

  const body = resp.status === 204 ? null : await resp.json().catch(() => null);

  if (!resp.ok) {
    throw new ApiRequestError(resp.status, body?.erro ?? body?.error ?? `Erro ${resp.status}`);
  }

  return body as T;
}

/** Para downloads de arquivo (ex: exportação Excel) — resposta binária, não JSON. Mesmo
 * tratamento de auth/erro do apiFetch, mas devolve o blob e o nome de arquivo sugerido pelo
 * backend (Content-Disposition) em vez de fazer parse de JSON. */
export async function apiFetchBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const resp = await fetch(`${API_BASE}${path}`, { redirect: "manual" });

  if (resp.type === "opaqueredirect") {
    redirecionarParaLogin();
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
