import { Router } from "express";
import { z } from "zod";
import { Setor } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { badRequest, conflict, notFound } from "../lib/errors";
import { registrarAuditoria } from "../lib/auditoria";

export const setoresRouter = Router();
setoresRouter.use(authenticate);

function serializeSetor(setor: Setor) {
  return {
    id: setor.id,
    nome: setor.nome,
    email: setor.email,
    ativo: setor.ativo,
    criado_em: setor.criadoEm,
    atualizado_em: setor.atualizadoEm,
  };
}

const listQuerySchema = z.object({
  incluir_inativos: z.enum(["true", "false"]).default("false"),
});

setoresRouter.get("/", async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);

    const setores = await prisma.setor.findMany({
      where: query.incluir_inativos === "true" ? {} : { ativo: true },
      orderBy: { nome: "asc" },
    });

    // Mantido como array "cru" (sem envelope {data:...}) — formato já consumido hoje pelos
    // seletores de setor espalhados pelo app (listarSetores em metasService.ts). Adicionar
    // incluir_inativos/campos novos ao objeto é aditivo, não quebra esses consumidores.
    res.json(setores.map(serializeSetor));
  } catch (err) {
    next(err);
  }
});

// OS-020: gestão de Setor é exclusiva de admin — diferente de Produto/Indicador, que gerente já
// gerencia dentro do próprio setor. Não reaproveita resolveSetorId (setor É o escopo aqui, não
// algo a resolver a partir dele) — manter esse alicerce intocado evita abrir acesso de gerente a
// outros setores em qualquer outra rota do sistema.
const criarSetorSchema = z.object({
  nome: z.string().trim().min(1),
  email: z.string().trim().email("Email inválido").optional(),
});

setoresRouter.post("/", authorize("admin"), async (req, res, next) => {
  try {
    const body = criarSetorSchema.parse(req.body);

    // Case-insensitive desde o início — mesma correção aplicada a Indicador na OS-019, pra não
    // reintroduzir aqui o mesmo bug ("Setor A" e "setor a" sendo aceitos como setores distintos).
    const nomeDuplicado = await prisma.setor.findFirst({
      where: { nome: { equals: body.nome, mode: "insensitive" } },
    });
    if (nomeDuplicado) throw conflict("Já existe um setor com esse nome");

    if (body.email) {
      const emailDuplicado = await prisma.setor.findFirst({
        where: { email: { equals: body.email, mode: "insensitive" } },
      });
      if (emailDuplicado) throw conflict("Já existe um setor com esse email");
    }

    const setor = await prisma.$transaction(async (tx) => {
      const setor = await tx.setor.create({
        data: { nome: body.nome, email: body.email ?? null },
      });

      await registrarAuditoria(
        req,
        { acao: "CREATE", tabela: "setores", registroId: setor.id, setorId: setor.id, detalhes: { nome: setor.nome } },
        tx
      );

      return setor;
    });

    res.status(201).json(serializeSetor(setor));
  } catch (err) {
    next(err);
  }
});

const editarSetorSchema = z.object({
  nome: z.string().trim().min(1).optional(),
  // null explícito limpa o email (campo opcional); undefined (ausente do payload) não mexe nele.
  email: z.string().trim().email("Email inválido").nullable().optional(),
  // Reativação/inativação do setor — reaproveita este endpoint em vez de rota dedicada, mesmo
  // padrão de PATCH /indicadores/:id (OS-019). Sem DELETE: só inativação (soft), como o resto
  // do sistema — histórico associado ao setor nunca é ocultado nem apagado por essa troca.
  ativo: z.boolean().optional(),
});

setoresRouter.patch("/:id", authorize("admin"), async (req, res, next) => {
  try {
    const body = editarSetorSchema.parse(req.body);
    const setorAtual = await prisma.setor.findUnique({ where: { id: req.params.id } });
    if (!setorAtual) throw notFound("Setor não encontrado");

    // Só checa duplicidade quando o valor de fato muda (case-insensitive) — reenviar o nome/email
    // atual sem alteração não pode falhar por colidir consigo mesmo (mesmo raciocínio da OS-019
    // em PATCH /indicadores/:id).
    if (body.nome && body.nome.toLowerCase() !== setorAtual.nome.toLowerCase()) {
      const nomeDuplicado = await prisma.setor.findFirst({
        where: { nome: { equals: body.nome, mode: "insensitive" }, id: { not: setorAtual.id } },
      });
      if (nomeDuplicado) throw badRequest("Já existe um setor com esse nome");
    }
    if (body.email && body.email.toLowerCase() !== (setorAtual.email ?? "").toLowerCase()) {
      const emailDuplicado = await prisma.setor.findFirst({
        where: { email: { equals: body.email, mode: "insensitive" }, id: { not: setorAtual.id } },
      });
      if (emailDuplicado) throw badRequest("Já existe um setor com esse email");
    }

    const setor = await prisma.$transaction(async (tx) => {
      const setor = await tx.setor.update({
        where: { id: setorAtual.id },
        data: {
          nome: body.nome,
          email: body.email,
          ativo: body.ativo,
          atualizadoEm: new Date(),
        },
      });

      await registrarAuditoria(
        req,
        { acao: "UPDATE", tabela: "setores", registroId: setor.id, setorId: setor.id, detalhes: { campos_alterados: body } },
        tx
      );

      return setor;
    });

    res.json(serializeSetor(setor));
  } catch (err) {
    next(err);
  }
});
