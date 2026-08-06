import type { RequestHandler } from "express";
import type { ResolvedIdpClientConfig } from "../types";
import { revokeToken } from "../httpClient";

// GET /auth/logout (OS 07, secao 3.3; RP-Initiated Logout): revoga o
// refresh_token no IdP (best-effort - se o IdP estiver fora, a sessao local
// e encerrada do mesmo jeito), destroi a sessao local do sistema cliente e
// so entao redireciona pro /session/end do IdP - e o unico jeito de tambem
// encerrar a sessao DELE (cookie httpOnly da origem do IdP, invisivel pro
// backend deste sistema). Sem esse passo, o SSO reautentica silenciosamente
// no proximo /authorize e a tela de login nunca aparece de volta.
export function createLogoutHandler(config: ResolvedIdpClientConfig): RequestHandler {
  return async (req, res) => {
    const stored = req.session.idpAuth;
    if (stored) {
      try {
        await revokeToken(config, stored.refreshToken);
      } catch {
        // Best-effort de proposito - nunca bloqueia o logout local.
      }
    }

    // Resolvido contra redirectUri (nao contra a origem do proprio
    // servidor) pra dar um destino ABSOLUTO - o /session/end do IdP roda em
    // outra origem e precisa saber pra onde mandar o navegador de volta.
    const postLogoutRedirectUri = new URL(config.postLogoutRedirect, config.redirectUri).toString();
    // authorizeUrl (nao idpUrl): mesmo motivo do /authorize em login.ts - este
    // redirect tambem vai pro navegador do usuario.
    const endSessionUrl = new URL("/session/end", config.authorizeUrl);
    endSessionUrl.searchParams.set("client_id", config.clientId);
    endSessionUrl.searchParams.set("post_logout_redirect_uri", postLogoutRedirectUri);

    req.session.destroy(() => {
      res.redirect(endSessionUrl.toString());
    });
  };
}
