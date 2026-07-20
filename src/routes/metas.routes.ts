import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, resolveSetorId } from "../middleware/auth";
import { badRequest, conflict, forbidden, notFound } from "../lib/errors";
import { registrarAuditoria } from "../lib/auditoria";
import { MetaComRelacoes, serializeMeta } from "../lib/serializers";
import {
  calcularAcumuladoLinha,
  calcularAcumuladoPeriodo,
  campoMeta,
  campoReal,
  MESES,
  MesKey,
  MetaComIndicador,
  recalcularAgregadoIC,
  resolverIntervaloMeses,
} from "../lib/metasCalc";

export const metasRouter = Router();
metasRouter.use(authenticate);

const includeRelacoes = {
  setor: true,
  atualizadoPorUsuario: true,
  inativadoPorUsuario: true,
  indicador: { include: { produto: true } },
} satisfies Prisma.MetaInclude;

/** Metas filhas (mesmo ano) de um IC agregador — resolvidas via indicador.paiId, já que a
 * hierarquia agora vive em Indicador, não mais como self-relation direta em Meta. */
async function buscarFilhosMeta(indicadorId: string, ano: number, incluirInativos = false) {
  const filhosIndicadores = await prisma.indicador.findMany({ where: { paiId: indicadorId }, select: { id: true } });
  if (filhosIndicadores.length === 0) return [];
  return prisma.meta.findMany({
    where: {
      indicadorId: { in: filhosIndicadores.map((f) => f.id) },
      ano,
      ...(incluirInativos ? {} : { ativo: true }),
    },
    include: includeRelacoes,
  });
}

/** Se o indicador pai (do mesmo ano) agrega os filhos, recalcula seus meses/acumulados a
 * partir das metas filhas atuais e persiste. Retorna a linha de Meta do pai atualizada. */
async function recalcularPaiSeAgrega(paiIndicadorId: string, ano: number, usuarioId: string) {
  const paiIndicador = await prisma.indicador.findUnique({ where: { id: paiIndicadorId } });
  if (!paiIndicador || !paiIndicador.agregaFilhos) return null;

  const paiMeta = await prisma.meta.findFirst({ where: { indicadorId: paiIndicador.id, ano } });
  if (!paiMeta) return null;

  const filhos = await buscarFilhosMeta(paiIndicador.id, ano, false);
  const agregado = recalcularAgregadoIC(filhos, {
    tipoAgregacaoMeta: paiIndicador.tipoAgregacaoMeta,
    tipoAgregacaoReal: paiIndicador.tipoAgregacaoReal,
    metaManualAcum: paiMeta.metaManualAcum,
    realManualAcum: paiIndicador.realManualAcum,
  });

  const dataMeses = Object.fromEntries([
    // metaPorMes/realPorMes === null (meta_manual/real_manual): não sobrescrever os meses,
    // que continuam digitados manualmente pelo gerente — undefined faz o Prisma ignorar o campo.
    ...MESES.map((mes) => [`meta${mes}`, agregado.metaPorMes ? agregado.metaPorMes[mes] : undefined]),
    ...MESES.map((mes) => [`real${mes}`, agregado.realPorMes ? agregado.realPorMes[mes] : undefined]),
  ]);

  const paiAtualizado = await prisma.meta.update({
    where: { id: paiMeta.id },
    data: {
      ...dataMeses,
      acumMeta: agregado.acumMeta,
      acumReal: agregado.acumReal,
      atualizadoPor: usuarioId,
    },
    include: includeRelacoes,
  });

  return paiAtualizado;
}

/** pai_id na resposta da API precisa ser o id da linha de Meta (mesmo ano) do IC pai — não o
 * id do Indicador pai (outra tabela). Resolve essa linha para uso em serializeMeta(). */
