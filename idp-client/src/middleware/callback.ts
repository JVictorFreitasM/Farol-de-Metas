import type { RequestHandler } from "express";
import type { ResolvedIdpClientConfig } from "../types";
import { exchangeAuthorizationCode, IdpTokenError } from "../httpClient";

// GET /auth/callback (OS 07, secao 3.3): recebe o code, valida o state
// (CSRF), troca por access_token/refresh_token no /token do IdP e guarda
// na sessao local do PROPRIO sistema (nunca no front - OS 07, secao 3.4).
export function createCallbackHandler(config: ResolvedIdpClientConfig): RequestHandler {
  return async (req, res) => {
    const { code, state, error, error_description: errorDescription } = req.query;

    if (typeof error === "string") {
      res.status(400).send(`Login cancelado pelo IdP: ${typeof errorDescription === "string" ? errorDescription : error}`);
      return;
    }

    const expectedState = req.session.idpAuthState;
    delete req.session.idpAuthState;
    if (!expectedState || typeof state !== "string" || state !== expectedState) {
      res.status(400).send("Estado invalido ou expirado - inicie o login novamente.");
      return;
    }

    if (typeof code !== "string") {
      res.status(400).send("Codigo de autorizacao ausente.");
      return;
    }

    let tokens;
    try {
      tokens = await exchangeAuthorizationCode(config, code);
    } catch (err) {
      const message = err instanceof IdpTokenError ? err.message : "Falha ao comunicar com o IdP.";
      res.status(502).send(`Nao foi possivel completar o login: ${message}`);
      return;
    }

    const returnTo = req.session.idpAuthReturnTo;
    delete req.session.idpAuthReturnTo;

    // Regenera o id de sessao no login (mitiga session fixation), igual ao
    // que o proprio IdP faz no /login (OS 02).
    req.session.regenerate((err) => {
      if (err) {
        res.status(500).send("Falha ao iniciar sessao local.");
        return;
      }

      req.session.idpAuth = {
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        accessTokenExpiresAt: Date.now() + tokens.expires_in * 1000,
      };

      res.redirect(returnTo || config.postLoginRedirect);
    });
  };
}
