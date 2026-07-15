import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, resolveSetorId } from "../middleware/auth";
import { Meta } from "@prisma/client";
import { MESES } from "../lib/metasCalc";

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
    const ivs = await prisma.meta.findMany({ where: { setorId, ano: query.ano, icIv: "IV", ativo: true } });

    const totalIndicadores = ivs.length;
    const statusOk = ivs.filter((m) => m.statusAcum === "ok").length;
    const statusNok = ivs.filter((m) => m.statusAcum === "nok").length;
    const percentual = totalIndicadores > 0 ? (statusOk / totalIndicadores) * 100 : 0;

    const metasPorStatus = [
      { status: "ok", quantidade: statusOk, exemplos: ivs.filter((m) => m.statusAcum === "ok").slice(0, 5).map((m) => m.indicador) },
      { status: "nok", quantidade: statusNok, exemplos: ivs.filter((m) => m.statusAcum === "nok").slice(0, 5).map((m) => m.indicador) },
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

    const hoje = new Date();
    const mesLimite = query.ano === hoje.getFullYear() ? hoje.getMonth() + 1 : 12;
    const metasIncompletas = ivs
      .map((meta) => {
        const mesesFaltando = MESES.slice(0, mesLimite).filter((mes) => {
          const metaCampo = `meta${mes}` as keyof Meta;
          const realCampo = `real${mes}` as keyof Meta;
          return meta[metaCampo] == null || meta[realCampo] == null;
        });
        return {
          id: meta.id,
          indicador: meta.indicador,
          responsavel: meta.responsavel,
          meses_faltando: mesesFaltando,
          quantidade_faltando: mesesFaltando.length,
        };
      })
      .filter((m) => m.quantidade_faltando > 0)
      .sort((a, b) => b.quantidade_faltando - a.quantidade_faltando);

    const ics = await prisma.meta.findMany({
      where: { setorId, ano: query.ano, icIv: "IC", ativo: true },
      include: { filhos: { where: { ativo: true } } },
    });
    const icComProblemas = ics
      .map((ic) => {
        const filhosNok = ic.filhos.filter((f) => f.statusAcum === "nok");
        return {
          indicador: ic.indicador,
          acumulado: ic.acumReal,
          meta_ano: ic.metaAno,
          percentual:
            ic.metaAno != null && ic.acumReal != null && !ic.metaAno.isZero()
              ? ic.acumReal.div(ic.metaAno).mul(100).toDecimalPlaces(1)
              : null,
          filhos_nok: filhosNok.map((f) => f.indicador),
        };
      })
      .filter((ic) => ic.filhos_nok.length > 0);

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
      const ivs = await prisma.meta.findMany({ where: { setorId: setor.id, ano: query.ano, icIv: "IV", ativo: true } });
      const totalIndicadores = ivs.length;
      const statusOk = ivs.filter((m) => m.statusAcum === "ok").length;
      const percentual = totalIndicadores > 0 ? (statusOk / totalIndicadores) * 100 : 0;

      let consolidacaoGeral: { percentual_preenchido: number; completo: boolean } | null = null;
      if (mesKey) {
        const realCampo = `real${mesKey}` as keyof Meta;
        const preenchidas = ivs.filter((m) => m[realCampo] != null).length;
        const percentualPreenchido = totalIndicadores > 0 ? (preenchidas / totalIndicadores) * 100 : 0;
        consolidacaoGeral = {
          percentual_preenchido: Number(percentualPreenchido.toFixed(2)),
          completo: totalIndicadores > 0 && preenchidas === totalIndicadores,
        };
      }

      resultado.push({
        nome_setor: setor.nome,
        total_indicadores: totalIndicadores,
        status_ok: statusOk,
        percentual_atingimento: Number(percentual.toFixed(2)),
        consolidacao_geral: consolidacaoGeral,
      });
    }

    resultado.sort((a, b) => b.percentual_atingimento - a.percentual_atingimento);
    const comRanking = resultado.map((r, idx) => ({ ...r, ranking: idx + 1 }));

    res.json({ ano: query.ano, periodo: query.periodo, setores: comRanking });
  } catch (err) {
    next(err);
  }
});