async function resolverPaiMetaId(meta: MetaComRelacoes): Promise<string | null> {
  if (!meta.indicador.paiId) return null;
  const paiMeta = await prisma.meta.findFirst({
    where: { indicadorId: meta.indicador.paiId, ano: meta.ano },
    select: { id: true },
  });
  return paiMeta?.id ?? null;
}

/** Após alterar meta_x ou real_x de uma linha, recalcula seus acumulados e, se seu indicador
 * tiver um pai com agrega_filhos=true, recalcula os meses e acumulados do pai também. */
async function recalcularLinhaEPai(metaId: string, usuarioId: string) {
  const meta = await prisma.meta.findUniqueOrThrow({ where: { id: metaId }, include: includeRelacoes });

  await prisma.meta.update({
    where: { id: meta.id },
    data: {
      acumMeta: calcularAcumuladoLinha(meta, "meta"),
      acumReal: calcularAcumuladoLinha(meta, "real"),
      atualizadoPor: usuarioId,
    },
  });

  if (!meta.indicador.paiId) return null;
  return recalcularPaiSeAgrega(meta.indicador.paiId, meta.ano, usuarioId);
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

    // Filhos e pai_id resolvidos em memória: todas as metas do setor/ano já foram carregadas
    // juntas, então dá pra casar indicador_id <-> meta.id sem consultas extras.
    const metaIdPorIndicadorId = new Map(metas.map((m) => [m.indicadorId, m.id]));
    const porIndicadorPai = new Map<string, MetaComRelacoes[]>();
    for (const m of metas) {
      if (!m.indicador.paiId) continue;
      const lista = porIndicadorPai.get(m.indicador.paiId) ?? [];
      lista.push(m);
      porIndicadorPai.set(m.indicador.paiId, lista);
    }

    res.json({
      data: metas.map((m) =>
        serializeMeta(m, {
          paiMetaId: m.indicador.paiId ? metaIdPorIndicadorId.get(m.indicador.paiId) ?? null : null,
          filhos: m.indicador.icIv === "IC" ? porIndicadorPai.get(m.indicadorId) ?? [] : undefined,
        })
      ),
    });
  } catch (err) {
    next(err);
  }
});

const anosDisponiveisQuerySchema = z.object({
  setor_id: z.string().uuid().optional(),
});

metasRouter.get("/anos-disponiveis", async (req, res, next) => {
  try {
    const query = anosDisponiveisQuerySchema.parse(req.query);
    const setorId = resolveSetorId(req.usuario!, query.setor_id);

    const linhas = await prisma.meta.findMany({
      where: { setorId, ativo: true },
      select: { ano: true },
      distinct: ["ano"],
      orderBy: { ano: "desc" },
    });

    res.json(linhas.map((l) => l.ano));
  } catch (err) {
    next(err);
  }
});

metasRouter.patch("/:id/inativar", authorize("gerente"), async (req, res, next) => {
  try {
    const usuario = req.usuario!;
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id }, include: includeRelacoes });
    if (!meta) throw notFound("Indicador não encontrado");
    if (!meta.ativo) throw conflict("Este indicador já está inativo");

    const metaInativada = await prisma.meta.update({
      where: { id: meta.id },
      data: { ativo: false, inativadoEm: new Date(), inativadoPor: usuario.id },
      include: includeRelacoes,
    });

    if (meta.indicador.icIv === "IC") {
      const filhos = await buscarFilhosMeta(meta.indicadorId, meta.ano, false);
      await prisma.meta.updateMany({
        where: { id: { in: filhos.map((f) => f.id) } },
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

    res.json({
      data: serializeMeta(metaInativada, { paiMetaId: await resolverPaiMetaId(metaInativada) }),
      mensagem: "Indicador inativado com sucesso",
    });
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

    res.json({
      data: serializeMeta(metaAtivada, { paiMetaId: await resolverPaiMetaId(metaAtivada) }),
      mensagem: "Indicador ativado com sucesso",
    });
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
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id }, include: includeRelacoes });
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
      indicador: meta.indicador.nome,
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
  // Lista de anos separados por vírgula (ex: "2023,2024"). Ausente = default (ano anterior).
  // String vazia "" = nenhum ano de comparação (só o principal).
  anos_comparacao: z.string().optional(),
});

