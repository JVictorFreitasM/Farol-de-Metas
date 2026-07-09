-- OS-001: Schema SQL — Estrutura de Banco de Dados
-- Migration inicial (Prisma 6)

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enums
CREATE TYPE "user_role" AS ENUM ('responsavel', 'gerente', 'admin');
CREATE TYPE "ic_iv_type" AS ENUM ('IC', 'IV');
CREATE TYPE "tipo_meta_type" AS ENUM ('maior_melhor', 'menor_melhor');
CREATE TYPE "status_meta_type" AS ENUM ('ok', 'nok');
CREATE TYPE "acao_auditoria_type" AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE');

-- Tabela: setores
CREATE TABLE "setores" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "nome" VARCHAR(255) NOT NULL,
  "email" VARCHAR(255),
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "criado_em" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT "setores_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "setores_nome_key" ON "setores"("nome");
CREATE UNIQUE INDEX "setores_email_key" ON "setores"("email");
CREATE INDEX "idx_setores_nome" ON "setores"("nome");
CREATE INDEX "idx_setores_email" ON "setores"("email");

-- Tabela: usuarios
CREATE TABLE "usuarios" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "email" VARCHAR(255) NOT NULL,
  "senha_hash" VARCHAR(255) NOT NULL,
  "setor_id" UUID,
  "nome" VARCHAR(255) NOT NULL,
  "role" "user_role" NOT NULL,
  "ativo" BOOLEAN NOT NULL DEFAULT true,
  "ultimo_acesso" TIMESTAMP,
  "criado_em" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(),

  CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "usuarios_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id")
);

CREATE UNIQUE INDEX "usuarios_email_key" ON "usuarios"("email");
CREATE INDEX "idx_usuarios_email" ON "usuarios"("email");
CREATE INDEX "idx_usuarios_setor_id" ON "usuarios"("setor_id");
CREATE INDEX "idx_usuarios_role" ON "usuarios"("role");

-- Tabela: metas
CREATE TABLE "metas" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "setor_id" UUID NOT NULL,
  "ano" INTEGER NOT NULL,
  "produto" VARCHAR(255) NOT NULL,
  "ic_iv" "ic_iv_type" NOT NULL,
  "pai_id" UUID,
  "indicador" VARCHAR(255) NOT NULL,
  "responsavel" VARCHAR(255) NOT NULL,
  "unidade" VARCHAR(50) NOT NULL,
  "tipo_meta" "tipo_meta_type" NOT NULL,
  "meta_ano" DECIMAL(15,2),
  "valor_jan" DECIMAL(15,2),
  "valor_fev" DECIMAL(15,2),
  "valor_mar" DECIMAL(15,2),
  "valor_abr" DECIMAL(15,2),
  "valor_mai" DECIMAL(15,2),
  "valor_jun" DECIMAL(15,2),
  "valor_jul" DECIMAL(15,2),
  "valor_ago" DECIMAL(15,2),
  "valor_set" DECIMAL(15,2),
  "valor_out" DECIMAL(15,2),
  "valor_nov" DECIMAL(15,2),
  "valor_dez" DECIMAL(15,2),
  "acumulado" DECIMAL(15,2) GENERATED ALWAYS AS (
    COALESCE("valor_jan", 0) + COALESCE("valor_fev", 0) + COALESCE("valor_mar", 0) +
    COALESCE("valor_abr", 0) + COALESCE("valor_mai", 0) + COALESCE("valor_jun", 0) +
    COALESCE("valor_jul", 0) + COALESCE("valor_ago", 0) + COALESCE("valor_set", 0) +
    COALESCE("valor_out", 0) + COALESCE("valor_nov", 0) + COALESCE("valor_dez", 0)
  ) STORED,
  "status" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "ic_iv" = 'IC' THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND (
        COALESCE("valor_jan", 0) + COALESCE("valor_fev", 0) + COALESCE("valor_mar", 0) +
        COALESCE("valor_abr", 0) + COALESCE("valor_mai", 0) + COALESCE("valor_jun", 0) +
        COALESCE("valor_jul", 0) + COALESCE("valor_ago", 0) + COALESCE("valor_set", 0) +
        COALESCE("valor_out", 0) + COALESCE("valor_nov", 0) + COALESCE("valor_dez", 0)
      ) >= "meta_ano" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND (
        COALESCE("valor_jan", 0) + COALESCE("valor_fev", 0) + COALESCE("valor_mar", 0) +
        COALESCE("valor_abr", 0) + COALESCE("valor_mai", 0) + COALESCE("valor_jun", 0) +
        COALESCE("valor_jul", 0) + COALESCE("valor_ago", 0) + COALESCE("valor_set", 0) +
        COALESCE("valor_out", 0) + COALESCE("valor_nov", 0) + COALESCE("valor_dez", 0)
      ) <= "meta_ano" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,
  "editavel" BOOLEAN GENERATED ALWAYS AS ("ic_iv" = 'IV') STORED,
  "criado_em" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizado_em" TIMESTAMP NOT NULL DEFAULT now(),
  "atualizado_por" UUID,

  CONSTRAINT "metas_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "metas_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id"),
  CONSTRAINT "metas_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "metas"("id"),
  CONSTRAINT "metas_atualizado_por_fkey" FOREIGN KEY ("atualizado_por") REFERENCES "usuarios"("id"),
  CONSTRAINT "check_iv_tem_pai" CHECK (
    ("ic_iv" = 'IV' AND "pai_id" IS NOT NULL) OR ("ic_iv" = 'IC' AND "pai_id" IS NULL)
  )
);

