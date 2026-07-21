# Farol

Sistema web para acompanhamento de metas e indicadores empresariais (ICs e IVs) por setor. Permite cadastrar indicadores com hierarquia (Indicador de Controle → Indicadores de Verificação), registrar metas e realizados mês a mês, calcular acumulados (soma, média ou valor manual), comparar anos, gerar dashboards e relatórios, e auditar todas as alterações.
<img width="1920" height="1299" alt="Farol-07-21-2026_09_17_AM" src="https://github.com/user-attachments/assets/9fcd4e8e-55ef-4445-aeb9-0abf7bfc4244" />

## ✨ Funcionalidades

- Autenticação por login/senha (JWT), com papéis `responsavel`, `gerente` e `admin`
- Cadastro de indicadores (IC/IV) com hierarquia, produto associado e regras de agregação
- Lançamento de metas e valores realizados mês a mês, com histórico de alterações
- Cálculo automático de acumulados (soma / média / manual) por indicador, incluindo agregação de IC a partir dos IVs filhos
- Importação em massa de metas de um ano para outro, com ajuste percentual
- Dashboard por setor (status OK/NOK, evolução mensal, indicadores incompletos)
- Comparativo de indicadores entre múltiplos anos
- Relatório comparativo entre setores
- Log de auditoria de todas as operações (criação, edição, exclusão, login)
- Controle de acesso por setor (um `responsavel` só vê o próprio setor; `gerente`/`admin` navegam entre setores)

## 🛠 Tecnologias

**Backend**
- Node.js + TypeScript
- Express
- Prisma ORM + PostgreSQL
- Zod (validação)
- JWT (`jsonwebtoken`) + `bcryptjs` (autenticação)
- Helmet + `express-rate-limit` (segurança)

**Frontend**
- React 18 + TypeScript
- Vite
- React Router
- Recharts / ECharts (gráficos)
- React Toastify
- jsPDF (exportação de relatórios em PDF)

## 📂 Estrutura do projeto

```
farol/
├── src/                      # Backend (API)
│   ├── routes/                # Rotas Express (auth, metas, indicadores, produtos, setores, relatorios, auditoria)
│   ├── middleware/             # Autenticação, tratamento de erros
│   ├── lib/                    # Prisma client, cálculo de acumulados, serializers, JWT, auditoria
│   ├── types/                  # Tipos globais (ex.: extensão do Express.Request)
│   ├── app.ts                  # Configuração do Express (middlewares, rotas)
│   └── server.ts               # Ponto de entrada
├── prisma/
│   ├── schema.prisma            # Modelo de dados
│   ├── migrations/              # Migrations
│   └── seed.ts                  # Seed de dados (setores, usuários, indicadores, metas)
└── frontend/                  # Frontend (SPA)
    └── src/
        ├── pages/                # Telas (Login, Dashboard, Metas, Cadastro, Relatórios, Auditoria)
        ├── components/           # Componentes de UI
        ├── hooks/                # Hooks de dados (useMetas, useIndicadores, useAuth, ...)
        ├── services/             # Clientes de API
        └── types.ts              # Tipos compartilhados com a API
```

## 🚀 Como executar

### Pré-requisitos

- Node.js 18+
- PostgreSQL

### Instalação

```bash
git clone <url-do-repositorio>
cd farol

# backend
npm install

# frontend
cd frontend
npm install
cd ..
```

### Configuração

Copie `.env.example` para `.env` na raiz do projeto e preencha:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/farol?schema=public"
JWT_SECRET="troque-em-producao"
JWT_EXPIRES_IN="24h"
PORT=3000
```

### Banco de dados

```bash
npx prisma migrate deploy   # aplica as migrations
npx prisma db seed          # popula setores, usuários e dados de exemplo
```

Durante desenvolvimento, para criar uma nova migration a partir de alterações no `schema.prisma`:

```bash
npx prisma migrate dev
```

### Executar

```bash
# backend (porta definida em PORT, padrão 3000)
npm run dev

# frontend (em outro terminal)
cd frontend
npm run dev
```

## 📡 API

Todas as rotas (exceto `/health` e `/auth/login`) exigem `Authorization: Bearer <token>`.

| Método | Rota | Descrição |
|---------|------|-----------|
| GET | /health | Healthcheck |
| POST | /auth/login | Login |
| GET | /indicadores | Lista indicadores do setor |
| POST | /indicadores | Cria indicador (gerente/admin) |
| PATCH | /indicadores/:id | Edita indicador |
| DELETE | /indicadores/:id | Inativa indicador |
| GET | /metas | Lista metas de um setor/ano |
| GET | /metas/anos-disponiveis | Lista anos com metas cadastradas |
| POST | /metas | Cria meta (gerente) |
| PUT | /metas/:id/meta | Edita valores de meta |
| PUT | /metas/:id/real | Edita valores realizados |
| PATCH | /metas/:id/inativar | Inativa meta |
| PATCH | /metas/:id/ativar | Reativa meta |
| DELETE | /metas/:id | Remove meta |
| POST | /metas/importar-ano | Importa metas de um ano para outro |
| GET | /metas/:id/acumulado-periodo | Acumulado de um período específico |
| GET | /metas/:id/comparativo | Comparativo entre anos |
| GET | /metas/:id/historico | Histórico de alterações |
| GET | /metas/:id/historico-periodo | Histórico de alterações por período |
| GET | /produtos | Lista produtos |
| GET | /produtos/:id | Detalhe de produto |
| POST | /produtos | Cria produto |
| PUT | /produtos/:id | Edita produto |
| DELETE | /produtos/:id | Remove produto |
| GET | /setores | Lista setores |
| GET | /relatorios/dashboard | Dashboard do setor |
| GET | /relatorios/comparativa | Comparativo entre setores |
| GET | /auditoria | Log de auditoria |

## 🗄 Banco de dados

Principais entidades (`prisma/schema.prisma`):

- **Setor** — unidade organizacional; agrupa usuários, indicadores, produtos e metas
- **Usuario** — login, papel (`responsavel` / `gerente` / `admin`) e setor vinculado
- **Indicador** — indicador de controle (IC) ou verificação (IV), com unidade, hierarquia (`paiId`), produto associado e regras de agregação/acumulação (soma, média ou manual)
- **Meta** — valores de meta e realizado mês a mês de um indicador em um ano específico, com acumulados calculados
- **MetaHistorico** — histórico de alterações de valores de uma meta
- **Produto** — agrupador visual de indicadores dentro de um setor
- **Auditoria** — log de ações (criação, leitura, edição, exclusão) por usuário

## 📷 Screenshots

_(adicionar capturas de tela do dashboard, da tela de metas e dos relatórios)_



## 📦 Deploy

Build de produção:

```bash
# backend
npm run build
npm start

# frontend
cd frontend
npm run build   # gera frontend/dist, para servir via qualquer servidor estático
```

Não há Dockerfile no projeto no momento — o deploy depende de um processo Node.js para a API (com acesso a um PostgreSQL) e de hospedagem estática para o build do frontend.

## 📌 Roadmap

- [x] Autenticação e controle de acesso por setor/papel
- [x] Cadastro de indicadores com hierarquia IC/IV
- [x] Lançamento de metas e realizados com histórico
- [x] Dashboard e relatório comparativo entre setores
- [x] Extração de indicadores para entidade própria (independente do ano)
- [x] Importação de metas entre anos
- [x] Acumulado manual (meta e real), independente de soma/média
- [ ] Notificações
- [ ] Relatórios em PDF a partir do dashboard
- [ ] Suíte de testes automatizados


## 📄 Licença

Uso interno / proprietário. Sem licença de código aberto definida.
