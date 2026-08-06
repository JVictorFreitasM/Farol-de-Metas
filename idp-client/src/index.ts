import { Router, type RequestHandler } from "express";
import { resolveConfig } from "./config";
import { JwksCache } from "./jwks";
import type { IdpClientConfig } from "./types";
import { createLoginHandler } from "./middleware/login";
import { createCallbackHandler } from "./middleware/callback";
import { createRequireAuth } from "./middleware/requireAuth";
import { requireRole } from "./middleware/requireRole";
import { createLogoutHandler } from "./middleware/logout";
import "./types/express-session";
import "./types/express";

export type { IdpClientConfig, IdpUser } from "./types";
export { requireRole };

export interface IdpAuth {
  /** Router montavel com as rotas de login/callback/logout (paths configuraveis). */
  router: Router;
  /** Middleware de protecao de rota - ver OS 07, secao 3.3. */
  requireAuth: RequestHandler;
}

// Ponto de entrada da lib (OS 07): cada sistema cliente chama isso uma vez
// com suas proprias credenciais e monta o router + usa requireAuth/requireRole
// nas rotas que precisam de autenticacao.
//
//   const idpAuth = createIdpAuth({ idpUrl, clientId, clientSecret, redirectUri });
//   app.use(session({ ... })); // o sistema cliente traz sua propria sessao
//   app.use(idpAuth.router);
//   app.get("/painel", idpAuth.requireAuth, handler);
//   app.get("/admin", idpAuth.requireAuth, requireRole("admin"), handler);
export function createIdpAuth(userConfig: IdpClientConfig): IdpAuth {
  const config = resolveConfig(userConfig);
  const jwks = new JwksCache(config.idpUrl, config.jwksCacheTtlMs);

  const router = Router();
  router.get(config.loginPath, createLoginHandler(config));
  router.get(config.callbackPath, createCallbackHandler(config));
  router.get(config.logoutPath, createLogoutHandler(config));

  return {
    router,
    requireAuth: createRequireAuth(config, jwks),
  };
}
