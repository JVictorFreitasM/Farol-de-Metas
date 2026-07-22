import { Router } from "express";
import { z } from "zod";
import { Prisma, Meta } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, resolveSetorId } from "../middleware/auth";
import { badRequest, forbidden } from "../lib/errors";
import { MESES } from "../lib/metasCalc";
import { gerarWorkbookExcel } from "../lib/excelExport";

export const relatoriosRouter = Router();
relatoriosRouter.use(authenticate);

const dashboardQuerySchema = z.object({
  setor_id: z.string().uuid().optional(),
  ano: z.coerce.number().int(),
  periodo: z.enum(["mes", "trim", "semestre", "ano"]).default("ano"),
});

relatoriosRouter.get("/dashboard", async (req, res, next) => {
  try {
    const query = dashboardQuerySchema.parse(req.query);
    const setorId = resolveSetorId(req.usuario!, query.setor_id);

    const setor = await prisma.setor.findUnique({ where: { id: setorId } });
    const ivs = await prisma.meta.findMany({
      where: { setorId, ano: query.ano, ativo: true, indicador: { icIv: "IV" } },
      include: { indicador: true },
    });

    const totalIndicadores = ivs.length;
    const statusOk = ivs.filter((m) => m.statusAcum === "ok").length;
    const statusNok = ivs.filter((m) => m.statusAcum === "nok").length;
    const percentual = totalIndicadores > 0 ? (statusOk / totalIndicadores) * 100 : 0;

    const metasPorStatus = [
      { status: "ok", quantidade: statusOk, exemplos: ivs.filter((m) => m.statusAcum === "ok").slice(0, 5).map((m) => m.indicador.nome) },
      { status: "nok", quantidade: statusNok, exemplos: ivs.filter((m) => m.statusAcum === "nok").slice(0, 5).map((m) => m.indicador.nome) },
    ];

    const evolucaoMensal = MESES.map((mes) => {
      const statusCampo = `status${mes}` as keyof Meta;
      let ok = 0;
      let nok = 0;
      for (const meta of ivs) {
        if (meta[statusCampo] === "ok") ok++;
        else if (meta[statusCampo] === "nok") nok++;
      }
      return { mes: mes.toLowerCase(), status_ok: ok, status_nok: nok };
    });

    // Preenchimento (metas_incompletas) considera TODOS os indicadores (IC + IV) — diferente do
    // atingimento acima, que é só IV. Um IC sem "real" preenchido também é uma pendência real.
    const todos = await prisma.meta.findMany({
      where: { setorId, ano: query.ano, ativo: true },
      include: { indicador: true },
    });

    const hoje = new Date();
    const mesLimite = query.ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
    const metasIncompletas = todos
      .map((meta) => {
        const mesesFaltando = MESES.slice(0, mesLimite).filter((mes) => {
          const metaCampo = `meta${mes}` as keyof Meta;
          const realCampo = `real${mes}` as keyof Meta;
          return meta[metaCampo] == null || meta[realCampo] == null;
        });
        return {
          id: meta.id,
          indicador: meta.indicador.nome,
          responsavel: meta.responsavel,
          meses_faltando: mesesFaltando,
          quantidade_faltando: mesesFaltando.length,
        };
      })
      .filter((m) => m.quantidade_faltando > 0)
      .sort((a, b) => b.quantidade_faltando - a.quantidade_faltando);

    const ics = await prisma.meta.findMany({
      where: { setorId, ano: query.ano, ativo: true, indicador: { icIv: "IC" } },
      include: { indicador: true },
    });
    const ivsIndicadores = await prisma.indicador.findMany({
      where: { paiId: { in: ics.map((ic) => ic.indicadorId) } },
      select: { id: true, paiId: true },
    });
    const ivsMetas = await prisma.meta.findMany({
      where: { indicadorId: { in: ivsIndicadores.map((f) => f.id) }, ano: query.ano, ativo: true },
      include: { indicador: true },
    });
    const ivsPorPaiIndicadorId = new Map<string, typeof ivsMetas>();
    for (const ivMeta of ivsMetas) {
      const paiIndicadorId = ivsIndicadores.find((f) => f.id === ivMeta.indicadorId)?.paiId;
      if (!paiIndicadorId) continue;
      const lista = ivsPorPaiIndicadorId.get(paiIndicadorId) ?? [];
      lista.push(ivMeta);
      ivsPorPaiIndicadorId.set(paiIndicadorId, lista);
    }

    const icComProblemas = ics
      .map((ic) => {
        const ivs = ivsPorPaiIndicadorId.get(ic.indicadorId) ?? [];
        const ivsNok = ivs.filter((f) => f.statusAcum === "nok");
        return {
          indicador: ic.indicador.nome,
          unidade: ic.indicador.unidade,
          acumulado: ic.acumReal,
          meta_ano: ic.metaAno,
          percentual:
            ic.metaAno != null && ic.acumReal != null && !ic.metaAno.isZero()
              ? ic.acumReal.div(ic.metaAno).mul(100).toDecimalPlaces(1)
              : null,
          ivs_nok: ivsNok.map((f) => f.indicador.nome),
        };
      })
      .filter((ic) => ic.ivs_nok.length > 0);

    res.json({
      setor: setor?.nome,
      ano: query.ano,
      periodo: query.periodo,
      resumo: {
        total_indicadores: totalIndicadores,
        status_ok: statusOk,
        status_nok: statusNok,
        percentual_atingimento: Number(percentual.toFixed(2)),
      },
      metas_por_status: metasPorStatus,
      evolucao_mensal: evolucaoMensal,
      ic_com_problemas: icComProblemas,
      metas_incompletas: metasIncompletas,
    });
  } catch (err) {
    next(err);
  }
});

