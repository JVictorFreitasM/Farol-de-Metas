import { Router } from "express";
import { z } from "zod";
import { IcIv, Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, resolveSetorId } from "../middleware/auth";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { registrarAuditoria } from "../lib/auditoria";
import { serializeMeta } from "../lib/serializers";
import {
  calcularAcumuladoLinha,
  calcularAcumuladoPeriodo,
  campoMeta,
  campoReal,
  MESES,
  MesKey,
  recalcularAgregadoIC,
  resolverIntervaloMeses,
} from "../lib/metasCalc";

export const metasRouter = Router();
metasRouter.use(authenticate);

const includeRelacoes = {
  setor: true,
  atualizadoPorUsuario: true,
  inativadoPorUsuario: true,
  filhos: true,
  produto: true,
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

  const filhos = await prisma.meta.findMany({ where: { paiId: pai.id, ativo: true } });
  const agregado = recalcularAgregadoIC(filhos, {
    tipoAgregacaoMeta: pai.tipoAgregacaoMeta,
    tipoAgregacaoReal: pai.tipoAgregacaoReal,
    metaManualAcum: pai.metaManualAcum,
  });

  const dataMeses = Object.fromEntries([
    // metaPorMes === null (tipo_agregacao_meta="meta_manual"): não sobrescrever a Meta,
    // que é digitada manualmente mês a mês pelo gerente — undefined faz o Prisma ignorar o campo.
    ...MESES.map((mes) => [`meta${mes}`, agregado.metaPorMes ? agregado.metaPorMes[mes] : undefined]),
    ...MESES.map((mes) => [`real${mes}`, agregado.realPorMes[mes]]),
  ]);

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
  incluir_inativos: z.enum(["true", "false"]).default("false"),
});

metasRouter.get("/", async (req, res, next) => {
  try {
    const query = listQuerySchema.parse(req.query);
    const setorId = resolveSetorId(req.usuario!, query.setor_id);

    const metas = await prisma.meta.findMany({
      where: {
        setorId,
        ano: query.ano,
        ...(query.incluir_inativos === "true" ? {} : { ativo: true }),
      },
      include: includeRelacoes,
      orderBy: { ordem: "asc" },
    });

    res.json({ data: metas.map(serializeMeta) });
  } catch (err) {
    next(err);
  }
});

metasRouter.patch("/:id/inativar", authorize("gerente"), async (req, res, next) => {
  try {
    const usuario = req.usuario!;
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!meta) throw notFound("Indicador não encontrado");
    if (!meta.ativo) throw conflict("Este indicador já está inativo");

    const metaInativada = await prisma.meta.update({
      where: { id: meta.id },
      data: { ativo: false, inativadoEm: new Date(), inativadoPor: usuario.id },
      include: includeRelacoes,
    });

    if (meta.icIv === "IC") {
      await prisma.meta.updateMany({
        where: { paiId: meta.id, ativo: true },
        data: { ativo: false, inativadoEm: new Date(), inativadoPor: usuario.id },
      });
    }

    await registrarAuditoria(req, {
      acao: "UPDATE",
      tabela: "metas",
      registroId: meta.id,
      setorId: meta.setorId,
      detalhes: { acao: "inativado", motivo: typeof req.body?.motivo === "string" ? req.body.motivo : null },
    });

    res.json({ data: serializeMeta(metaInativada), mensagem: "Indicador inativado com sucesso" });
  } catch (err) {
    next(err);
  }
});

metasRouter.patch("/:id/ativar", authorize("gerente"), async (req, res, next) => {
  try {
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!meta) throw notFound("Indicador não encontrado");
    if (meta.ativo) throw conflict("Este indicador já está ativo");

    const metaAtivada = await prisma.meta.update({
      where: { id: meta.id },
      data: { ativo: true, inativadoEm: null, inativadoPor: null },
      include: includeRelacoes,
    });

    await registrarAuditoria(req, {
      acao: "UPDATE",
      tabela: "metas",
      registroId: meta.id,
      setorId: meta.setorId,
      detalhes: { acao: "ativado" },
    });

    res.json({ data: serializeMeta(metaAtivada), mensagem: "Indicador ativado com sucesso" });
  } catch (err) {
    next(err);
  }
});

const mesLowerParaMesKey: Record<string, MesKey> = Object.fromEntries(
  MESES.map((mes) => [mes.toLowerCase(), mes])
);

const acumuladoPeriodoQuerySchema = z.object({
  mes_inicio: z.enum(MESES.map((mes) => mes.toLowerCase()) as [string, ...string[]]),
  mes_fim: z.enum(MESES.map((mes) => mes.toLowerCase()) as [string, ...string[]]),
});

