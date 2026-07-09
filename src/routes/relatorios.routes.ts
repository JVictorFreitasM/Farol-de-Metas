import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authenticate, authorize, resolveSetorId } from "../middleware/auth";
import { Decimal } from "@prisma/client/runtime/library";

export const relatoriosRouter = Router();
relatoriosRouter.use(authenticate);

const MESES = [
  "janeiro", "fevereiro", "marco", "abril", "maio", "junho",
  "julho", "agosto", "setembro", "outubro", "novembro", "dezembro",
] as const;

const VALOR_FIELDS = [
  "valorJan", "valorFev", "valorMar", "valorAbr", "valorMai", "valorJun",
  "valorJul", "valorAgo", "valorSet", "valorOut", "valorNov", "valorDez",
] as const;

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
      where: { setorId, ano: query.ano, icIv: "IV" },
    });

    const totalIndicadores = ivs.length;
    const statusOk = ivs.filter((m) => m.status === "ok").length;
    const statusNok = ivs.filter((m) => m.status === "nok").length;
    const percentual = totalIndicadores > 0 ? (statusOk / totalIndicadores) * 100 : 0;

    const metasPorStatus = [
      { status: "ok", quantidade: statusOk, exemplos: ivs.filter((m) => m.status === "ok").slice(0, 5).map((m) => m.indicador) },
      { status: "nok", quantidade: statusNok, exemplos: ivs.filter((m) => m.status === "nok").slice(0, 5).map((m) => m.indicador) },
    ];

    const evolucaoMensal = MESES.map((mes, idx) => {
      const campo = VALOR_FIELDS[idx];
      let ok = 0;
      let nok = 0;
      let acumuladoGeral = new Decimal(0);
      for (const meta of ivs) {
        const valor = meta[campo] as Decimal | null;
        if (valor != null) acumuladoGeral = acumuladoGeral.plus(valor);
        if (meta.tipoMeta === "maior_melhor") {
          (valor != null && meta.metaAno != null && valor.gte(meta.metaAno) ? ok++ : nok++);
        } else {
          (valor != null && meta.metaAno != null && valor.lte(meta.metaAno) ? ok++ : nok++);
        }
      }
      return { mes, status_ok: ok, status_nok: nok, acumulado_geral: acumuladoGeral };
    });

    const ics = await prisma.meta.findMany({
      where: { setorId, ano: query.ano, icIv: "IC" },
      include: { filhos: true },
    });
    const icComProblemas = ics
      .map((ic) => {
        const filhosNok = ic.filhos.filter((f) => f.status === "nok");
        const metaAno = ic.filhos.reduce<Decimal | null>(
          (acc, f) => (f.metaAno == null ? acc : (acc ?? new Decimal(0)).plus(f.metaAno)),
          null
        );
        const acumulado = ic.filhos.reduce((acc, f) => acc.plus(f.acumulado ?? new Decimal(0)), new Decimal(0));
        return {
          indicador: ic.indicador,
          acumulado,
          meta_ano: metaAno,
          percentual: metaAno && !metaAno.isZero() ? acumulado.div(metaAno).mul(100).toDecimalPlaces(1) : null,
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
    });
  } catch (err) {
    next(err);
  }
});

const comparativaQuerySchema = z.object({
  ano: z.coerce.number().int(),
  periodo: z.enum(["mes", "trim", "semestre", "ano"]).default("ano"),
});

relatoriosRouter.get("/comparativa", authorize("gerente", "admin"), async (req, res, next) => {
  try {
    const query = comparativaQuerySchema.parse(req.query);

    const setores = await prisma.setor.findMany({ where: { ativo: true } });
    const resultado = [];

    for (const setor of setores) {
      const ivs = await prisma.meta.findMany({
        where: { setorId: setor.id, ano: query.ano, icIv: "IV" },
      });
      const totalIndicadores = ivs.length;
      const statusOk = ivs.filter((m) => m.status === "ok").length;
      const percentual = totalIndicadores > 0 ? (statusOk / totalIndicadores) * 100 : 0;

      resultado.push({
        nome_setor: setor.nome,
        total_indicadores: totalIndicadores,
        status_ok: statusOk,
        percentual_atingimento: Number(percentual.toFixed(2)),
      });
    }

    resultado.sort((a, b) => b.percentual_atingimento - a.percentual_atingimento);
    const comRanking = resultado.map((r, idx) => ({ ...r, ranking: idx + 1 }));

    res.json({ ano: query.ano, periodo: query.periodo, setores: comRanking });
  } catch (err) {
    next(err);
  }
});
