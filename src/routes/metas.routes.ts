import { Router } from "express";
import { z } from "zod";
import { IcIv, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, resolveSetorId } from "../middleware/auth";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { registrarAuditoria } from "../lib/auditoria";
import { serializeMeta } from "../lib/serializers";
import { calcularAcumuladoLinha, MESES, recalcularAgregadoIC } from "../lib/metasCalc";

export const metasRouter = Router();
metasRouter.use(authenticate);

const includeRelacoes = {
  setor: true,
  atualizadoPorUsuario: true,
  filhos: true,
} satisfies Prisma.MetaInclude;

/** Após alterar meta_x ou real_x de uma linha, recalcula seus acumulados e, se ela tiver
 * um IC pai com agrega_filhos=true, recalcula os meses e acumulados do pai também. */
async function recalcularLinhaEPai(metaId: string, usuarioId: string) {
  const meta = await prisma.meta.findUniqueOrThrow({ where: { id: metaId } });

  await prisma.meta.update({
    where: { id: meta.id },
    data: {
      acumMeta: calcularAcumuladoLinha(meta, "meta"),
      acumReal: calcularAcumuladoLinha(meta, "real"),
      atualizadoPor: usuarioId,
    },
  });

  if (!meta.paiId) return null;

  const pai = await prisma.meta.findUnique({ where: { id: meta.paiId } });
  if (!pai || !pai.agregaFilhos) return null;

  const filhos = await prisma.meta.findMany({ where: { paiId: pai.id } });
  const agregado = recalcularAgregadoIC(filhos);

  const dataMeses = Object.fromEntries(MESES.map((mes) => [`meta${mes}`, agregado.metaPorMes[mes]]));

  const paiAtualizado = await prisma.meta.update({
    where: { id: pai.id },
    data: {
      ...dataMeses,
      acumMeta: agregado.acumMeta,
      acumReal: agregado.acumReal,
      atualizadoPor: usuarioId,
    },
  });

  return paiAtualizado;
}

const listQuerySchema = z.object({
  setor_id: z.string().uuid().optional(),
  ano: z.coerce.number().int(),
});

metasRouter.get("/", async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const setorId = resolveSetorId(req.usuario!, query.setor_id);

    const metas = await prisma.meta.findMany({
      where: { setorId, ano: query.ano },
      include: includeRelacoes,
      orderBy: { ordem: "asc" },
    });

    res.json({ data: metas.map(serializeMeta) });
  } catch (err) {
    next(err);
  }
});

const mesesSchema = z.object({
  jan: z.number().optional(),
  fev: z.number().optional(),
  mar: z.number().optional(),
  abr: z.number().optional(),
  mai: z.number().optional(),
  jun: z.number().optional(),
  jul: z.number().optional(),
  ago: z.number().optional(),
  set: z.number().optional(),
  out: z.number().optional(),
  nov: z.number().optional(),
  dez: z.number().optional(),
});

const criarMetaSchema = z.object({
  setor_id: z.string().uuid(),
  ano: z.coerce.number().int(),
  ordem: z.number().int().default(0),
  produto: z.string().optional(),
  ic_iv: z.nativeEnum(IcIv),
  pai_id: z.string().uuid().optional(),
  indicador: z.string().min(1),
  responsavel: z.string().min(1),
  unidade: z.string().min(1),
  tipo_meta: z.enum(["maior_melhor", "menor_melhor"]),
  agrega_filhos: z.boolean().default(false),
  tipo_acumulado: z.enum(["soma", "media"]).default("soma"),
  meta_ano: z.number().optional(),
  meta: mesesSchema.optional(),
});

