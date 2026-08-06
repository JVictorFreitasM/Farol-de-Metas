import type { RequestHandler } from "express";

// requireRole(role) (OS 07, secao 3.3) - deve vir DEPOIS de requireAuth na
// cadeia de middlewares (depende de req.user ja estar preenchido).
export function requireRole(role: string | string[]): RequestHandler {
  const allowed = Array.isArray(role) ? role : [role];

  return (req, res, next) => {
    if (!req.user) {
      res.status(401).json({ error: "Nao autenticado" });
      return;
    }
    if (!req.user.role || !allowed.includes(req.user.role)) {
      res.status(403).json({ error: "Papel insuficiente para acessar este recurso" });
      return;
    }
    next();
  };
}
