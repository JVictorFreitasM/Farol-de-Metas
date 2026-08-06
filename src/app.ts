import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import session from "express-session";
import RedisStore from "connect-redis";
import { createClient } from "redis";
import { idpAuth } from "./lib/idpAuth";
import { authenticate } from "./middleware/auth";
import { metasRouter } from "./routes/metas.routes";
import { relatoriosRouter } from "./routes/relatorios.routes";
import { auditoriaRouter } from "./routes/auditoria.routes";
import { setoresRouter } from "./routes/setores.routes";
import { produtosRouter } from "./routes/produtos.routes";
import { indicadoresRouter } from "./routes/indicadores.routes";
import { configuracoesRouter } from "./routes/configuracoes.routes";
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

// OS-009-C: sessão local do backend — guarda access/refresh token do IdP (nunca no front,
// só o cookie httpOnly de sessão chega ao navegador). Redis como store para sobreviver a
// restarts do container e permitir múltiplas instâncias no futuro.
const redisClient = createClient({ url: process.env.REDIS_URL ?? "redis://localhost:6379" });
redisClient.on("error", (err) => console.error("Erro na conexão com o Redis:", err));
redisClient.connect().catch((err) => console.error("Falha ao conectar no Redis:", err));

app.use(
  session({
    store: new RedisStore({ client: redisClient }),
    secret: process.env.SESSION_SECRET ?? "dev-session-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === "true",
      sameSite: "lax",
    },
  })
);

// GET /api/auth/login, /api/auth/callback, /api/auth/logout (paths configurados em lib/idpAuth.ts).
app.use(idpAuth.router);

app.get("/me", authenticate, (req, res) => {
  const usuario = req.usuario!;
  res.json({
    sub: req.user!.sub,
    email: req.user!.email,
    name: req.user!.name,
    role: req.user!.role,
    // snake_case pra bater com o resto da API (ex.: serializeProduto) e com o tipo Usuario do
    // frontend — req.usuario internamente é camelCase (setorId), mas nunca tinha sido
    // serializado pra JSON antes (a rota antiga /auth/login já fazia essa tradução).
    usuario: {
      id: usuario.id,
      nome: usuario.nome,
      email: usuario.email,
      setor_id: usuario.setorId,
      role: usuario.role,
    },
  });
});

app.use("/metas", metasRouter);
app.use("/relatorios", relatoriosRouter);
app.use("/auditoria", auditoriaRouter);
app.use("/setores", setoresRouter);
app.use("/produtos", produtosRouter);
app.use("/indicadores", indicadoresRouter);
app.use("/configuracoes", configuracoesRouter);

app.use(errorHandler);
