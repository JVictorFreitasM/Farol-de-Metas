import { randomBytes } from "crypto";
import type { RequestHandler } from "express";
import type { ResolvedIdpClientConfig } from "../types";

// GET /auth/login (OS 07, secao 3.3): redireciona pro /authorize do IdP com
// um `state` gerado aqui e guardado na sessao local - validado de volta em
// /auth/callback pra proteger contra CSRF no fluxo de redirecionamento
// (mesmo cuidado ja observado na OS 03, agora do lado do cliente).
export function createLoginHandler(config: ResolvedIdpClientConfig): RequestHandler {
  return (req, res) => {
    const state = randomBytes(16).toString("hex");
    req.session.idpAuthState = state;

    const returnTo = typeof req.query.returnTo === "string" ? req.query.returnTo : undefined;
    if (returnTo) {
      req.session.idpAuthReturnTo = returnTo;
    }

    // authorizeUrl (nao idpUrl): este redirect vai pro navegador do usuario, que
    // pode nao enxergar o IdP pelo mesmo hostname/porta que o backend usa
    // server-to-server (ver IdpClientConfig.authorizeUrl).
    const url = new URL("/authorize", config.authorizeUrl);
    url.searchParams.set("client_id", config.clientId);
    url.searchParams.set("redirect_uri", config.redirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("state", state);

    res.redirect(url.toString());
  };
}
