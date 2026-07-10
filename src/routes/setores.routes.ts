import { Router } from "express";
import { prisma } from "../lib/prisma";
import { authenticate } from "../middleware/auth";

export const setoresRouter = Router();
setoresRouter.use(authenticate);

setoresRouter.get("/", async (_req, res, next) => {
  try {
    const setores = await prisma.setor.findMany({
      where: { ativo: true },
      select: { id: true, nome: true, email: true },
      orderBy: { nome: "asc" },
    });
    res.json(setores);
  } catch (err) {
    next(err);
  }
});
