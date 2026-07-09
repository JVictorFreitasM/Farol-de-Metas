import { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { verifyToken } from "../lib/jwt";
import { unauthorized, forbidden } from "../lib/errors";

export const authenticate: RequestHandler = (req, _res, next) => {
  const header = req.header("authorization") ?? req.header("Authorization");
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    return next(unauthorized("Token de autenticação ausente"));
  }

  try {
    const claims = verifyToken(token);
    req.usuario = {
      id: claims.sub,
      nome: claims.nome,
      email: claims.email,
      setorId: claims.setorId,
      role: claims.role,
    };
    next();
  } catch {
    next(unauthorized("Token inválido ou expirado"));
  }
};

export const authorize = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.usuario) return next(unauthorized("Não autenticado"));
    if (!roles.includes(req.usuario.role)) {
      return next(forbidden("Acesso negado para este perfil de usuário"));
    }
    next();
  };
};

/** Resolve o setor_id efetivo da requisição aplicando a regra de ACL por setor (camada 2). */
export function resolveSetorId(
  usuario: NonNullable<Express.Request["usuario"]>,
  setorIdSolicitado: string | undefined
): string {
  if (usuario.role === "responsavel") {
    if (!usuario.setorId) {
      throw forbidden("Usuário responsável sem setor vinculado");
    }
    if (setorIdSolicitado && setorIdSolicitado !== usuario.setorId) {
      throw forbidden("Acesso negado a outro setor");
    }
    return usuario.setorId;
  }

  // gerente / admin podem consultar qualquer setor
  if (!setorIdSolicitado) {
    throw forbidden("Parâmetro 'setor_id' é obrigatório");
  }
  return setorIdSolicitado;
}
