import { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { ApiError } from "../lib/errors";

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    res.status(400).json({ erro: err.issues[0]?.message ?? "Dados inválidos" });
    return;
  }

  if (err instanceof ApiError) {
    res.status(err.status).json({ erro: err.message });
    return;
  }

  console.error(err);
  res.status(500).json({ erro: "Erro interno do servidor" });
};