/** Compara o acumulado de um indicador em um período (mês/intervalo/trimestre/semestre/ano)
 * com o mesmo período de um ou mais anos adicionais. OS-013: como o indicador agora é uma
 * entidade estável entre anos, o pareamento é direto por indicador_id — não precisa mais
 * casar por nome de texto dentro do setor. */
metasRouter.get("/:id/comparativo", async (req, res, next) => {
  try {
    const usuario = req.usuario!;
    const query = comparativoQuerySchema.parse(req.query);

    const meta = await prisma.meta.findUnique({ where: { id: req.params.id }, include: includeRelacoes });
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

    const anosComparacao = [
      ...new Set(
        (query.anos_comparacao !== undefined
          ? query.anos_comparacao
              .split(",")
              .map((s) => parseInt(s.trim(), 10))
              .filter((n) => Number.isFinite(n))
          : [meta.ano - 1]
        ).filter((ano) => ano !== meta.ano)
      ),
    ];

    const metasComparacao =
      anosComparacao.length > 0
        ? await prisma.meta.findMany({
            where: { indicadorId: meta.indicadorId, ano: { in: anosComparacao }, ativo: true },
            include: includeRelacoes,
          })
        : [];

    const metasPorAno = new Map<number, MetaComIndicador>();
    metasPorAno.set(meta.ano, meta);
    for (const m of metasComparacao) metasPorAno.set(m.ano, m);

    // Mantém a ordem: principal primeiro, depois os anos de comparação encontrados (na ordem pedida).
    const anos = [meta.ano, ...anosComparacao.filter((ano) => metasPorAno.has(ano))];

    const periodos = anos.map((ano) => {
      const linha = metasPorAno.get(ano)!;
      const calc = calcularAcumuladoPeriodo(linha, intervalo.mesInicio, intervalo.mesFim);
      return {
        ano,
        label: `${intervalo.label} ${ano}`,
        meta_acum: calc.acumMeta,
        real_acum: calc.acumReal,
        percentual_execucao: calc.percentual,
        status: calc.status,
      };
    });

    const serieMeses = MESES.map((mes) => {
      const valores: Record<number, { meta: unknown; real: unknown }> = {};
      for (const ano of anos) {
        const linha = metasPorAno.get(ano)!;
        valores[ano] = { meta: linha[campoMeta(mes)], real: linha[campoReal(mes)] };
      }
      return { mes: mes.toLowerCase(), valores };
    });

    await registrarAuditoria(req, {
      acao: "READ",
      tabela: "metas",
      registroId: meta.id,
      setorId: meta.setorId,
      detalhes: { evento: "comparativo_consultado", periodo_tipo: query.periodo_tipo, anos },
    });

    res.json({
      meta_id: meta.id,
      indicador: meta.indicador.nome,
      unidade: meta.indicador.unidade,
      ano_principal: meta.ano,
      anos,
      periodos,
      serie_meses: serieMeses,
    });
  } catch (err) {
    next(err);
  }
});

metasRouter.get("/:id/historico", async (req, res, next) => {
  try {
    const usuario = req.usuario!;
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id }, include: includeRelacoes });
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
      indicador: meta.indicador.nome,
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

    const meta = await prisma.meta.findUnique({ where: { id: req.params.id }, include: includeRelacoes });
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
      indicador: meta.indicador.nome,
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
  indicador_id: z.string().uuid(),
  ano: z.coerce.number().int(),
  ordem: z.number().int().default(0),
  responsavel: z.string().min(1),
  tipo_meta: z.enum(["maior_melhor", "menor_melhor"]),
  meta_manual_acum: z.number().optional(),
  // OS-015: valor fixo de acumulado, obrigatório quando o indicador usa acumulado manual nesse
  // lado (tipo_acumulado_meta/tipo_acumulado_real="manual" numa linha simples, ou — só pro
  // lado Real — tipo_agregacao_real="real_manual" num IC agregador).
  acum_meta_manual: z.number().optional(),
  acum_real_manual: z.number().optional(),
  meta_ano: z.number().optional(),
  meta: mesesSchema.optional(),
});

