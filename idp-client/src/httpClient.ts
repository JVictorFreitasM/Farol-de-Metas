import type { ResolvedIdpClientConfig, TokenResponse } from "./types";

export class IdpTokenError extends Error {
  constructor(
    message: string,
    public readonly code?: string
  ) {
    super(message);
  }
}

async function postToken(config: ResolvedIdpClientConfig, params: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch(`${config.idpUrl}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params),
  });

  const body = (await res.json().catch(() => ({}))) as Partial<TokenResponse> & {
    error?: string;
    error_description?: string;
  };

  if (!res.ok) {
    throw new IdpTokenError(body.error_description ?? body.error ?? `Falha ao trocar token (HTTP ${res.status})`, body.error);
  }

  return body as TokenResponse;
}

export function exchangeAuthorizationCode(config: ResolvedIdpClientConfig, code: string): Promise<TokenResponse> {
  return postToken(config, {
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
}

export function refreshTokens(config: ResolvedIdpClientConfig, refreshToken: string): Promise<TokenResponse> {
  return postToken(config, {
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });
}

// Best-effort de proposito (usado no logout) - o IdP responde 200 mesmo
// pra token ja invalido/desconhecido (RFC 7009), entao nao ha "falha
// esperada" real aqui alem de rede/config errada.
export async function revokeToken(config: ResolvedIdpClientConfig, refreshToken: string): Promise<void> {
  await fetch(`${config.idpUrl}/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      token: refreshToken,
      client_id: config.clientId,
      client_secret: config.clientSecret,
    }),
  });
}