CREATE INDEX "idx_metas_setor_id" ON "metas"("setor_id");
CREATE INDEX "idx_metas_ano" ON "metas"("ano");
CREATE INDEX "idx_metas_ic_iv" ON "metas"("ic_iv");
CREATE INDEX "idx_metas_pai_id" ON "metas"("pai_id");
CREATE INDEX "idx_metas_setor_ano" ON "metas"("setor_id", "ano");

-- Tabela: metas_historico
CREATE TABLE "metas_historico" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "metas_id" UUID NOT NULL,
  "versao" INTEGER NOT NULL,
  "valores_antes" JSONB,
  "valores_depois" JSONB NOT NULL,
  "alterado_por" UUID,
  "alterado_em" TIMESTAMP NOT NULL DEFAULT now(),
  "motivo" TEXT,

  CONSTRAINT "metas_historico_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "metas_historico_metas_id_fkey" FOREIGN KEY ("metas_id") REFERENCES "metas"("id"),
  CONSTRAINT "metas_historico_alterado_por_fkey" FOREIGN KEY ("alterado_por") REFERENCES "usuarios"("id")
);

CREATE INDEX "idx_metas_historico_metas_id" ON "metas_historico"("metas_id");
CREATE INDEX "idx_metas_historico_alterado_em" ON "metas_historico"("alterado_em");

-- Tabela: auditoria
CREATE TABLE "auditoria" (
  "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
  "setor_id" UUID,
  "usuario_id" UUID,
  "acao" "acao_auditoria_type" NOT NULL,
  "tabela" VARCHAR(50) NOT NULL,
  "registro_id" UUID,
  "ip_address" VARCHAR(45),
  "timestamp" TIMESTAMP NOT NULL DEFAULT now(),
  "detalhes" JSONB,

  CONSTRAINT "auditoria_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auditoria_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id"),
  CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id")
);

CREATE INDEX "idx_auditoria_setor_id" ON "auditoria"("setor_id");
CREATE INDEX "idx_auditoria_usuario_id" ON "auditoria"("usuario_id");
CREATE INDEX "idx_auditoria_timestamp" ON "auditoria"("timestamp");
CREATE INDEX "idx_auditoria_acao" ON "auditoria"("acao");

-- Views
CREATE VIEW "v_metas_completa" AS
SELECT
  m."id",
  m."setor_id",
  s."nome" AS "nome_setor",
  m."ano",
  m."ic_iv",
  m."indicador",
  m."meta_ano",
  m."acumulado",
  m."status",
  ROUND((m."acumulado" / NULLIF(m."meta_ano", 0) * 100)::numeric, 2) AS "percentual_atingimento"
FROM "metas" m
JOIN "setores" s ON m."setor_id" = s."id";

CREATE VIEW "v_auditoria_setor" AS
SELECT
  a."id",
  a."setor_id",
  s."nome" AS "nome_setor",
  a."usuario_id",
  u."nome" AS "nome_usuario",
  a."acao",
  a."tabela",
  a."timestamp"
FROM "auditoria" a
JOIN "setores" s ON a."setor_id" = s."id"
JOIN "usuarios" u ON a."usuario_id" = u."id";

-- Triggers
CREATE OR REPLACE FUNCTION update_metas_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW."atualizado_em" = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_metas_timestamp
BEFORE UPDATE ON "metas"
FOR EACH ROW
EXECUTE FUNCTION update_metas_timestamp();

CREATE OR REPLACE FUNCTION log_metas_historico()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    INSERT INTO "metas_historico" (
      "metas_id", "versao", "valores_antes", "valores_depois", "alterado_por", "alterado_em"
    ) VALUES (
      NEW."id",
      (SELECT COALESCE(MAX("versao"), 0) + 1 FROM "metas_historico" WHERE "metas_id" = NEW."id"),
      row_to_json(OLD),
      row_to_json(NEW),
      NEW."atualizado_por",
      now()
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_metas_historico
AFTER UPDATE ON "metas"
FOR EACH ROW
EXECUTE FUNCTION log_metas_historico();