metasRouter.post("/", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const body = criarMetaSchema.parse(req.body);
    const usuario = req.usuario!;

    if (body.ic_iv === "IV" && !body.pai_id) {
      throw badRequest("IVs devem ter um IC pai (pai_id)");
    }
    if (body.ic_iv === "IC" && body.pai_id) {
      throw badRequest("ICs não podem ter pai_id");
    }

    const meta = await prisma.meta.create({
      data: {
        setorId: body.setor_id,
        ano: body.ano,
        ordem: body.ordem,
        produto: body.produto,
        icIv: body.ic_iv,
        paiId: body.pai_id,
        indicador: body.indicador,
        responsavel: body.responsavel,
        unidade: body.unidade,
        tipoMeta: body.tipo_meta,
        agregaFilhos: body.agrega_filhos,
        tipoAcumulado: body.tipo_acumulado,
        metaAno: body.meta_ano,
        metaJan: body.meta?.jan,
        metaFev: body.meta?.fev,
        metaMar: body.meta?.mar,
        metaAbr: body.meta?.abr,
        metaMai: body.meta?.mai,
        metaJun: body.meta?.jun,
        metaJul: body.meta?.jul,
        metaAgo: body.meta?.ago,
        metaSet: body.meta?.set,
        metaOut: body.meta?.out,
        metaNov: body.meta?.nov,
        metaDez: body.meta?.dez,
        atualizadoPor: usuario.id,
      },
    });

    await registrarAuditoria(req, {
      acao: "CREATE",
      tabela: "metas",
      registroId: meta.id,
      setorId: meta.setorId,
    });

    const paiAtualizado = await recalcularLinhaEPai(meta.id, usuario.id);

    res.status(201).json({
      ...serializeMeta(meta),
      ...(paiAtualizado ? { pai_atualizado: serializeMeta(paiAtualizado) } : {}),
    });
  } catch (err) {
    next(err);
  }
});

const editarMetaSchema = z.object({
  meta_ano: z.number().optional(),
  meta: mesesSchema.optional(),
});

metasRouter.put("/:id/meta", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const body = editarMetaSchema.parse(req.body);
    const usuario = req.usuario!;

    const metaAtual = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!metaAtual) throw notFound("Meta não encontrada");

    if (metaAtual.agregaFilhos) {
      throw conflict("Este IC agrega os valores dos filhos automaticamente e não pode ser editado diretamente.");
    }

    if (metaAtual.tipoMeta === "maior_melhor") {
      const valores = { meta_ano: body.meta_ano, ...body.meta };
      for (const [campo, valor] of Object.entries(valores)) {
        if (typeof valor === "number" && valor < 0) {
          throw badRequest(`Campo '${campo}' não pode ser negativo`);
        }
      }
    }

    const valoresAntes = { ...metaAtual };

    const metaAtualizada = await prisma.meta.update({
      where: { id: metaAtual.id },
      data: {
        metaAno: body.meta_ano,
        metaJan: body.meta?.jan,
        metaFev: body.meta?.fev,
        metaMar: body.meta?.mar,
        metaAbr: body.meta?.abr,
        metaMai: body.meta?.mai,
        metaJun: body.meta?.jun,
        metaJul: body.meta?.jul,
        metaAgo: body.meta?.ago,
        metaSet: body.meta?.set,
        metaOut: body.meta?.out,
        metaNov: body.meta?.nov,
        metaDez: body.meta?.dez,
        atualizadoPor: usuario.id,
      },
    });

    await prisma.metaHistorico.create({
      data: {
        metasId: metaAtualizada.id,
        versao: (await prisma.metaHistorico.count({ where: { metasId: metaAtualizada.id } })) + 1,
        valoresAntes: JSON.parse(JSON.stringify(valoresAntes)),
        valoresDepois: JSON.parse(JSON.stringify(metaAtualizada)),
        alteradoPor: usuario.id,
      },
    });

    await registrarAuditoria(req, {
      acao: "UPDATE",
      tabela: "metas",
      registroId: metaAtualizada.id,
      setorId: metaAtualizada.setorId,
      detalhes: { campos_alterados: body },
    });

    const paiAtualizado = await recalcularLinhaEPai(metaAtualizada.id, usuario.id);
    const metaFinal = await prisma.meta.findUniqueOrThrow({
      where: { id: metaAtualizada.id },
      include: includeRelacoes,
    });

    res.json({
      ...serializeMeta(metaFinal),
      ...(paiAtualizado ? { pai_atualizado: serializeMeta(paiAtualizado) } : {}),
    });
  } catch (err) {
    next(err);
  }
});

const editarRealSchema = z.object({
  real: mesesSchema,
});

