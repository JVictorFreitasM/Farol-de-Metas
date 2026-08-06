import type { IdpClientConfig, ResolvedIdpClientConfig } from "./types";

const ONE_HOUR_MS = 60 * 60 * 1000;

export function resolveConfig(config: IdpClientConfig): ResolvedIdpClientConfig {
  if (!config.idpUrl || !config.clientId || !config.clientSecret || !config.redirectUri) {
    throw new Error(
      "@copperline/idp-client: idpUrl, clientId, clientSecret e redirectUri sao obrigatorios"
    );
  }

  return {
    idpUrl: config.idpUrl.replace(/\/+$/, ""),
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    redirectUri: config.redirectUri,
    // Sem authorizeUrl proprio, cai no idpUrl - mesmo comportamento de antes pra
    // quem roda tudo na mesma maquina/rede (sem esse split de topologia).
    authorizeUrl: (config.authorizeUrl ?? config.idpUrl).replace(/\/+$/, ""),
    loginPath: config.loginPath ?? "/auth/login",
    callbackPath: config.callbackPath ?? "/auth/callback",
    logoutPath: config.logoutPath ?? "/auth/logout",
    postLoginRedirect: config.postLoginRedirect ?? "/",
    postLogoutRedirect: config.postLogoutRedirect ?? "/",
    jwksCacheTtlMs: config.jwksCacheTtlMs ?? ONE_HOUR_MS,
    issuer: config.issuer,
  };
}