metasRouter.post("/", authorize("gerente"), async (req, res, next) => {
  try {
    const body = criarMetaSchema.parse(req.body);
    const usuario = req.usuario!;

    const indicador = await prisma.indicador.findUnique({ where: { id: body.indicador_id } });
    if (!indicador) throw notFound("Indicador não encontrado");
    if (!indicador.ativo) throw conflict("Este indicador está inativo");
    resolveSetorId(usuario, indicador.setorId);

    const existente = await prisma.meta.findFirst({ where: { indicadorId: indicador.id, ano: body.ano } });
    if (existente) throw conflict("Já existe uma meta para este indicador neste ano");

    if (indicador.agregaFilhos && indicador.tipoAgregacaoMeta === "meta_manual" && body.meta_manual_acum == null) {
      throw badRequest("tipo_agregacao_meta 'meta_manual' requer o campo meta_manual_acum");
    }
    if (indicador.tipoAcumuladoMeta === "manual" && body.acum_meta_manual == null) {
      throw badRequest("Este indicador usa acumulado manual da Meta e requer o campo acum_meta_manual");
    }
    const usaRealManual =
      indicador.tipoAcumuladoReal === "manual" || (indicador.agregaFilhos && indicador.tipoAgregacaoReal === "real_manual");
    if (usaRealManual && body.acum_real_manual == null) {
      throw badRequest("Este indicador usa acumulado manual do Real e requer o campo acum_real_manual");
    }

    const meta = await prisma.meta.create({
      data: {
        setorId: indicador.setorId,
        indicadorId: indicador.id,
        ano: body.ano,
        ordem: body.ordem,
        responsavel: body.responsavel,
        tipoMeta: body.tipo_meta,
        metaManualAcum: body.meta_manual_acum,
        acumMetaManual: body.acum_meta_manual,
        acumRealManual: body.acum_real_manual,
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
      include: includeRelacoes,
    });

    await registrarAuditoria(req, {
      acao: "CREATE",
      tabela: "metas",
      registroId: meta.id,
      setorId: meta.setorId,
    });

    const paiAtualizado = await recalcularLinhaEPai(meta.id, usuario.id);

    res.status(201).json({
      ...serializeMeta(meta, { paiMetaId: await resolverPaiMetaId(meta) }),
      ...(paiAtualizado ? { pai_atualizado: serializeMeta(paiAtualizado) } : {}),
    });
  } catch (err) {
    next(err);
  }
});

const editarMetaSchema = z.object({
  meta_ano: z.number().optional(),
  meta: mesesSchema.optional(),
  // OS-015: edição dos valores fixos de acumulado (indicador.tipo_acumulado_meta/
  // tipo_acumulado_real="manual", ou — só pro lado Real — tipo_agregacao_real="real_manual"
  // num IC agregador). Independentes da Meta mês a mês — não bloqueados pelo guard de "IC
  // agrega os filhos" abaixo, que só se aplica a meta_ano/meta.
  acum_meta_manual: z.number().optional(),
  acum_real_manual: z.number().optional(),
});

metasRouter.put("/:id/meta", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const body = editarMetaSchema.parse(req.body);
    const usuario = req.usuario!;

    const metaAtual = await prisma.meta.findUnique({ where: { id: req.params.id }, include: includeRelacoes });
    if (!metaAtual) throw notFound("Meta não encontrada");

    // tipo_agregacao_meta="meta_manual": Meta é digitada mês a mês pelo gerente mesmo com
    // agrega_filhos=true (só o Real é calculado automaticamente dos filhos, nesse caso).
    const alterandoMeta = body.meta_ano !== undefined || body.meta !== undefined;
    if (alterandoMeta && metaAtual.indicador.agregaFilhos && metaAtual.indicador.tipoAgregacaoMeta !== "meta_manual") {
      throw conflict("Este IC agrega os valores dos filhos automaticamente e não pode ser editado diretamente.");
    }

    if (body.acum_meta_manual !== undefined && metaAtual.indicador.tipoAcumuladoMeta !== "manual") {
      throw badRequest("Este indicador não usa acumulado manual da Meta (acum_meta_manual)");
    }
    if (body.acum_real_manual !== undefined) {
      const usaRealManual =
        metaAtual.indicador.tipoAcumuladoReal === "manual" ||
        (metaAtual.indicador.agregaFilhos && metaAtual.indicador.tipoAgregacaoReal === "real_manual");
      if (!usaRealManual) {
        throw badRequest("Este indicador não usa acumulado manual do Real (acum_real_manual)");
      }
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
        acumMetaManual: body.acum_meta_manual,
        acumRealManual: body.acum_real_manual,
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
      ...serializeMeta(metaFinal, { paiMetaId: await resolverPaiMetaId(metaFinal) }),
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
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id }, include: includeRelacoes });
    if (!meta) throw notFound("Meta não encontrada");
    if (!meta.indicador.agregaFilhos || meta.indicador.tipoAgregacaoMeta !== "meta_manual") {
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

    const metaAtual = await prisma.meta.findUnique({ where: { id: req.params.id }, include: includeRelacoes });
    if (!metaAtual) throw notFound("Meta não encontrada");

    if (usuario.role !== "admin" && metaAtual.setorId !== usuario.setorId) {
      throw forbidden("Acesso negado a outro setor");
    }

    if (metaAtual.indicador.agregaFilhos) {
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
      ...serializeMeta(metaFinal, { paiMetaId: await resolverPaiMetaId(metaFinal) }),
      ...(paiAtualizado ? { pai_atualizado: serializeMeta(paiAtualizado) } : {}),
    });
  } catch (err) {
    next(err);
  }
});

