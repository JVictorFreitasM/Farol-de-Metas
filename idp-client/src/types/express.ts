import type { IdpUser } from "../types";

declare global {
  namespace Express {
    interface Request {
      /** Preenchido por requireAuth com as claims do access_token validado (OS 07, secao 3.3). */
      user?: IdpUser;
    }
  }
}

export {};
