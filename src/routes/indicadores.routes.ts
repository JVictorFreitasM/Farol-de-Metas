import { Router } from "express";
import { z } from "zod";
import { IcIv, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, resolveSetorId } from "../middleware/auth";
import { badRequest, conflict, notFound } from "../lib/errors";
import { registrarAuditoria } from "../lib/auditoria";

export const indicadoresRouter = Router();
indicadoresRouter.use(authenticate);

function serializeIndicador(indicador: Prisma.IndicadorGetPayload<{ include: { produto: true } }>) {
  return {
    id: indicador.id,
    setor_id: indicador.setorId,
    nome: indicador.nome,
    ic_iv: indicador.icIv,
    unidade: indicador.unidade,
    pai_id: indicador.paiId,
    produto_id: indicador.produtoId,
    produto: indicador.produto?.nome ?? null,
    agrega_ivs: indicador.agregaIvs,
    tipo_acumulado_meta: indicador.tipoAcumuladoMeta,
    tipo_acumulado_real: indicador.tipoAcumuladoReal,
    tipo_agregacao_meta: indicador.tipoAgregacaoMeta,
    tipo_agregacao_real: indicador.tipoAgregacaoReal,
    // OS-015: valor fixo de real acumulado, usado quando tipo_agregacao_real = real_manual.
    real_manual_acum: indicador.realManualAcum,
    ativo: indicador.ativo,
    criado_em: indicador.criadoEm,
    atualizado_em: indicador.atualizadoEm,
  };
}

const listQuerySchema = z.object({
  setor_id: z.string().uuid().optional(),
  incluir_inativos: z.enum(["true", "false"]).default("false"),
});

indicadoresRouter.get("/", async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const setorId = resolveSetorId(req.usuario!, query.setor_id);

    const indicadores = await prisma.indicador.findMany({
      where: {
        setorId,
        ...(query.incluir_inativos === "true" ? {} : { ativo: true }),
      },
      include: { produto: true },
      orderBy: { nome: "asc" },
    });

    res.json({ data: indicadores.map(serializeIndicador) });
  } catch (err) {
    next(err);
  }
});

const criarIndicadorSchema = z.object({
  setor_id: z.string().uuid(),
  nome: z.string().min(1),
  ic_iv: z.nativeEnum(IcIv),
  unidade: z.string().min(1),
  pai_id: z.string().uuid().optional(),
  produto_id: z.string().uuid().optional(),
  agrega_ivs: z.boolean().default(false),
  // OS-015: "manual" — acumulado não é derivado dos 12 meses, vem de meta.acum_meta_manual /
  // meta.acum_real_manual (separado por lado, já que nem sempre os dois seguem a mesma regra).
  tipo_acumulado_meta: z.enum(["soma", "media", "manual"]).default("soma"),
  tipo_acumulado_real: z.enum(["soma", "media", "manual"]).default("soma"),
  tipo_agregacao_meta: z.enum(["soma", "media", "meta_manual"]).default("soma"),
  // OS-015: "real_manual" — Real do IC agregador não deriva dos IVs, é digitado direto.
  tipo_agregacao_real: z.enum(["soma", "media", "proporcao_agregada", "real_manual"]).default("soma"),
  real_manual_acum: z.number().optional(),
});

indicadoresRouter.post("/", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const body = criarIndicadorSchema.parse(req.body);
    const setorId = resolveSetorId(req.usuario!, body.setor_id);

    if (body.ic_iv === "IV" && !body.pai_id) {
      throw badRequest("IVs devem ter um indicador pai (pai_id)");
    }
    if (body.ic_iv === "IC" && body.pai_id) {
      throw badRequest("ICs não podem ter pai_id");
    }

    const existente = await prisma.indicador.findFirst({ where: { nome: body.nome, setorId } });
    if (existente) throw conflict("Já existe um indicador com esse nome neste setor");

    const indicador = await prisma.indicador.create({
      data: {
        setorId,
        nome: body.nome,
        icIv: body.ic_iv,
        unidade: body.unidade,
        paiId: body.pai_id,
        produtoId: body.produto_id,
        agregaIvs: body.agrega_ivs,
        tipoAcumuladoMeta: body.tipo_acumulado_meta,
        tipoAcumuladoReal: body.tipo_acumulado_real,
        tipoAgregacaoMeta: body.tipo_agregacao_meta,
        tipoAgregacaoReal: body.tipo_agregacao_real,
        realManualAcum: body.real_manual_acum,
      },
      include: { produto: true },
    });

    await registrarAuditoria(req, {
      acao: "CREATE",
      tabela: "indicadores",
      registroId: indicador.id,
      setorId: indicador.setorId,
    });

    res.status(201).json(serializeIndicador(indicador));
  } catch (err) {
    next(err);
  }
});

const editarIndicadorSchema = z.object({
  nome: z.string().min(1).optional(),
  unidade: z.string().min(1).optional(),
  produto_id: z.string().uuid().nullable().optional(),
  agrega_ivs: z.boolean().optional(),
  tipo_acumulado_meta: z.enum(["soma", "media", "manual"]).optional(),
  tipo_acumulado_real: z.enum(["soma", "media", "manual"]).optional(),
  tipo_agregacao_meta: z.enum(["soma", "media", "meta_manual"]).optional(),
  tipo_agregacao_real: z.enum(["soma", "media", "proporcao_agregada", "real_manual"]).optional(),
  real_manual_acum: z.number().nullable().optional(),
});

indicadoresRouter.patch("/:id", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const body = editarIndicadorSchema.parse(req.body);
    const indicadorAtual = await prisma.indicador.findUnique({ where: { id: req.params.id } });
    if (!indicadorAtual) throw notFound("Indicador não encontrado");

    if (body.nome) {
      const duplicado = await prisma.indicador.findFirst({
        where: { nome: body.nome, setorId: indicadorAtual.setorId, id: { not: indicadorAtual.id } },
      });
      if (duplicado) throw badRequest("Já existe um indicador com esse nome neste setor");
    }

    const indicador = await prisma.indicador.update({
      where: { id: indicadorAtual.id },
      data: {
        nome: body.nome,
        unidade: body.unidade,
        produtoId: body.produto_id,
        agregaIvs: body.agrega_ivs,
        tipoAcumuladoMeta: body.tipo_acumulado_meta,
        tipoAcumuladoReal: body.tipo_acumulado_real,
        tipoAgregacaoMeta: body.tipo_agregacao_meta,
        tipoAgregacaoReal: body.tipo_agregacao_real,
        realManualAcum: body.real_manual_acum,
        atualizadoEm: new Date(),
      },
      include: { produto: true },
    });

    await registrarAuditoria(req, {
      acao: "UPDATE",
      tabela: "indicadores",
      registroId: indicador.id,
      setorId: indicador.setorId,
      detalhes: { campos_alterados: body },
    });

    res.json(serializeIndicador(indicador));
  } catch (err) {
    next(err);
  }
});

indicadoresRouter.delete("/:id", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const indicador = await prisma.indicador.findUnique({ where: { id: req.params.id } });
    if (!indicador) throw notFound("Indicador não encontrado");
    if (!indicador.ativo) throw conflict("Este indicador já está inativo");

    await prisma.indicador.update({ where: { id: indicador.id }, data: { ativo: false } });
    if (indicador.icIv === "IC") {
      await prisma.indicador.updateMany({ where: { paiId: indicador.id, ativo: true }, data: { ativo: false } });
    }

    await registrarAuditoria(req, {
      acao: "DELETE",
      tabela: "indicadores",
      registroId: indicador.id,
      setorId: indicador.setorId,
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
