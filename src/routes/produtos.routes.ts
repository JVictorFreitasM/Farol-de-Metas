import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, resolveSetorId } from "../middleware/auth";
import { badRequest, conflict, notFound } from "../lib/errors";
import { registrarAuditoria } from "../lib/auditoria";
import { parsePagination, paginatedResponse } from "../lib/pagination";

export const produtosRouter = Router();
produtosRouter.use(authenticate);

function serializeProduto(produto: Prisma.ProdutoGetPayload<{ include: { _count: { select: { metas: true } } } }>) {
  return {
    id: produto.id,
    nome: produto.nome,
    descricao: produto.descricao,
    setor_id: produto.setorId,
    status: produto.status,
    criado_por: produto.criadoPor,
    criado_em: produto.criadoEm,
    atualizado_em: produto.atualizadoEm,
    atualizado_por: produto.atualizadoPor,
    _count: { metas: produto._count.metas },
  };
}

const listQuerySchema = z.object({
  setor_id: z.string().uuid().optional(),
  status: z.enum(["ativo", "inativo", "todos"]).default("ativo"),
  search: z.string().optional(),
  pagina: z.coerce.number().int().optional(),
  limite: z.coerce.number().int().optional(),
});

produtosRouter.get("/", async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const setorId = resolveSetorId(req.usuario!, query.setor_id);
    const { pagina, limite, skip } = parsePagination(req);

    const where: Prisma.ProdutoWhereInput = {
      setorId,
      ...(query.status !== "todos" ? { status: query.status } : {}),
      ...(query.search ? { nome: { contains: query.search, mode: "insensitive" } } : {}),
    };

    const [produtos, total] = await Promise.all([
      prisma.produto.findMany({
        where,
        include: { _count: { select: { metas: true } } },
        orderBy: { nome: "asc" },
        skip,
        take: limite,
      }),
      prisma.produto.count({ where }),
    ]);

    res.json(paginatedResponse(produtos.map(serializeProduto), total, { pagina, limite, skip }));
  } catch (err) {
    next(err);
  }
});

produtosRouter.get("/:id", async (req, res, next) => {
  try {
    const produto = await prisma.produto.findUnique({
      where: { id: req.params.id },
      include: {
        _count: { select: { metas: true } },
        metas: {
          select: { id: true, indicador: true, tipoMeta: true, metaAno: true, statusAcum: true },
        },
      },
    });
    if (!produto) throw notFound("Produto não encontrado");

    res.json({ ...serializeProduto(produto), metas: produto.metas });
  } catch (err) {
    next(err);
  }
});

const criarProdutoSchema = z.object({
  nome: z.string().min(1),
  descricao: z.string().optional(),
  setor_id: z.string().uuid().optional(),
  status: z.enum(["ativo", "inativo"]).default("ativo"),
});

produtosRouter.post("/", authorize("gerente"), async (req, res, next) => {
  try {
    const body = criarProdutoSchema.parse(req.body);
    const usuario = req.usuario!;
    const setorId = resolveSetorId(usuario, body.setor_id);

    const existente = await prisma.produto.findFirst({ where: { nome: body.nome, setorId } });
    if (existente) throw conflict("Já existe um produto com esse nome neste setor");

    const produto = await prisma.produto.create({
      data: {
        nome: body.nome,
        descricao: body.descricao,
        setorId,
        status: body.status,
        criadoPor: usuario.id,
      },
      include: { _count: { select: { metas: true } } },
    });

    await registrarAuditoria(req, {
      acao: "CREATE",
      tabela: "produtos",
      registroId: produto.id,
      setorId: produto.setorId,
      detalhes: { nome: produto.nome },
    });

    res.status(201).json(serializeProduto(produto));
  } catch (err) {
    next(err);
  }
});

const editarProdutoSchema = z.object({
  nome: z.string().min(1).optional(),
  descricao: z.string().optional(),
  status: z.enum(["ativo", "inativo"]).optional(),
});

produtosRouter.put("/:id", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const body = editarProdutoSchema.parse(req.body);
    const usuario = req.usuario!;

    const produtoAtual = await prisma.produto.findUnique({ where: { id: req.params.id } });
    if (!produtoAtual) throw notFound("Produto não encontrado");

    if (body.nome) {
      const duplicado = await prisma.produto.findFirst({
        where: { nome: body.nome, setorId: produtoAtual.setorId, id: { not: produtoAtual.id } },
      });
      if (duplicado) throw badRequest("Já existe um produto com esse nome neste setor");
    }

    const produto = await prisma.produto.update({
      where: { id: produtoAtual.id },
      data: {
        nome: body.nome,
        descricao: body.descricao,
        status: body.status,
        atualizadoPor: usuario.id,
        atualizadoEm: new Date(),
      },
      include: { _count: { select: { metas: true } } },
    });

    await registrarAuditoria(req, {
      acao: "UPDATE",
      tabela: "produtos",
      registroId: produto.id,
      setorId: produto.setorId,
      detalhes: { campos_alterados: body },
    });

    res.json(serializeProduto(produto));
  } catch (err) {
    next(err);
  }
});

produtosRouter.delete("/:id", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const produto = await prisma.produto.findUnique({ where: { id: req.params.id } });
    if (!produto) throw notFound("Produto não encontrado");

    await prisma.produto.delete({ where: { id: produto.id } });

    await registrarAuditoria(req, {
      acao: "DELETE",
      tabela: "produtos",
      registroId: produto.id,
      setorId: produto.setorId,
      detalhes: { nome: produto.nome },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
