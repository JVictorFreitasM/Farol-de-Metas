import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { signToken } from "../lib/jwt";
import { verifyPassword } from "../lib/password";
import { unauthorized } from "../lib/errors";
import { registrarAuditoria } from "../lib/auditoria";

export const authRouter = Router();

const loginSchema = z.object({
  email: z.string().email(),
  senha: z.string().min(1),
});

async function registrarTentativaFalha(req: Parameters<typeof registrarAuditoria>[0], usuarioId?: string) {
  await registrarAuditoria(req, {
    acao: "READ",
    tabela: "usuarios",
    registroId: usuarioId,
    detalhes: { sucesso: false, evento: "login_falhou" },
  });
}

authRouter.post("/login", async (req, res, next) => {
  try {
    const { email, senha } = loginSchema.parse(req.body);

    const usuario = await prisma.usuario.findUnique({ where: { email } });
    if (!usuario || !usuario.ativo) {
      await registrarTentativaFalha(req, usuario?.id);
      throw unauthorized("Credenciais inválidas");
    }

    const senhaValida = await verifyPassword(senha, usuario.senhaHash);
    if (!senhaValida) {
      await registrarTentativaFalha(req, usuario.id);
      throw unauthorized("Credenciais inválidas");
    }

    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { ultimoAcesso: new Date() },
    });

    const token = signToken({
      sub: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      setorId: usuario.setorId,
      role: usuario.role,
    });

    req.usuario = {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      setorId: usuario.setorId,
      role: usuario.role,
    };
    await registrarAuditoria(req, {
      acao: "READ",
      tabela: "usuarios",
      registroId: usuario.id,
      detalhes: { sucesso: true, evento: "login" },
    });

    res.json({
      token,
      usuario: {
        id: usuario.id,
        nome: usuario.nome,
        email: usuario.email,
        setor_id: usuario.setorId,
        role: usuario.role,
      },
    });
  } catch (err) {
    next(err);
  }
});
