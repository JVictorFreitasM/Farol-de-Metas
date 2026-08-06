// Configuracao que cada sistema cliente fornece ao instanciar a lib (OS 07,
// secao 3.2) - normalmente lida de variaveis de ambiente pelo proprio
// sistema (IDP_URL, IDP_CLIENT_ID, IDP_CLIENT_SECRET, IDP_REDIRECT_URI).
export interface IdpClientConfig {
  /**
   * URL base do IdP usada SERVER-TO-SERVER (troca de code por token, JWKS,
   * revoke) - chamada de dentro do processo/container do sistema cliente, sem
   * barra final (ex.: "http://192.168.x.x:4000").
   */
  idpUrl: string;
  clientId: string;
  /** Nunca deve chegar ao front do sistema cliente (OS 07, secao 4). */
  clientSecret: string;
  redirectUri: string;
  /**
   * URL base do IdP usada só para montar os redirects que vão pro navegador
   * do usuário (GET /authorize e GET /session/end). Só precisa ser diferente
   * de `idpUrl` quando o sistema cliente roda em topologia onde o backend e o
   * navegador do usuário não enxergam o IdP pelo mesmo hostname/porta - ex.:
   * backend containerizado falando com o IdP via host.docker.internal, mas o
   * navegador (no host) precisa de localhost. @default idpUrl
   */
  authorizeUrl?: string;

  /** @default "/auth/login" */
  loginPath?: string;
  /** @default "/auth/callback" */
  callbackPath?: string;
  /** @default "/auth/logout" */
  logoutPath?: string;
  /** Pra onde mandar o usuario depois de logar, se nao houver returnTo salvo. @default "/" */
  postLoginRedirect?: string;
  /** @default "/" */
  postLogoutRedirect?: string;
  /** Cache do JWKS (OS 07, secao 3.5). @default 3600000 (1h) */
  jwksCacheTtlMs?: number;
  /** Se definido, o `iss` do token tambem e validado contra este valor. */
  issuer?: string;
}

export interface ResolvedIdpClientConfig extends Required<Omit<IdpClientConfig, "issuer">> {
  issuer?: string;
}

// Claims que o front-facing `req.user` expoe pro resto da aplicacao cliente
// (OS 07, secao 3.3) - nunca o token cru, so os dados ja decodificados/validados.
export interface IdpUser {
  sub: string;
  email: string;
  name: string;
  role: string | null;
  system: string;
}

// O que fica guardado na sessao local do sistema cliente - nunca exposto
// ao front (OS 07, secao 3.4: sempre cookie httpOnly gerido pelo backend).
export interface StoredTokens {
  accessToken: string;
  refreshToken: string;
  /** epoch ms - quando o access_token expira, calculado a partir de `expires_in`. */
  accessTokenExpiresAt: number;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
}
