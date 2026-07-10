-- Migration: Reestrutura tabela metas
-- Separa valor_mes em meta_mes + real_mes
-- Adiciona status por mês, acum_meta, acum_real, agrega_filhos, tipo_acumulado, ordem

-- ============================================================
-- 1. REMOVER objetos dependentes da coluna valor_* antiga
-- ============================================================

DROP TRIGGER IF EXISTS trg_log_metas_historico ON "metas";
DROP TRIGGER IF EXISTS trg_update_metas_timestamp ON "metas";
DROP VIEW IF EXISTS "v_metas_completa";
DROP VIEW IF EXISTS "v_auditoria_setor";

-- ============================================================
-- 2. REMOVER colunas antigas
-- ============================================================

ALTER TABLE "metas"
  DROP COLUMN IF EXISTS "acumulado",
  DROP COLUMN IF EXISTS "status",
  DROP COLUMN IF EXISTS "editavel";

ALTER TABLE "metas"
  DROP COLUMN IF EXISTS "valor_jan",
  DROP COLUMN IF EXISTS "valor_fev",
  DROP COLUMN IF EXISTS "valor_mar",
  DROP COLUMN IF EXISTS "valor_abr",
  DROP COLUMN IF EXISTS "valor_mai",
  DROP COLUMN IF EXISTS "valor_jun",
  DROP COLUMN IF EXISTS "valor_jul",
  DROP COLUMN IF EXISTS "valor_ago",
  DROP COLUMN IF EXISTS "valor_set",
  DROP COLUMN IF EXISTS "valor_out",
  DROP COLUMN IF EXISTS "valor_nov",
  DROP COLUMN IF EXISTS "valor_dez";

-- ============================================================
-- 3. ALTERAR colunas existentes
-- ============================================================

-- produto passa a ser opcional (só IC preenche)
ALTER TABLE "metas" ALTER COLUMN "produto" DROP NOT NULL;
ALTER TABLE "metas" ALTER COLUMN "produto" TYPE VARCHAR(255);

-- ============================================================
-- 4. ADICIONAR novos campos de configuração
-- ============================================================

ALTER TABLE "metas"
  ADD COLUMN "ordem"           INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "agrega_filhos"   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "tipo_acumulado"  VARCHAR(10) NOT NULL DEFAULT 'soma';
  -- tipo_acumulado: 'soma' | 'media'

-- ============================================================
-- 5. ADICIONAR colunas de META por mês (definidas pelo gerente)
-- ============================================================

ALTER TABLE "metas"
  ADD COLUMN "meta_jan" DECIMAL(15,4),
  ADD COLUMN "meta_fev" DECIMAL(15,4),
  ADD COLUMN "meta_mar" DECIMAL(15,4),
  ADD COLUMN "meta_abr" DECIMAL(15,4),
  ADD COLUMN "meta_mai" DECIMAL(15,4),
  ADD COLUMN "meta_jun" DECIMAL(15,4),
  ADD COLUMN "meta_jul" DECIMAL(15,4),
  ADD COLUMN "meta_ago" DECIMAL(15,4),
  ADD COLUMN "meta_set" DECIMAL(15,4),
  ADD COLUMN "meta_out" DECIMAL(15,4),
  ADD COLUMN "meta_nov" DECIMAL(15,4),
  ADD COLUMN "meta_dez" DECIMAL(15,4);

-- ============================================================
-- 6. ADICIONAR colunas de REAL por mês (definidas pelo responsável)
-- ============================================================

ALTER TABLE "metas"
  ADD COLUMN "real_jan" DECIMAL(15,4),
  ADD COLUMN "real_fev" DECIMAL(15,4),
  ADD COLUMN "real_mar" DECIMAL(15,4),
  ADD COLUMN "real_abr" DECIMAL(15,4),
  ADD COLUMN "real_mai" DECIMAL(15,4),
  ADD COLUMN "real_jun" DECIMAL(15,4),
  ADD COLUMN "real_jul" DECIMAL(15,4),
  ADD COLUMN "real_ago" DECIMAL(15,4),
  ADD COLUMN "real_set" DECIMAL(15,4),
  ADD COLUMN "real_out" DECIMAL(15,4),
  ADD COLUMN "real_nov" DECIMAL(15,4),
  ADD COLUMN "real_dez" DECIMAL(15,4);

-- ============================================================
-- 7. ADICIONAR colunas de STATUS por mês (calculadas)
-- ============================================================

