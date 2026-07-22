import { Router } from "express";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { authenticate, authorize } from "../middleware/auth";
import { notFound } from "../lib/errors";
import { registrarAuditoria } from "../lib/auditoria";

// OS-016: configuração de fechamento mensal e desbloqueios pontuais. Só admin edita, mas
// dia_limite_preenchimento (GET /) é lido por qualquer usuário autenticado — o dashboard usa
// esse valor pra avisar responsavel/gerente do prazo de preenchimento.
export const configuracoesRouter = Router();
configuracoesRouter.use(authenticate);

configuracoesRouter.get("/", async (_req, res, next) => {
  try {
    const config = await prisma.configuracaoSistema.findFirstOrThrow();
    res.json({ dia_limite_preenchimento: config.diaLimitePreenchimento });
  } catch (err) {
    next(err);
  }
});

const editarConfigSchema = z.object({
  // Teto em 28 evita configurar um dia que não existe em todo mês (ex: 30/31 em fevereiro).
  dia_limite_preenchimento: z.number().int().min(1).max(28),
});

configuracoesRouter.put("/", authorize("admin"), async (req, res, next) => {
  try {
    const body = editarConfigSchema.parse(req.body);
    const usuario = req.usuario!;

    const configAtual = await prisma.configuracaoSistema.findFirstOrThrow();
    const config = await prisma.configuracaoSistema.update({
      where: { id: configAtual.id },
      data: { diaLimitePreenchimento: body.dia_limite_preenchimento, atualizadoPor: usuario.id },
    });

    await registrarAuditoria(req, {
      acao: "UPDATE",
      tabela: "configuracao_sistema",
      registroId: config.id,
      detalhes: { dia_limite_preenchimento: body.dia_limite_preenchimento },
    });

    res.json({ dia_limite_preenchimento: config.diaLimitePreenchimento });
  } catch (err) {
    next(err);
  }
});

function serializeDesbloqueio(d: Prisma.DesbloqueioPreenchimentoGetPayload<{ include: { setor: true } }>) {
  return {
    id: d.id,
    setor_id: d.setorId,
    setor: d.setor.nome,
    ano: d.ano,
    mes: d.mes,
    liberado_por: d.liberadoPor,
    liberado_em: d.liberadoEm,
  };
}

const listarDesbloqueiosQuerySchema = z.object({
  setor_id: z.string().uuid().optional(),
  ano: z.coerce.number().int().optional(),
});

configuracoesRouter.get("/desbloqueios", authorize("admin"), async (req, res, next) => {
  try {
    const query = listarDesbloqueiosQuerySchema.parse(req.query);

    const desbloqueios = await prisma.desbloqueioPreenchimento.findMany({
      where: { setorId: query.setor_id, ano: query.ano },
      include: { setor: true },
      orderBy: [{ ano: "desc" }, { mes: "desc" }],
    });

    res.json({ data: desbloqueios.map(serializeDesbloqueio) });
  } catch (err) {
    next(err);
  }
});

const criarDesbloqueioSchema = z.object({
  setor_id: z.string().uuid(),
  ano: z.number().int(),
  mes: z.number().int().min(1).max(12),
});

// Idempotente: reenviar o mesmo setor/ano/mes só atualiza quem/quando liberou por último.
configuracoesRouter.post("/desbloqueios", authorize("admin"), async (req, res, next) => {
  try {
    const body = criarDesbloqueioSchema.parse(req.body);
    const usuario = req.usuario!;

    const setor = await prisma.setor.findUnique({ where: { id: body.setor_id } });
    if (!setor) throw notFound("Setor não encontrado");

    const desbloqueio = await prisma.desbloqueioPreenchimento.upsert({
      where: { setorId_ano_mes: { setorId: body.setor_id, ano: body.ano, mes: body.mes } },
      update: { liberadoPor: usuario.id, liberadoEm: new Date() },
      create: { setorId: body.setor_id, ano: body.ano, mes: body.mes, liberadoPor: usuario.id },
      include: { setor: true },
    });

    await registrarAuditoria(req, {
      acao: "CREATE",
      tabela: "desbloqueios_preenchimento",
      registroId: desbloqueio.id,
      setorId: desbloqueio.setorId,
      detalhes: { ano: body.ano, mes: body.mes },
    });

    res.status(201).json(serializeDesbloqueio(desbloqueio));
  } catch (err) {
    next(err);
  }
});

configuracoesRouter.delete("/desbloqueios/:id", authorize("admin"), async (req, res, next) => {
  try {
    const desbloqueio = await prisma.desbloqueioPreenchimento.findUnique({ where: { id: req.params.id } });
    if (!desbloqueio) throw notFound("Desbloqueio não encontrado");

    await prisma.desbloqueioPreenchimento.delete({ where: { id: desbloqueio.id } });

    await registrarAuditoria(req, {
      acao: "DELETE",
      tabela: "desbloqueios_preenchimento",
      registroId: desbloqueio.id,
      setorId: desbloqueio.setorId,
      detalhes: { ano: desbloqueio.ano, mes: desbloqueio.mes },
    });

    res.status(204).end();
  } catch (err) {
    next(err);
  }
});
