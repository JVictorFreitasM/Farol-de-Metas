-- Migration: Cria entidade Produto e migra o agrupador visual "produto" (texto livre) da tabela metas
-- para uma tabela produtos própria, associada via metas.produto_id.

-- ============================================================
-- 1. Novo enum de status de produto
-- ============================================================
CREATE TYPE "status_produto_type" AS ENUM ('ativo', 'inativo');

-- ============================================================
-- 2. Tabela produtos
-- ============================================================
CREATE TABLE "produtos" (
  "id"             UUID NOT NULL DEFAULT gen_random_uuid(),
  "nome"           VARCHAR(255) NOT NULL,
  "descricao"      TEXT,
  "setor_id"       UUID NOT NULL,
  "status"         "status_produto_type" NOT NULL DEFAULT 'ativo',
  "criado_por"     UUID NOT NULL,
  "criado_em"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_em"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "atualizado_por" UUID,

  CONSTRAINT "produtos_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "produtos_setor_id_fkey" FOREIGN KEY ("setor_id")
    REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "produtos_criado_por_fkey" FOREIGN KEY ("criado_por")
    REFERENCES "usuarios"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "produtos_atualizado_por_fkey" FOREIGN KEY ("atualizado_por")
    REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "produtos_nome_setor_id_key" ON "produtos"("nome", "setor_id");
CREATE INDEX "produtos_setor_id_status_idx" ON "produtos"("setor_id", "status");
CREATE INDEX "produtos_nome_idx" ON "produtos"("nome");
CREATE INDEX "produtos_criado_em_idx" ON "produtos"("criado_em");

-- ============================================================
-- 3. Backfill: cria um produto para cada (setor_id, produto) distinto já usado em metas
-- ============================================================
INSERT INTO "produtos" ("id", "nome", "setor_id", "criado_por")
SELECT gen_random_uuid(), t.produto, t.setor_id, u.id
FROM (
  SELECT DISTINCT "produto", "setor_id" FROM "metas" WHERE "produto" IS NOT NULL
) t
CROSS JOIN LATERAL (
  SELECT "id" FROM "usuarios" ORDER BY "criado_em" ASC LIMIT 1
) u;

-- ============================================================
-- 4. Nova coluna produto_id em metas, populada a partir do backfill
-- ============================================================
ALTER TABLE "metas" ADD COLUMN "produto_id" UUID;

UPDATE "metas" m
SET "produto_id" = p."id"
FROM "produtos" p
WHERE p."nome" = m."produto" AND p."setor_id" = m."setor_id";

ALTER TABLE "metas" ADD CONSTRAINT "metas_produto_id_fkey"
  FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "metas_produto_id_idx" ON "metas"("produto_id");

-- ============================================================
-- 5. Recria a view v_metas_completa sem a coluna produto (texto livre)
-- ============================================================
DROP VIEW IF EXISTS "v_metas_completa";

CREATE VIEW "v_metas_completa" AS
SELECT
  m."id",
  m."setor_id",
  s."nome"            AS "nome_setor",
  m."ano",
  m."ordem",
  m."produto_id",
  p."nome"            AS "nome_produto",
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
JOIN "setores" s ON m."setor_id" = s."id"
LEFT JOIN "produtos" p ON m."produto_id" = p."id";

-- ============================================================
-- 6. Remove o índice e a coluna antiga de texto livre
-- ============================================================
DROP INDEX IF EXISTS "idx_metas_produto";
ALTER TABLE "metas" DROP COLUMN "produto";
