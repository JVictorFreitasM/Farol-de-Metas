import { Router } from "express";
import { z } from "zod";
import { IcIv, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, resolveSetorId } from "../middleware/auth";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { parsePagination, paginatedResponse } from "../lib/pagination";
import { registrarAuditoria } from "../lib/auditoria";
import { serializeMeta } from "../lib/serializers";
import { calcularAgregadoIC } from "../lib/metasCalc";

export const metasRouter = Router();
metasRouter.use(authenticate);

const includeRelacoes = {
  setor: true,
  atualizadoPorUsuario: true,
  filhos: true,
} satisfies Prisma.MetaInclude;

const listQuerySchema = z.object({
  setor_id: z.string().uuid().optional(),
  ano: z.coerce.number().int(),
  ic_iv: z.nativeEnum(IcIv).optional(),
  produto: z.string().optional(),
  indicador: z.string().optional(),
});

metasRouter.get("/", async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const setorId = resolveSetorId(req.usuario!, query.setor_id);
    const pagination = parsePagination(req);

    const where: Prisma.MetaWhereInput = {
      setorId,
      ano: query.ano,
      ...(query.ic_iv ? { icIv: query.ic_iv } : {}),
      ...(query.produto ? { produto: { contains: query.produto, mode: "insensitive" } } : {}),
      ...(query.indicador ? { indicador: { contains: query.indicador, mode: "insensitive" } } : {}),
    };

    const [metas, total] = await prisma.$transaction([
      prisma.meta.findMany({
        where,
        include: includeRelacoes,
        orderBy: { criadoEm: "asc" },
        skip: pagination.skip,
        take: pagination.limite,
      }),
      prisma.meta.count({ where }),
    ]);

    res.json(paginatedResponse(metas.map(serializeMeta), total, pagination));
  } catch (err) {
    next(err);
  }
});

const updateBodySchema = z.object({
  meta_ano: z.number().optional(),
  valor_jan: z.number().optional(),
  valor_fev: z.number().optional(),
  valor_mar: z.number().optional(),
  valor_abr: z.number().optional(),
  valor_mai: z.number().optional(),
  valor_jun: z.number().optional(),
  valor_jul: z.number().optional(),
  valor_ago: z.number().optional(),
  valor_set: z.number().optional(),
  valor_out: z.number().optional(),
  valor_nov: z.number().optional(),
  valor_dez: z.number().optional(),
});

