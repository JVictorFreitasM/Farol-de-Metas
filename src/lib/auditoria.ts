import { Request } from "express";
import { AcaoAuditoria } from "@prisma/client";
import { prisma } from "./prisma";

export async function registrarAuditoria(
  req: Request,
  params: {
    acao: AcaoAuditoria;
    tabela: string;
    registroId?: string;
    setorId?: string | null;
    detalhes?: Record<string, unknown>;
  }
) {
  await prisma.auditoria.create({
    data: {
      setorId: params.setorId ?? req.usuario?.setorId ?? null,
      usuarioId: req.usuario?.id ?? null,
      acao: params.acao,
      tabela: params.tabela,
      registroId: params.registroId,
      ipAddress: req.ip,
      detalhes: params.detalhes as any,
    },
  });
}