metasRouter.put("/:id/real", authorize("responsavel"), async (req, res, next) => {
  try {
    const body = editarRealSchema.parse(req.body);
    const usuario = req.usuario!;

    const metaAtual = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!metaAtual) throw notFound("Meta não encontrada");

    if (metaAtual.setorId !== usuario.setorId) {
      throw forbidden("Acesso negado a outro setor");
    }

    if (metaAtual.agregaFilhos) {
      throw conflict("Este IC agrega os valores dos filhos automaticamente e não pode ser editado diretamente.");
    }

    if (metaAtual.tipoMeta === "maior_melhor") {
      for (const [campo, valor] of Object.entries(body.real)) {
        if (typeof valor === "number" && valor < 0) {
          throw badRequest(`Campo '${campo}' não pode ser negativo`);
        }
      }
    }

    const valoresAntes = { ...metaAtual };

    const metaAtualizada = await prisma.meta.update({
      where: { id: metaAtual.id },
      data: {
        realJan: body.real.jan,
        realFev: body.real.fev,
        realMar: body.real.mar,
        realAbr: body.real.abr,
        realMai: body.real.mai,
        realJun: body.real.jun,
        realJul: body.real.jul,
        realAgo: body.real.ago,
        realSet: body.real.set,
        realOut: body.real.out,
        realNov: body.real.nov,
        realDez: body.real.dez,
        atualizadoPor: usuario.id,
      },
    });

    await prisma.metaHistorico.create({
      data: {
        metasId: metaAtualizada.id,
        versao: (await prisma.metaHistorico.count({ where: { metasId: metaAtualizada.id } })) + 1,
        valoresAntes: JSON.parse(JSON.stringify(valoresAntes)),
        valoresDepois: JSON.parse(JSON.stringify(metaAtualizada)),
        alteradoPor: usuario.id,
      },
    });

    await registrarAuditoria(req, {
      acao: "UPDATE",
      tabela: "metas",
      registroId: metaAtualizada.id,
      setorId: metaAtualizada.setorId,
      detalhes: { campos_alterados: body },
    });

    const paiAtualizado = await recalcularLinhaEPai(metaAtualizada.id, usuario.id);
    const metaFinal = await prisma.meta.findUniqueOrThrow({
      where: { id: metaAtualizada.id },
      include: includeRelacoes,
    });

    res.json({
      ...serializeMeta(metaFinal),
      ...(paiAtualizado ? { pai_atualizado: serializeMeta(paiAtualizado) } : {}),
    });
  } catch (err) {
    next(err);
  }
});

metasRouter.delete("/:id", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const usuario = req.usuario!;
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!meta) throw notFound("Meta não encontrada");

    await prisma.$transaction(async (tx) => {
      const filhosIds = meta.icIv === "IC" ? (await tx.meta.findMany({ where: { paiId: meta.id }, select: { id: true } })).map((f) => f.id) : [];
      const idsParaRemover = [meta.id, ...filhosIds];

      await tx.metaHistorico.deleteMany({ where: { metasId: { in: idsParaRemover } } });
      await tx.meta.deleteMany({ where: { id: { in: filhosIds } } });
      await tx.meta.delete({ where: { id: meta.id } });
    });

    await registrarAuditoria(req, {
      acao: "DELETE",
      tabela: "metas",
      registroId: meta.id,
      setorId: meta.setorId,
    });

    let paiAtualizado = null;
    if (meta.paiId) {
      const pai = await prisma.meta.findUnique({ where: { id: meta.paiId } });
      if (pai?.agregaFilhos) {
        const filhos = await prisma.meta.findMany({ where: { paiId: pai.id } });
        const agregado = recalcularAgregadoIC(filhos);
        const dataMeses = Object.fromEntries(MESES.map((mes) => [`meta${mes}`, agregado.metaPorMes[mes]]));
        paiAtualizado = await prisma.meta.update({
          where: { id: pai.id },
          data: { ...dataMeses, acumMeta: agregado.acumMeta, acumReal: agregado.acumReal, atualizadoPor: usuario.id },
        });
      }
    }

    res.status(200).json(paiAtualizado ? { pai_atualizado: serializeMeta(paiAtualizado) } : {});
  } catch (err) {
    next(err);
  }
});