metasRouter.delete("/:id", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const usuario = req.usuario!;
    const meta = await prisma.meta.findUnique({ where: { id: req.params.id }, include: includeRelacoes });
    if (!meta) throw notFound("Meta não encontrada");

    await prisma.$transaction(async (tx) => {
      const filhosIndicadores =
        meta.indicador.icIv === "IC"
          ? await tx.indicador.findMany({ where: { paiId: meta.indicadorId }, select: { id: true } })
          : [];
      const filhosMetas =
        filhosIndicadores.length > 0
          ? await tx.meta.findMany({
              where: { indicadorId: { in: filhosIndicadores.map((f) => f.id) }, ano: meta.ano },
              select: { id: true },
            })
          : [];
      const idsParaRemover = [meta.id, ...filhosMetas.map((f) => f.id)];

      await tx.metaHistorico.deleteMany({ where: { metasId: { in: idsParaRemover } } });
      await tx.meta.deleteMany({ where: { id: { in: idsParaRemover } } });
    });

    await registrarAuditoria(req, {
      acao: "DELETE",
      tabela: "metas",
      registroId: meta.id,
      setorId: meta.setorId,
    });

    const paiAtualizado = meta.indicador.paiId
      ? await recalcularPaiSeAgrega(meta.indicador.paiId, meta.ano, usuario.id)
      : null;

    res.status(200).json(paiAtualizado ? { pai_atualizado: serializeMeta(paiAtualizado) } : {});
  } catch (err) {
    next(err);
  }
});

// OS-008: importação em massa de indicadores (e opcionalmente produtos) de um ano para outro.
const LIMITE_METAS_IMPORTACAO = 1000;

