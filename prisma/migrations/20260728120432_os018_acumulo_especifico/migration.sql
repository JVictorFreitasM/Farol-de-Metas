-- OS-018: acúmulo restrito a um intervalo de meses, configurado por linha de Meta, com
-- intervalos independentes para Meta e Real.
--
-- Escrita à mão em vez de gerada por `prisma migrate dev`: o diff automático do Prisma tenta
-- também mexer em `status_*`/`status_acum` (colunas GENERATED ALWAYS AS no banco, fora do
-- controle do Prisma Client) e falha com "column is a generated column" — drift pré-existente
-- entre o schema.prisma (que não modela essas colunas como geradas) e o banco real, sem relação
-- com esta OS. Esta migration contém só as colunas novas.
ALTER TABLE "metas"
  ADD COLUMN "acumulo_especifico"    BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "acum_meta_mes_inicio"  VARCHAR(3),
  ADD COLUMN "acum_meta_mes_fim"     VARCHAR(3),
  ADD COLUMN "acum_real_mes_inicio"  VARCHAR(3),
  ADD COLUMN "acum_real_mes_fim"     VARCHAR(3);
