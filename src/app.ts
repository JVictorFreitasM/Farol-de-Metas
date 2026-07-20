import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { authRouter } from "./routes/auth.routes";
import { metasRouter } from "./routes/metas.routes";
import { relatoriosRouter } from "./routes/relatorios.routes";
import { auditoriaRouter } from "./routes/auditoria.routes";
import { setoresRouter } from "./routes/setores.routes";
import { produtosRouter } from "./routes/produtos.routes";
import { indicadoresRouter } from "./routes/indicadores.routes";
import { errorHandler } from "./middleware/errorHandler";

export const app = express();

// OS-003 §10: headers de segurança (X-Content-Type-Options, X-Frame-Options, HSTS, CSP)
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: { defaultSrc: ["'self'"] },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true },
    frameguard: { action: "deny" },
    noSniff: true,
    xssFilter: true,
  })
);
app.use(cors());
app.use(express.json());

// 500 requisições/minuto globais (chave fixa; evita bloqueio em massa em rede corporativa com IP compartilhado)
app.use(
  rateLimit({
    windowMs: 60 * 1000,
    limit: 500,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: () => "global",
  })
);

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.use("/auth", authRouter);
app.use("/metas", metasRouter);
app.use("/relatorios", relatoriosRouter);
app.use("/auditoria", auditoriaRouter);
app.use("/setores", setoresRouter);
app.use("/produtos", produtosRouter);
app.use("/indicadores", indicadoresRouter);

app.use(errorHandler);