const importarAnoSchema = z.object({
  ano_origem: z.coerce.number().int(),
  ano_destino: z.coerce.number().int(),
  copiar_metas: z.boolean().default(true),
  copiar_produtos: z.boolean().default(false),
  setor_id: z.string().uuid().optional(),
  ajuste_percentual: z.number().default(0),
  // Se o ano destino já tiver indicadores ativos, a importação é recusada (409) a menos que
  // o chamador confirme explicitamente a substituição.
  confirmar_sobrescrever: z.boolean().default(false),
});

metasRouter.post("/importar-ano", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const body = importarAnoSchema.parse(req.body);
    const usuario = req.usuario!;
    const setorId = resolveSetorId(usuario, body.setor_id);

    if (body.ano_origem === body.ano_destino) {
      throw badRequest("Ano de origem e ano de destino devem ser diferentes");
    }

    // OS-013: indicadores (nome/hierarquia/unidade) já existem independente do ano — "importar"
    // um ano só precisa criar as linhas de Meta (valores mensais) para esse ano, reaproveitando
    // os indicadores existentes. Não há mais indicadores a duplicar, só metas.
    const metasOrigem = await prisma.meta.findMany({
      where: { setorId, ano: body.ano_origem, ativo: true },
      include: { indicador: true },
      orderBy: { ordem: "asc" },
    });
    if (metasOrigem.length === 0) {
      throw badRequest("Ano de origem não possui indicadores ativos para este setor");
    }
    if (metasOrigem.length > LIMITE_METAS_IMPORTACAO) {
      throw badRequest(`Limite de ${LIMITE_METAS_IMPORTACAO} indicadores por importação excedido`);
    }

    const metasDestinoExistentes = await prisma.meta.count({
      where: { setorId, ano: body.ano_destino, ativo: true },
    });
    if (metasDestinoExistentes > 0 && !body.confirmar_sobrescrever) {
      throw conflict(
        `O ano ${body.ano_destino} já possui ${metasDestinoExistentes} indicador(es) ativo(s). Envie confirmar_sobrescrever=true para substituí-los.`
      );
    }

    const produtosOrigem = body.copiar_produtos
      ? await prisma.produto.findMany({ where: { setorId, status: "ativo" } })
      : [];

    const fator = new Decimal(1).plus(new Decimal(body.ajuste_percentual).div(100));
    const aplicarAjuste = (valor: Decimal | null): Decimal | null | undefined =>
      body.copiar_metas ? (valor != null ? valor.mul(fator) : null) : undefined;

    const avisos: string[] = [];
    let produtosImportados = 0;

    const novasMetas = await prisma.$transaction(async (tx) => {
      if (metasDestinoExistentes > 0 && body.confirmar_sobrescrever) {
        const idsExistentes = (
          await tx.meta.findMany({ where: { setorId, ano: body.ano_destino }, select: { id: true } })
        ).map((m) => m.id);
        await tx.metaHistorico.deleteMany({ where: { metasId: { in: idsExistentes } } });
        await tx.meta.deleteMany({ where: { id: { in: idsExistentes } } });
      }

      // Produto não é escopado por ano — já vale para qualquer ano do setor. "Copiar produtos"
      // só cria os que ainda não existem por nome; os demais já se aplicam ao ano de destino.
      for (const produto of produtosOrigem) {
        const existente = await tx.produto.findFirst({ where: { nome: produto.nome, setorId } });
        if (existente) {
          avisos.push(`Produto '${produto.nome}' não foi importado pois já existe neste setor`);
          continue;
        }
        await tx.produto.create({
          data: {
            nome: produto.nome,
            descricao: produto.descricao,
            setorId,
            status: produto.status,
            criadoPor: usuario.id,
          },
        });
        produtosImportados++;
      }

      const criadas: Prisma.MetaGetPayload<{}>[] = [];

      for (const meta of metasOrigem) {
        // Indicador também não é escopado por ano — reaproveita o mesmo indicador_id no
        // ano de destino. Se já existir uma linha de Meta para esse indicador+ano (corrida
        // rara dentro da mesma transação), pula com aviso em vez de violar unicidade.
        const jaExiste = await tx.meta.findFirst({ where: { indicadorId: meta.indicadorId, ano: body.ano_destino } });
        if (jaExiste) {
          avisos.push(`Indicador '${meta.indicador.nome}' já possui meta em ${body.ano_destino}, não foi reimportado`);
          continue;
        }

        const novaMeta = await tx.meta.create({
          data: {
            setorId,
            indicadorId: meta.indicadorId,
            ano: body.ano_destino,
            ordem: meta.ordem,
            responsavel: meta.responsavel,
            tipoMeta: meta.tipoMeta,
            metaManualAcum: aplicarAjuste(meta.metaManualAcum),
            metaAno: aplicarAjuste(meta.metaAno),
            metaJan: aplicarAjuste(meta.metaJan),
            metaFev: aplicarAjuste(meta.metaFev),
            metaMar: aplicarAjuste(meta.metaMar),
            metaAbr: aplicarAjuste(meta.metaAbr),
            metaMai: aplicarAjuste(meta.metaMai),
            metaJun: aplicarAjuste(meta.metaJun),
            metaJul: aplicarAjuste(meta.metaJul),
            metaAgo: aplicarAjuste(meta.metaAgo),
            metaSet: aplicarAjuste(meta.metaSet),
            metaOut: aplicarAjuste(meta.metaOut),
            metaNov: aplicarAjuste(meta.metaNov),
            metaDez: aplicarAjuste(meta.metaDez),
            atualizadoPor: usuario.id,
          },
        });

        criadas.push(novaMeta);
      }

      // Acum_meta de cada linha nova (real fica vazio no ano importado).
      for (const meta of criadas) {
        const indicador = metasOrigem.find((m) => m.indicadorId === meta.indicadorId)!.indicador;
        if (!(indicador.icIv === "IC" && indicador.agregaFilhos)) {
          await tx.meta.update({
            where: { id: meta.id },
            data: { acumMeta: calcularAcumuladoLinha({ ...meta, indicador }, "meta") },
          });
        }
      }
      // ICs que agregam filhos: recalcula a partir dos IVs recém-criados.
      for (const meta of criadas) {
        const indicador = metasOrigem.find((m) => m.indicadorId === meta.indicadorId)!.indicador;
        if (indicador.icIv === "IC" && indicador.agregaFilhos) {
          const filhosIndicadores = await tx.indicador.findMany({ where: { paiId: indicador.id }, select: { id: true } });
          const filhos = await tx.meta.findMany({
            where: { indicadorId: { in: filhosIndicadores.map((f) => f.id) }, ano: body.ano_destino },
          });
          const agregado = recalcularAgregadoIC(filhos, {
            tipoAgregacaoMeta: indicador.tipoAgregacaoMeta,
            tipoAgregacaoReal: indicador.tipoAgregacaoReal,
            metaManualAcum: meta.metaManualAcum,
            realManualAcum: indicador.realManualAcum,
          });
          const dataMeses = Object.fromEntries(
            MESES.map((mes) => [`meta${mes}`, agregado.metaPorMes ? agregado.metaPorMes[mes] : undefined])
          );
          await tx.meta.update({ where: { id: meta.id }, data: { ...dataMeses, acumMeta: agregado.acumMeta } });
        }
      }

      return criadas;
    });

    await Promise.all(
      novasMetas.map((meta) =>
        registrarAuditoria(req, {
          acao: "CREATE",
          tabela: "metas",
          registroId: meta.id,
          setorId,
          detalhes: { origem: "importacao_ano", ano_origem: body.ano_origem, ano_destino: body.ano_destino },
        })
      )
    );

    res.status(201).json({
      sucesso: true,
      metas_importadas: novasMetas.length,
      produtos_importados: produtosImportados,
      avisos,
      novas_meta_ids: novasMetas.map((m) => m.id),
    });
  } catch (err) {
    next(err);
  }
});
