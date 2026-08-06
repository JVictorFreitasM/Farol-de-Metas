import { createIdpAuth } from "@copperline/idp-client";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Variável de ambiente ${name} é obrigatória (login via IdP, OS-009-C)`);
  return value;
}

// OS-009-C: paths explicitamente sob /api — Farol monta suas rotas sob esse prefixo (removido
// pelo proxy do Vite antes de chegar ao backend), então login/callback/logout do idp-client
// (e os redirects relativos que ele gera, ex. quando o refresh token expira) precisam já
// nascer com /api, senão o navegador tenta acessar um caminho que o Vite não sabe rotear.
export const idpAuth = createIdpAuth({
  idpUrl: requireEnv("IDP_URL"),
  authorizeUrl: process.env.IDP_AUTHORIZE_URL,
  clientId: requireEnv("IDP_CLIENT_ID"),
  clientSecret: requireEnv("IDP_CLIENT_SECRET"),
  redirectUri: requireEnv("IDP_REDIRECT_URI"),
  loginPath: "/api/auth/login",
  callbackPath: "/api/auth/callback",
  logoutPath: "/api/auth/logout",
  postLoginRedirect: process.env.FRONTEND_URL ?? "/",
  postLogoutRedirect: process.env.FRONTEND_URL ?? "/",
});
