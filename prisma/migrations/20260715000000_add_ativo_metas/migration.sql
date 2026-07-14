-- Migration: Adiciona inativação (soft delete) de indicadores — OS-008

ALTER TABLE "metas"
  ADD COLUMN "ativo" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "inativado_em" TIMESTAMP(3),
  ADD COLUMN "inativado_por" UUID;

ALTER TABLE "metas"
  ADD CONSTRAINT "metas_inativado_por_fkey"
  FOREIGN KEY ("inativado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "metas_ativo_idx" ON "metas"("ativo");
CREATE INDEX "metas_setor_id_ativo_idx" ON "metas"("setor_id", "ativo");