const comparativaQuerySchema = z.object({
  ano: z.coerce.number().int(),
  periodo: z.enum(["mes", "trim", "semestre", "ano"]).default("ano"),
  mes: z.enum(MESES.map((mes) => mes.toLowerCase()) as [string, ...string[]]).optional(),
});

relatoriosRouter.get("/comparativa", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const query = comparativaQuerySchema.parse(req.query);
    const mesKey = query.mes ? MESES.find((mes) => mes.toLowerCase() === query.mes) : undefined;

    const setores = await prisma.setor.findMany({ where: { ativo: true } });
    const resultado = [];

    for (const setor of setores) {
      const ivs = await prisma.meta.findMany({
        where: { setorId: setor.id, ano: query.ano, ativo: true, indicador: { icIv: "IV" } },
      });
      const totalIndicadores = ivs.length;
      const statusOk = ivs.filter((m) => m.statusAcum === "ok").length;
      const percentual = totalIndicadores > 0 ? (statusOk / totalIndicadores) * 100 : 0;

      let consolidacaoGeral: { percentual_preenchido: number; completo: boolean } | null = null;
      let metasPendentes: { id: string; indicador: string; ic_iv: string; responsavel: string }[] = [];
      if (mesKey) {
        // Preenchimento considera TODOS os indicadores (IC + IV) — diferente do % atingimento
        // acima, que é só IV. Um IC sem "real" preenchido também é uma pendência real.
        const todos = await prisma.meta.findMany({
          where: { setorId: setor.id, ano: query.ano, ativo: true },
          include: { indicador: true },
        });
        const realCampo = `real${mesKey}` as keyof Meta;
        const pendentes = todos.filter((m) => m[realCampo] == null);
        const preenchidas = todos.length - pendentes.length;
        const percentualPreenchido = todos.length > 0 ? (preenchidas / todos.length) * 100 : 0;
        consolidacaoGeral = {
          percentual_preenchido: Number(percentualPreenchido.toFixed(2)),
          completo: todos.length > 0 && pendentes.length === 0,
        };
        metasPendentes = pendentes.map((m) => ({
          id: m.id,
          indicador: m.indicador.nome,
          ic_iv: m.indicador.icIv,
          responsavel: m.responsavel,
        }));
      }

      resultado.push({
        setor_id: setor.id,
        nome_setor: setor.nome,
        total_indicadores: totalIndicadores,
        status_ok: statusOk,
        percentual_atingimento: Number(percentual.toFixed(2)),
        consolidacao_geral: consolidacaoGeral,
        metas_pendentes: metasPendentes,
      });
    }

    resultado.sort((a, b) => b.percentual_atingimento - a.percentual_atingimento);
    const comRanking = resultado.map((r, idx) => ({ ...r, ranking: idx + 1 }));

    res.json({ ano: query.ano, periodo: query.periodo, setores: comRanking });
  } catch (err) {
    next(err);
  }
});

function slugify(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

const exportarExcelQuerySchema = z.object({
  ano: z.coerce.number().int(),
  // CSV de UUIDs de setor. responsavel ignora/valida contra o próprio setor; gerente/admin
  // precisam informar explicitamente (não há um "todos" implícito no backend — o frontend
  // resolve "Selecionar todos" marcando cada checkbox e enviando a lista completa).
  setor_ids: z.string().optional(),
});

// OS: Exportação de Relatório Anual em Excel — reproduz o layout da planilha de referência do
// cliente (uma aba por setor selecionado), com hierarquia IC->IVs e status ok/nok por mês.
relatoriosRouter.get("/exportar-excel", async (req, res, next) => {
  try {
    const query = exportarExcelQuerySchema.parse(req.query);
    const usuario = req.usuario!;

    const idsInformados = query.setor_ids
      ? [...new Set(query.setor_ids.split(",").map((s) => s.trim()).filter(Boolean))]
      : [];

    let setorIds: string[];
    if (usuario.role === "responsavel") {
      if (!usuario.setorId) throw forbidden("Usuário responsável sem setor vinculado");
      if (idsInformados.length > 0 && (idsInformados.length > 1 || idsInformados[0] !== usuario.setorId)) {
        throw forbidden("Responsável só pode exportar o próprio setor");
      }
      setorIds = [usuario.setorId];
    } else {
      if (idsInformados.length === 0) throw badRequest("Selecione ao menos um setor (setor_ids)");
      setorIds = idsInformados;
    }

    const setores = await prisma.setor.findMany({ where: { id: { in: setorIds }, ativo: true } });
    if (setores.length !== setorIds.length) {
      throw badRequest("Um ou mais setores selecionados não foram encontrados ou estão inativos");
    }

    const includeRelacoes = { indicador: { include: { produto: true } } } satisfies Prisma.MetaInclude;

    const setoresComMetas = await Promise.all(
      setores.map(async (setor) => {
        const metas = await prisma.meta.findMany({
          where: { setorId: setor.id, ano: query.ano, ativo: true },
          include: includeRelacoes,
          orderBy: { ordem: "asc" },
        });
        return { setor, metas };
      })
    );

    const buffer = await gerarWorkbookExcel(setoresComMetas, query.ano);

    const nomeArquivo =
      setores.length === 1 ? `farol_${slugify(setores[0].nome)}_${query.ano}.xlsx` : `farol_${query.ano}.xlsx`;

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="${nomeArquivo}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    next(err);
  }
});
