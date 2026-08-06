import { Usuario } from "../types";

// OS-009-C: substitui o login por senha próprio pelo fluxo do IdP. Backend e frontend são
// sempre acessados pela mesma origem (proxy do Vite em dev), então os caminhos são relativos.
export function loginUrl(returnTo: string = window.location.href): string {
  return `/api/auth/login?returnTo=${encodeURIComponent(returnTo)}`;
}

export function logoutUrl(): string {
  return "/api/auth/logout";
}

interface MeResponse {
  sub: string;
  email: string;
  name: string;
  role: string | null;
  usuario: Usuario;
}

export class UsuarioNaoVinculadoError extends Error {}

/** null = não autenticado no IdP (idpAuth.requireAuth redireciona para o login nesse caso —
 * detectado via redirect:"manual" para não seguir esse redirect automaticamente). Diferente de
 * UsuarioNaoVinculadoError: autenticado no IdP, mas sem Usuario local vinculado (OS-009-B/C) —
 * nesse caso reenviar para o login do IdP entraria em loop, então é tratado à parte. */
export async function getMe(): Promise<Usuario | null> {
  const resp = await fetch("/api/me", { redirect: "manual" });

  if (resp.type === "opaqueredirect") {
    return null;
  }
  if (resp.status === 403) {
    const body = await resp.json().catch(() => null);
    throw new UsuarioNaoVinculadoError(body?.error ?? "Usuário sem vínculo com o Farol");
  }
  if (!resp.ok) {
    throw new Error(`Falha ao consultar usuário autenticado (${resp.status})`);
  }

  const data = (await resp.json()) as MeResponse;
  return data.usuario;
}