metasRouter.put("/:id", async (req, res, next) => {
  try {
    const body = updateBodySchema.parse(req.body);
    const usuario = req.usuario!;

    const metaAtual = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!metaAtual) throw notFound("Meta não encontrada");

    if (metaAtual.icIv === "IC") {
      throw conflict("IC com IVs não pode ser editado diretamente. Edite os IVs filhos.");
    }
    if (usuario.role === "responsavel" && metaAtual.setorId !== usuario.setorId) {
      throw forbidden("Acesso negado a outro setor");
    }

    if (metaAtual.tipoMeta === "maior_melhor") {
      for (const [campo, valor] of Object.entries(body)) {
        if (typeof valor === "number" && valor < 0) {
          throw badRequest(`Campo '${campo}' não pode ser negativo`);
        }
      }
    }

    const valoresAntes = { ...metaAtual };

    const metaAtualizada = await prisma.meta.update({
      where: { id: metaAtual.id },
      data: {
        ...body,
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

    let paiAtualizado = null;
    if (metaAtualizada.paiId) {
      const filhos = await prisma.meta.findMany({ where: { paiId: metaAtualizada.paiId } });
      const pai = await prisma.meta.findUnique({ where: { id: metaAtualizada.paiId } });
      if (pai) {
        const agregado = calcularAgregadoIC(filhos);
        paiAtualizado = {
          id: pai.id,
          indicador: pai.indicador,
          meta_ano: agregado.metaAno,
          acumulado: agregado.acumulado,
          status: agregado.status,
        };
      }
    }

    const usuarioResp = await prisma.usuario.findUnique({ where: { id: usuario.id } });

    res.json({
      id: metaAtualizada.id,
      ic_iv: metaAtualizada.icIv,
      indicador: metaAtualizada.indicador,
      valor_jan: metaAtualizada.valorJan,
      valor_fev: metaAtualizada.valorFev,
      valor_mar: metaAtualizada.valorMar,
      valor_abr: metaAtualizada.valorAbr,
      valor_mai: metaAtualizada.valorMai,
      valor_jun: metaAtualizada.valorJun,
      valor_jul: metaAtualizada.valorJul,
      valor_ago: metaAtualizada.valorAgo,
      valor_set: metaAtualizada.valorSet,
      valor_out: metaAtualizada.valorOut,
      valor_nov: metaAtualizada.valorNov,
      valor_dez: metaAtualizada.valorDez,
      meta_ano: metaAtualizada.metaAno,
      acumulado: metaAtualizada.acumulado,
      status: metaAtualizada.status,
      atualizado_em: metaAtualizada.atualizadoEm,
      atualizado_por_usuario: usuarioResp?.nome ?? null,
      meta_editada: true,
      ...(paiAtualizado ? { pai_atualizado: paiAtualizado } : {}),
    });
  } catch (err) {
    next(err);
  }
});

const duplicarBodySchema = z.object({
  ano_novo: z.coerce.number().int(),
  resetar_valores: z.boolean().default(true),
});

metasRouter.post("/:id/duplicar", async (req, res, next) => {
  try {
    const { ano_novo, resetar_valores } = duplicarBodySchema.parse(req.body);
    const usuario = req.usuario!;

    const metaOrigem = await prisma.meta.findUnique({
      where: { id: req.params.id },
      include: { filhos: true },
    });
    if (!metaOrigem) throw notFound("Meta não encontrada");
    if (usuario.role === "responsavel" && metaOrigem.setorId !== usuario.setorId) {
      throw forbidden("Acesso negado a outro setor");
    }

    const criados: { id: string; indicador: string; ano: number; meta_ano: unknown; valores_zerados: boolean }[] = [];

    await prisma.$transaction(async (tx) => {
      const duplicarUm = async (origem: typeof metaOrigem, paiIdNovo: string | null) => {
        const valores = resetar_valores
          ? {
              valorJan: null,
              valorFev: null,
              valorMar: null,
              valorAbr: null,
              valorMai: null,
              valorJun: null,
              valorJul: null,
              valorAgo: null,
              valorSet: null,
              valorOut: null,
              valorNov: null,
              valorDez: null,
            }
          : {
              valorJan: origem.valorJan,
              valorFev: origem.valorFev,
              valorMar: origem.valorMar,
              valorAbr: origem.valorAbr,
              valorMai: origem.valorMai,
              valorJun: origem.valorJun,
              valorJul: origem.valorJul,
              valorAgo: origem.valorAgo,
              valorSet: origem.valorSet,
              valorOut: origem.valorOut,
              valorNov: origem.valorNov,
              valorDez: origem.valorDez,
            };

        const novo = await tx.meta.create({
          data: {
            setorId: origem.setorId,
            ano: ano_novo,
            produto: origem.produto,
            icIv: origem.icIv,
            paiId: paiIdNovo,
            indicador: origem.indicador,
            responsavel: origem.responsavel,
            unidade: origem.unidade,
            tipoMeta: origem.tipoMeta,
            metaAno: origem.metaAno,
            ...valores,
            atualizadoPor: usuario.id,
          },
        });

        criados.push({
          id: novo.id,
          indicador: novo.indicador,
          ano: novo.ano,
          meta_ano: novo.metaAno,
          valores_zerados: resetar_valores,
        });

        if (origem.icIv === "IC") {
          const filhos = await tx.meta.findMany({ where: { paiId: origem.id } });
          for (const filho of filhos) {
            await duplicarUm({ ...filho, filhos: [] } as typeof metaOrigem, novo.id);
          }
        }
      };

      await duplicarUm(metaOrigem, metaOrigem.paiId);
    });

    await registrarAuditoria(req, {
      acao: "CREATE",
      tabela: "metas",
      registroId: metaOrigem.id,
      setorId: metaOrigem.setorId,
      detalhes: { ano_novo, resetar_valores, metas_criadas: criados.length },
    });

    res.status(201).json({
      metas_criadas: criados.length,
      detalhes: criados,
    });
  } catch (err) {
    next(err);
  }
});
