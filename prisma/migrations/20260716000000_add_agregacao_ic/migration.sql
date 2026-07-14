-- Migration: Regras separadas de agregação Meta/Real para IC com agrega_filhos=true — OS-009

CREATE TYPE "tipo_agregacao_meta_type" AS ENUM ('soma', 'media', 'meta_manual');
CREATE TYPE "tipo_agregacao_real_type" AS ENUM ('soma', 'media', 'proporcao_agregada');

ALTER TABLE "metas"
  ADD COLUMN "tipo_agregacao_meta" "tipo_agregacao_meta_type" NOT NULL DEFAULT 'soma',
  ADD COLUMN "tipo_agregacao_real" "tipo_agregacao_real_type" NOT NULL DEFAULT 'soma',
  ADD COLUMN "meta_manual_acum" DECIMAL(15,4);
