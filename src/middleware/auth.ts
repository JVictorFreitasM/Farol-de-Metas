import { RequestHandler } from "express";
import { UserRole } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { idpAuth } from "../lib/idpAuth";
import { forbidden } from "../lib/errors";

const ROLES_VALIDAS: ReadonlySet<string> = new Set<UserRole>(["responsavel", "gerente", "admin"]);

// Evita gravar ultimo_acesso a cada requisição autenticada — atualiza no máximo 1x/hora,
// aproximando "no momento em que o login completa" (OS-009-B §4.3) sem um write por request.
const ULTIMO_ACESSO_THROTTLE_MS = 60 * 60 * 1000;

// OS-009-C §3.4: resolve o Usuario local a partir do sub do token do IdP (vínculo
// estabelecido na OS-009-B via idpUserId). Usuário autenticado no IdP mas sem vínculo local
// é bloqueado (decisão tomada nesta OS) — nunca deixa passar sem req.usuario definido.
const resolveLocalUser: RequestHandler = async (req, res, next) => {
  const idpUser = req.user;
  if (!idpUser) {
    res.status(401).json({ error: "Não autenticado" });
    return;
  }

  if (!idpUser.role || !ROLES_VALIDAS.has(idpUser.role)) {
    res.status(403).json({ error: "Papel do usuário no IdP é inválido para este sistema" });
    return;
  }

  const usuario = await prisma.usuario.findUnique({ where: { idpUserId: idpUser.sub } });
  if (!usuario) {
    // OS-009-B: log temporário para facilitar o preenchimento manual/via script de
    // scripts/vincular-idp-user.ts enquanto não há automação de vínculo por e-mail.
    console.warn(`[auth] usuario_nao_vinculado: sub=${idpUser.sub} email=${idpUser.email} nome=${idpUser.name}`);
    res.status(403).json({ error: "usuario_nao_vinculado" });
    return;
  }
  if (!usuario.ativo) {
    res.status(403).json({ error: "Usuário inativo. Contate o administrador" });
    return;
  }

  if (!usuario.ultimoAcesso || Date.now() - usuario.ultimoAcesso.getTime() > ULTIMO_ACESSO_THROTTLE_MS) {
    await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcesso: new Date() } });
  }

  req.usuario = {
    id: usuario.id,
    nome: usuario.nome,
    email: usuario.email,
    setorId: usuario.setorId,
    role: idpUser.role as UserRole,
  };
  next();
};

// OS-009-C: substitui a verificação de JWT próprio. idpAuth.requireAuth valida a sessão/token
// do IdP (renovando via refresh token quando preciso) e popula req.user; resolveLocalUser then
// resolve o Usuario local correspondente. authorize()/resolveSetorId() abaixo continuam
// operando sobre req.usuario sem alteração — só a fonte da identidade mudou.
export const authenticate: RequestHandler = (req, res, next) => {
  idpAuth.requireAuth(req, res, () => resolveLocalUser(req, res, next));
};

export const authorize = (...roles: UserRole[]): RequestHandler => {
  return (req, _res, next) => {
    if (!req.usuario) return next(forbidden("Não autenticado"));
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
