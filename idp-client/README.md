# @copperline/idp-client

Middleware Express de integração com o IdP centralizado (OS 07). Qualquer
sistema do parque que já use Express (Farol, sistema sem login, sistema
EJS) instala esse pacote em vez de reimplementar o fluxo OAuth2/JWT.

## Distribuição

Ainda não publicado em registry privado (a definir em conjunto, ver OS 07
seção 3.1). Por enquanto, consuma como dependência de path ou git, por
exemplo no `package.json` do sistema cliente:

```json
{
  "dependencies": {
    "@copperline/idp-client": "file:../idp-client"
  }
}
```

(rode `npm run build` aqui antes — o pacote é consumido a partir de `dist/`).

## Uso

```ts
import express from "express";
import session from "express-session";
import { createIdpAuth, requireRole } from "@copperline/idp-client";

const idpAuth = createIdpAuth({
  idpUrl: process.env.IDP_URL!,
  clientId: process.env.IDP_CLIENT_ID!,
  clientSecret: process.env.IDP_CLIENT_SECRET!,
  redirectUri: process.env.IDP_REDIRECT_URI!,
});

const app = express();

// A lib NÃO traz sessão própria - cada sistema cliente configura a sua
// (express-session ou equivalente), igual valeria pro sistema EJS.
app.use(session({ secret: "...", resave: false, saveUninitialized: false }));

app.use(idpAuth.router); // monta GET /auth/login, /auth/callback, /auth/logout

app.get("/painel", idpAuth.requireAuth, (req, res) => {
  res.send(`Olá, ${req.user!.name} (${req.user!.role})`);
});

app.get("/admin", idpAuth.requireAuth, requireRole("admin"), (req, res) => {
  res.send("Só admin entra aqui.");
});

app.listen(3001);
```

## Configuração (`IdpClientConfig`)

| Campo | Obrigatório | Default | Descrição |
|---|---|---|---|
| `idpUrl` | sim | — | URL base do IdP usada server-to-server (troca de code por token, JWKS, revoke) - chamada de dentro do processo/container do sistema cliente. |
| `authorizeUrl` | não | `idpUrl` | URL base do IdP usada só pra montar os redirects que vão pro navegador (`GET /authorize` e `GET /session/end`). Só precisa divergir de `idpUrl` quando backend e navegador não enxergam o IdP pelo mesmo hostname/porta - ex.: backend containerizado falando com o IdP via `host.docker.internal`, mas o navegador (no host) precisa de `localhost` (ver OS 08-B). |
| `clientId` / `clientSecret` | sim | — | Credenciais do sistema, cadastradas no painel de administração (OS 06). `clientSecret` só no backend, nunca no front (OS 07 seção 4). |
| `redirectUri` | sim | — | Deve bater exatamente com um dos `redirectUris` cadastrados no sistema no IdP. |
| `loginPath` / `callbackPath` / `logoutPath` | não | `/auth/login`, `/auth/callback`, `/auth/logout` | Paths montados no router. |
| `postLoginRedirect` / `postLogoutRedirect` | não | `/` | Fallback quando não há `returnTo`. |
| `jwksCacheTtlMs` | não | `3600000` (1h) | Cache do JWKS — busca de novo automaticamente se aparecer um `kid` desconhecido (rotação de chave, OS 05/07). |
| `issuer` | não | — | Se definido, valida `iss` do token além de `aud`. |

## Modelo de sessão

`access_token`/`refresh_token` nunca chegam ao navegador — ficam só na
sessão do backend do sistema cliente (`req.session.idpAuth`), igual em
sistemas server-rendered (EJS) e em APIs por trás de uma SPA React: o front
nunca fala com o IdP diretamente, só com o próprio backend do sistema
(OS 07, seção 3.4).

## `req.user`

Depois de `requireAuth`, `req.user` tem `{ sub, email, name, role, system }`
— as claims do access_token já validado (assinatura via JWKS + `aud`
conferido contra o próprio `clientId` + `exp`). Nunca o JWT cru.

## Limitação herdada do modelo JWT

Como documentado na OS 06, revogar o acesso de um usuário no painel de
administração não invalida instantaneamente um `access_token` já emitido —
só impede a emissão de novos (e, por consequência, a próxima renovação via
refresh token, já que `requireAuth` reconfere o acesso ativo a cada
rotação). Um token já em mãos continua válido até expirar naturalmente
(padrão: 15 min).