metasRouter.get("/:id/acumulado-periodo", async (req, res, next) => {
  try {
    const query = acumuladoPeriodoQuerySchema.parse(req.query);
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!meta) throw notFound("Meta não encontrada");

    const mesInicio = mesLowerParaMesKey[query.mes_inicio];
    const mesFim = mesLowerParaMesKey[query.mes_fim];

    let resultado;
    try {
      resultado = calcularAcumuladoPeriodo(meta, mesInicio, mesFim);
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : "Período inválido");
    }

    res.json({
      id: meta.id,
      indicador: meta.indicador,
      periodo: {
        mes_inicio: query.mes_inicio,
        mes_fim: query.mes_fim,
        quantidade_meses: resultado.mesesPeriodo.length,
      },
      acumulados: {
        meta: resultado.acumMeta,
        real: resultado.acumReal,
        percentual: resultado.percentual,
        status: resultado.status,
      },
      detalhes: resultado.detalhes.map((d) => ({
        mes: d.mes.toLowerCase(),
        meta: d.meta,
        real: d.real,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const mesEnum = z.enum(MESES.map((mes) => mes.toLowerCase()) as [string, ...string[]]);

const comparativoQuerySchema = z.object({
  periodo_tipo: z.enum(["mes", "intervalo", "trimestre", "semestre", "ano"]),
  mes: mesEnum.optional(),
  mes_inicio: mesEnum.optional(),
  mes_fim: mesEnum.optional(),
  trimestre: z.coerce.number().int().min(1).max(4).optional(),
  semestre: z.coerce.number().int().min(1).max(2).optional(),
  ano_comparacao: z.coerce.number().int().optional(),
});

/** Compara o acumulado de um indicador em um período (mês/intervalo/trimestre/semestre/ano)
 * com o mesmo período de outro ano. Como cada linha da tabela metas pertence a um único ano,
 * o "outro ano" é resolvido buscando uma linha com o mesmo (setor, indicador, ic_iv) — não há
 * um id estável entre anos, então o pareamento é por nome do indicador dentro do setor. */
metasRouter.get("/:id/comparativo", async (req, res, next) => {
  try {
    const usuario = req.usuario!;
    const query = comparativoQuerySchema.parse(req.query);

    const meta = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!meta) throw notFound("Meta não encontrada");
    if (usuario.role === "responsavel" && meta.setorId !== usuario.setorId) {
      throw forbidden("Acesso negado a outro setor");
    }

    let intervalo;
    try {
      intervalo = resolverIntervaloMeses(query.periodo_tipo, {
        mes: query.mes ? mesLowerParaMesKey[query.mes] : undefined,
        mesInicio: query.mes_inicio ? mesLowerParaMesKey[query.mes_inicio] : undefined,
        mesFim: query.mes_fim ? mesLowerParaMesKey[query.mes_fim] : undefined,
        trimestre: query.trimestre,
        semestre: query.semestre,
      });
    } catch (err) {
      throw badRequest(err instanceof Error ? err.message : "Período inválido");
    }

    const anoComparacao = query.ano_comparacao ?? meta.ano - 1;
    const metaComparacao =
      anoComparacao === meta.ano
        ? null
        : await prisma.meta.findFirst({
            where: { setorId: meta.setorId, ano: anoComparacao, indicador: meta.indicador, icIv: meta.icIv, ativo: true },
          });

    const principal = calcularAcumuladoPeriodo(meta, intervalo.mesInicio, intervalo.mesFim);
    const comparacao = metaComparacao ? calcularAcumuladoPeriodo(metaComparacao, intervalo.mesInicio, intervalo.mesFim) : null;

    const realDelta =
      comparacao && principal.acumReal != null && comparacao.acumReal != null
        ? principal.acumReal.minus(comparacao.acumReal)
        : null;
    const metaDelta =
      comparacao && principal.acumMeta != null && comparacao.acumMeta != null
        ? principal.acumMeta.minus(comparacao.acumMeta)
        : null;
    const realDeltaPercentual =
      realDelta != null && comparacao?.acumReal != null && !comparacao.acumReal.isZero()
        ? realDelta.div(comparacao.acumReal).mul(100).toDecimalPlaces(2)
        : null;
    const metaDeltaPercentual =
      metaDelta != null && comparacao?.acumMeta != null && !comparacao.acumMeta.isZero()
        ? metaDelta.div(comparacao.acumMeta).mul(100).toDecimalPlaces(2)
        : null;

    const serieMeses = MESES.map((mes) => ({
      mes: mes.toLowerCase(),
      periodo_principal: { meta: meta[campoMeta(mes)], real: meta[campoReal(mes)] },
      periodo_comparacao: metaComparacao
        ? { meta: metaComparacao[campoMeta(mes)], real: metaComparacao[campoReal(mes)] }
        : { meta: null, real: null },
    }));

    await registrarAuditoria(req, {
      acao: "READ",
      tabela: "metas",
      registroId: meta.id,
      setorId: meta.setorId,
      detalhes: {
        evento: "comparativo_consultado",
        periodo_tipo: query.periodo_tipo,
        ano_principal: meta.ano,
        ano_comparacao: anoComparacao,
      },
    });

    res.json({
      meta_id: meta.id,
      indicador: meta.indicador,
      periodo_principal: {
        label: `${intervalo.label} ${meta.ano}`,
        tipo: query.periodo_tipo,
        ano: meta.ano,
        meta_acum: principal.acumMeta,
        real_acum: principal.acumReal,
        percentual_execucao: principal.percentual,
        status: principal.status,
      },
      periodo_comparacao: comparacao
        ? {
            label: `${intervalo.label} ${anoComparacao}`,
            tipo: query.periodo_tipo,
            ano: anoComparacao,
            meta_acum: comparacao.acumMeta,
            real_acum: comparacao.acumReal,
            percentual_execucao: comparacao.percentual,
            status: comparacao.status,
          }
        : null,
      variacao: comparacao
        ? {
            real_delta: realDelta,
            real_delta_percentual: realDeltaPercentual,
            meta_delta: metaDelta,
            meta_delta_percentual: metaDeltaPercentual,
          }
        : null,
      serie_meses: serieMeses,
    });
  } catch (err) {
    next(err);
  }
});

metasRouter.get("/:id/historico", async (req, res, next) => {
  try {
    const usuario = req.usuario!;
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!meta) throw notFound("Meta não encontrada");

    if (usuario.role !== "admin" && meta.setorId !== usuario.setorId) {
      throw forbidden("Acesso negado a outro setor");
    }

    const historicos = await prisma.metaHistorico.findMany({
      where: { metasId: meta.id },
      include: { alteradoPorUsuario: true },
      orderBy: { versao: "desc" },
    });

    res.json({
      meta_id: meta.id,
      indicador: meta.indicador,
      historico: historicos.map((h) => ({
        versao: h.versao,
        alterado_em: h.alteradoEm,
        alterado_por: h.alteradoPorUsuario?.nome ?? null,
        motivo: h.motivo,
        valores_antes: h.valoresAntes,
        valores_depois: h.valoresDepois,
      })),
    });
  } catch (err) {
    next(err);
  }
});

const historicoPeriodoQuerySchema = z.object({
  ano: z.coerce.number().int(),
});

metasRouter.get("/:id/historico-periodo", async (req, res, next) => {
  try {
    const usuario = req.usuario!;
    const query = historicoPeriodoQuerySchema.parse(req.query);

    const meta = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!meta) throw notFound("Meta não encontrada");

    if (usuario.role !== "admin" && meta.setorId !== usuario.setorId) {
      throw forbidden("Acesso negado a outro setor");
    }

    const inicioAno = new Date(Date.UTC(query.ano, 0, 1));
    const fimAno = new Date(Date.UTC(query.ano + 1, 0, 1));

    const historicos = await prisma.metaHistorico.findMany({
      where: { metasId: meta.id, alteradoEm: { gte: inicioAno, lt: fimAno } },
      orderBy: { alteradoEm: "asc" },
    });

    const versoes = historicos.map((h) => {
      const depois = h.valoresDepois as Record<string, unknown>;
      const meses = MESES.map((mes) => ({
        mes: mes.toLowerCase(),
        meta: depois[`meta${mes}`] ?? null,
        real: depois[`real${mes}`] ?? null,
        status: depois[`status${mes}`] ?? null,
      }));
      return {
        versao: h.versao,
        data_alteracao: h.alteradoEm,
        meses,
      };
    });

    res.json({
      meta_id: meta.id,
      indicador: meta.indicador,
      ano: query.ano,
      versoes,
    });
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
  produto_id: z.string().uuid().optional(),
  ic_iv: z.nativeEnum(IcIv),
  pai_id: z.string().uuid().optional(),
  indicador: z.string().min(1),
  responsavel: z.string().min(1),
  unidade: z.string().min(1),
  tipo_meta: z.enum(["maior_melhor", "menor_melhor"]),
  agrega_filhos: z.boolean().default(false),
  tipo_acumulado: z.enum(["soma", "media"]).default("soma"),
  // OS-009: regras de agregação do IC a partir dos filhos (só relevante quando agrega_filhos=true)
  tipo_agregacao_meta: z.enum(["soma", "media", "meta_manual"]).default("soma"),
  tipo_agregacao_real: z.enum(["soma", "media", "proporcao_agregada"]).default("soma"),
  meta_manual_acum: z.number().optional(),
  meta_ano: z.number().optional(),
  meta: mesesSchema.optional(),
});

metasRouter.post("/", authorize("gerente"), async (req, res, next) => {
  try {
    const body = criarMetaSchema.parse(req.body);
    const usuario = req.usuario!;

    if (body.ic_iv === "IV" && !body.pai_id) {
      throw badRequest("IVs devem ter um IC pai (pai_id)");
    }
    if (body.ic_iv === "IC" && body.pai_id) {
      throw badRequest("ICs não podem ter pai_id");
    }
    if (body.agrega_filhos && body.tipo_agregacao_meta === "meta_manual" && body.meta_manual_acum == null) {
      throw badRequest("tipo_agregacao_meta 'meta_manual' requer o campo meta_manual_acum");
    }

    const meta = await prisma.meta.create({
      data: {
        setorId: body.setor_id,
        ano: body.ano,
        ordem: body.ordem,
        produtoId: body.produto_id,
        icIv: body.ic_iv,
        paiId: body.pai_id,
        indicador: body.indicador,
        responsavel: body.responsavel,
        unidade: body.unidade,
        tipoMeta: body.tipo_meta,
        agregaFilhos: body.agrega_filhos,
        tipoAcumulado: body.tipo_acumulado,
        tipoAgregacaoMeta: body.tipo_agregacao_meta,
        tipoAgregacaoReal: body.tipo_agregacao_real,
        metaManualAcum: body.meta_manual_acum,
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
  produto_id: z.string().uuid().nullable().optional(),
});

metasRouter.put("/:id/meta", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const body = editarMetaSchema.parse(req.body);
    const usuario = req.usuario!;

    const metaAtual = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!metaAtual) throw notFound("Meta não encontrada");

    // tipo_agregacao_meta="meta_manual": Meta é digitada mês a mês pelo gerente mesmo com
    // agrega_filhos=true (só o Real é calculado automaticamente dos filhos, nesse caso).
    if (metaAtual.agregaFilhos && metaAtual.tipoAgregacaoMeta !== "meta_manual") {
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
        produtoId: body.produto_id,
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

const editarMetaManualSchema = z.object({
  meta_manual_acum: z.number(),
});

// tipo_agregacao_meta="meta_manual" agora significa que a Meta é digitada mês a mês
// diretamente na tabela (via PUT /:id/meta) — meta_manual_acum não é mais usado no cálculo
// de acum_meta (ver recalcularAgregadoIC), então esta rota só existe para dar um erro claro
// a quem ainda tentar editar por aqui (ex: UI antiga em cache).
metasRouter.put("/:id/meta-manual", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    editarMetaManualSchema.parse(req.body);
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!meta) throw notFound("Meta não encontrada");
    if (!meta.agregaFilhos || meta.tipoAgregacaoMeta !== "meta_manual") {
      throw conflict("Este indicador não usa meta manual (tipo_agregacao_meta = meta_manual).");
    }
    throw conflict("A meta deste indicador é editada mês a mês diretamente na tabela, não como um valor único acumulado.");
  } catch (err) {
    next(err);
  }
});

const editarRealSchema = z.object({
  real: mesesSchema,
});

metasRouter.put("/:id/real", authorize("responsavel", "gerente", "admin"), async (req, res, next) => {
  try {
    const body = editarRealSchema.parse(req.body);
    const usuario = req.usuario!;

    const metaAtual = await prisma.meta.findUnique({ where: { id: req.params.id } });
    if (!metaAtual) throw notFound("Meta não encontrada");

    if (usuario.role !== "admin" && metaAtual.setorId !== usuario.setorId) {
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
        const filhos = await prisma.meta.findMany({ where: { paiId: pai.id, ativo: true } });
        const agregado = recalcularAgregadoIC(filhos, {
          tipoAgregacaoMeta: pai.tipoAgregacaoMeta,
          tipoAgregacaoReal: pai.tipoAgregacaoReal,
          metaManualAcum: pai.metaManualAcum,
        });
        const dataMeses = Object.fromEntries([
          ...MESES.map((mes) => [`meta${mes}`, agregado.metaPorMes ? agregado.metaPorMes[mes] : undefined]),
          ...MESES.map((mes) => [`real${mes}`, agregado.realPorMes[mes]]),
        ]);
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
