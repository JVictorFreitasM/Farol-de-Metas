import { Router } from "express";
import { z } from "zod";
import { AcaoAuditoria, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, resolveSetorId } from "../middleware/auth";
import { parsePagination, paginatedResponse } from "../lib/pagination";

export const auditoriaRouter = Router();
auditoriaRouter.use(authenticate);

const querySchema = z.object({
  setor_id: z.string().uuid().optional(),
  data_inicio: z.coerce.date().optional(),
  data_fim: z.coerce.date().optional(),
  acao: z.nativeEnum(AcaoAuditoria).optional(),
  usuario_id: z.string().uuid().optional(),
});

auditoriaRouter.get("/", async (req, res, next) => {
  try {
    const query = querySchema.parse(req.query);
    const usuario = req.usuario!;

    let setorId: string | undefined;
    if (usuario.role === "responsavel") {
      setorId = resolveSetorId(usuario, query.setor_id);
    } else {
      setorId = query.setor_id;
    }

    const pagination = parsePagination(req);

    const where: Prisma.AuditoriaWhereInput = {
      ...(setorId ? { setorId } : {}),
      ...(query.acao ? { acao: query.acao } : {}),
      ...(query.usuario_id ? { usuarioId: query.usuario_id } : {}),
      ...(query.data_inicio || query.data_fim
        ? {
            timestamp: {
              ...(query.data_inicio ? { gte: query.data_inicio } : {}),
              ...(query.data_fim ? { lte: query.data_fim } : {}),
            },
          }
        : {}),
    };

    const [registros, total] = await prisma.$transaction([
      prisma.auditoria.findMany({
        where,
        include: { usuario: true },
        orderBy: { timestamp: "desc" },
        skip: pagination.skip,
        take: pagination.limite,
      }),
      prisma.auditoria.count({ where }),
    ]);

    const data = registros.map((a) => {
      const detalhes = (a.detalhes as Record<string, unknown> | null) ?? {};
      return {
        id: a.id,
        timestamp: a.timestamp,
        usuario: a.usuario?.nome ?? null,
        acao: a.acao,
        tabela: a.tabela,
        registro_id: a.registroId,
        campos_alterados: detalhes.campos_alterados ?? undefined,
        ip_address: a.ipAddress,
      };
    });

    res.json(paginatedResponse(data, total, pagination));
  } catch (err) {
    next(err);
  }
});
