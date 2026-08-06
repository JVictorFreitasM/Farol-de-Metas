import type { Request, RequestHandler, Response } from "express";
import type { JwksCache } from "../jwks";
import type { ResolvedIdpClientConfig } from "../types";
import { verifyAccessToken } from "../verifyToken";
import { refreshTokens } from "../httpClient";

// Folga contra pequena diferenca de relogio entre sistema cliente e IdP -
// trata o token como expirado um pouco antes do `exp` real pra nao correr
// o risco de uma verificacao local aceitar por um triz e a proxima
// requisicao (fracoes de segundo depois) falhar.
const CLOCK_SKEW_MS = 5_000;

function redirectToLogin(req: Request, res: Response, config: ResolvedIdpClientConfig): void {
  const url = new URL(config.loginPath, "http://placeholder.local");
  url.searchParams.set("returnTo", req.originalUrl);
  res.redirect(`${url.pathname}${url.search}`);
}

// Middleware de protecao de rota (OS 07, secao 3.3):
// 1. Sem token na sessao -> /auth/login.
// 2. Token valido -> valida localmente via JWKS (sem chamar o IdP) e segue.
// 3. Token expirado (ou invalido por algum motivo) -> tenta renovar via
//    refresh_token; se a renovacao tambem falhar -> /auth/login (nunca erro
//    generico sem direcionamento claro - OS 07, secao 4).
export function createRequireAuth(config: ResolvedIdpClientConfig, jwks: JwksCache): RequestHandler {
  return async (req, res, next) => {
    const stored = req.session.idpAuth;
    if (!stored) {
      redirectToLogin(req, res, config);
      return;
    }

    const looksExpired = Date.now() >= stored.accessTokenExpiresAt - CLOCK_SKEW_MS;
    if (!looksExpired) {
      try {
        req.user = await verifyAccessToken(stored.accessToken, jwks, config.clientId, config.issuer);
        next();
        return;
      } catch {
        // Cai pro fluxo de renovacao abaixo em vez de falhar direto -
        // cobre, por exemplo, uma chave rotacionada que o cache local
        // ainda nao pegou.
      }
    }

    try {
      const tokens = await refreshTokens(config, stored.refreshToken);
      req.session.idpAuth = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      };
      req.user = await verifyAccessToken(tokens.access_token, jwks, config.clientId, config.issuer);
      next();
    } catch {
      // Refresh token tambem expirado/revogado (ou reuso detectado) - a
      // unica saida e um novo login, nunca um erro generico de aplicacao.
      delete req.session.idpAuth;
      redirectToLogin(req, res, config);
    }
  };
}
