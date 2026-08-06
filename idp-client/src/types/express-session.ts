import "express-session";
import type { StoredTokens } from "../types";

declare module "express-session" {
  interface SessionData {
    idpAuth?: StoredTokens;
    /** state do OAuth2 gerado em /auth/login, validado em /auth/callback (CSRF, OS 07 secao 4). */
    idpAuthState?: string;
    /** Onde mandar o usuario apos o login, se veio de uma rota protegida especifica. */
    idpAuthReturnTo?: string;
  }
}