ALTER TABLE "metas"
  ADD COLUMN "status_jan" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_jan" IS NULL OR "meta_jan" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_jan" >= "meta_jan" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_jan" <= "meta_jan" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_fev" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_fev" IS NULL OR "meta_fev" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_fev" >= "meta_fev" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_fev" <= "meta_fev" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_mar" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_mar" IS NULL OR "meta_mar" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_mar" >= "meta_mar" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_mar" <= "meta_mar" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_abr" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_abr" IS NULL OR "meta_abr" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_abr" >= "meta_abr" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_abr" <= "meta_abr" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_mai" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_mai" IS NULL OR "meta_mai" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_mai" >= "meta_mai" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_mai" <= "meta_mai" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_jun" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_jun" IS NULL OR "meta_jun" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_jun" >= "meta_jun" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_jun" <= "meta_jun" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_jul" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_jul" IS NULL OR "meta_jul" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_jul" >= "meta_jul" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_jul" <= "meta_jul" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_ago" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_ago" IS NULL OR "meta_ago" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_ago" >= "meta_ago" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_ago" <= "meta_ago" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_set" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_set" IS NULL OR "meta_set" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_set" >= "meta_set" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_set" <= "meta_set" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_out" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_out" IS NULL OR "meta_out" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_out" >= "meta_out" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_out" <= "meta_out" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_nov" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_nov" IS NULL OR "meta_nov" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_nov" >= "meta_nov" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_nov" <= "meta_nov" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED,

  ADD COLUMN "status_dez" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "real_dez" IS NULL OR "meta_dez" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "real_dez" >= "meta_dez" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "real_dez" <= "meta_dez" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED;

-- ============================================================
-- 8. ADICIONAR acumulados calculados
-- ============================================================

-- acum_real: soma ou média dos reais — calculado no backend (não GENERATED)
-- pois depende de tipo_acumulado que é string, e GENERATED AS não suporta IF dinâmico por coluna de texto
-- O backend calcula e armazena nesses campos

ALTER TABLE "metas"
  ADD COLUMN "acum_meta" DECIMAL(15,4),
  ADD COLUMN "acum_real" DECIMAL(15,4),
  ADD COLUMN "status_acum" "status_meta_type" GENERATED ALWAYS AS (
    CASE
      WHEN "acum_real" IS NULL OR "acum_meta" IS NULL THEN NULL
      WHEN "tipo_meta" = 'maior_melhor' AND "acum_real" >= "acum_meta" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'maior_melhor' THEN 'nok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' AND "acum_real" <= "acum_meta" THEN 'ok'::"status_meta_type"
      WHEN "tipo_meta" = 'menor_melhor' THEN 'nok'::"status_meta_type"
      ELSE NULL
    END
  ) STORED;

-- ============================================================
-- 9. REMOVER constraint antiga que obrigava IV a ter pai
--    (agora IC sem filhos também é válido — já tratado no backend)
-- ============================================================

ALTER TABLE "metas" DROP CONSTRAINT IF EXISTS "check_iv_tem_pai";

-- A regra volta como: IV deve ter pai, IC não pode ter pai — validado no backend
-- Mantemos a FK de pai_id mas sem o CHECK constraint rígido do banco

-- ============================================================
-- 10. ÍNDICES adicionais
-- ============================================================

CREATE INDEX IF NOT EXISTS "idx_metas_ordem" ON "metas"("setor_id", "ano", "ordem");
CREATE INDEX IF NOT EXISTS "idx_metas_produto" ON "metas"("produto") WHERE "produto" IS NOT NULL;

-- ============================================================
-- 11. RECRIAR views atualizadas
-- ============================================================

CREATE VIEW "v_metas_completa" AS
SELECT
  m."id",
  m."setor_id",
  s."nome"            AS "nome_setor",
  m."ano",
  m."ordem",
  m."produto",
  m."ic_iv",
  m."pai_id",
  m."indicador",
  m."responsavel",
  m."unidade",
  m."tipo_meta",
  m."agrega_filhos",
  m."tipo_acumulado",
  m."meta_ano",
  m."meta_jan",  m."real_jan",  m."status_jan",
  m."meta_fev",  m."real_fev",  m."status_fev",
  m."meta_mar",  m."real_mar",  m."status_mar",
  m."meta_abr",  m."real_abr",  m."status_abr",
  m."meta_mai",  m."real_mai",  m."status_mai",
  m."meta_jun",  m."real_jun",  m."status_jun",
  m."meta_jul",  m."real_jul",  m."status_jul",
  m."meta_ago",  m."real_ago",  m."status_ago",
  m."meta_set",  m."real_set",  m."status_set",
  m."meta_out",  m."real_out",  m."status_out",
  m."meta_nov",  m."real_nov",  m."status_nov",
  m."meta_dez",  m."real_dez",  m."status_dez",
  m."acum_meta",
  m."acum_real",
  m."status_acum",
  m."criado_em",
  m."atualizado_em",
  m."atualizado_por"
FROM "metas" m
JOIN "setores" s ON m."setor_id" = s."id";

CREATE VIEW "v_auditoria_setor" AS
SELECT
  a."id",
  a."setor_id",
  s."nome"        AS "nome_setor",
  a."usuario_id",
  u."nome"        AS "nome_usuario",
  a."acao",
  a."tabela",
  a."timestamp"
FROM "auditoria" a
JOIN "setores" s ON a."setor_id" = s."id"
JOIN "usuarios" u ON a."usuario_id" = u."id";

-- ============================================================
-- 12. RECRIAR triggers
-- ============================================================

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
