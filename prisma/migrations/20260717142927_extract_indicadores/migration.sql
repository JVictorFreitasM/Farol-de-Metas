/*
  Warnings:

  - You are about to drop the column `agrega_filhos` on the `metas` table. All the data in the column will be lost.
  - You are about to drop the column `ic_iv` on the `metas` table. All the data in the column will be lost.
  - You are about to drop the column `indicador` on the `metas` table. All the data in the column will be lost.
  - You are about to drop the column `pai_id` on the `metas` table. All the data in the column will be lost.
  - You are about to drop the column `produto_id` on the `metas` table. All the data in the column will be lost.
  - You are about to drop the column `tipo_acumulado` on the `metas` table. All the data in the column will be lost.
  - You are about to drop the column `tipo_agregacao_meta` on the `metas` table. All the data in the column will be lost.
  - You are about to drop the column `tipo_agregacao_real` on the `metas` table. All the data in the column will be lost.
  - You are about to drop the column `unidade` on the `metas` table. All the data in the column will be lost.
  - You are about to alter the column `meta_ano` on the `metas` table. The data in that column could be lost. The data in that column will be cast from `Decimal(15,2)` to `Decimal(15,4)`.
  - Added the required column `indicador_id` to the `metas` table without a default value. This is not possible if the table is not empty.

*/

-- Views criadas fora do Prisma (banco.sql) que dependem de colunas alteradas/removidas nesta
-- migration. Precisam ser derrubadas antes dos ALTER TABLE e recriadas no final contra o novo
-- esquema (v_metas_completa passa a fazer join com a nova tabela indicadores).
DROP VIEW IF EXISTS "v_metas_completa";
DROP VIEW IF EXISTS "v_auditoria_setor";

-- OS-015: "real_manual" — Real de um IC agregador digitado direto, sem derivar dos filhos
-- (mesmo padrão do "meta_manual" já existente). Só usado por indicador.tipo_agregacao_real.
ALTER TYPE "tipo_agregacao_real_type" ADD VALUE 'real_manual';

-- DropForeignKey
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_setor_id_fkey";

-- DropForeignKey
ALTER TABLE "auditoria" DROP CONSTRAINT "auditoria_usuario_id_fkey";

-- DropForeignKey
ALTER TABLE "metas" DROP CONSTRAINT "metas_atualizado_por_fkey";

-- DropForeignKey
ALTER TABLE "metas" DROP CONSTRAINT "metas_pai_id_fkey";

-- DropForeignKey
ALTER TABLE "metas" DROP CONSTRAINT "metas_produto_id_fkey";

-- DropForeignKey
ALTER TABLE "metas" DROP CONSTRAINT "metas_setor_id_fkey";

-- DropForeignKey
ALTER TABLE "metas_historico" DROP CONSTRAINT "metas_historico_alterado_por_fkey";

-- DropForeignKey
ALTER TABLE "metas_historico" DROP CONSTRAINT "metas_historico_metas_id_fkey";

-- DropForeignKey
ALTER TABLE "usuarios" DROP CONSTRAINT "usuarios_setor_id_fkey";

-- DropIndex
DROP INDEX "idx_metas_ic_iv";

-- DropIndex
DROP INDEX "idx_metas_pai_id";

-- DropIndex
DROP INDEX "metas_produto_id_idx";

-- AlterTable
-- "id" DROP DEFAULT removido deste diff: metas_historico tem um trigger (fora do Prisma, ver
-- banco.sql) que insere linhas sem especificar "id", contando com o DEFAULT uuid_generate_v4()
-- da coluna — dropar o default quebra esse trigger em todo UPDATE de metas.
ALTER TABLE "auditoria" ALTER COLUMN "timestamp" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "metas" DROP COLUMN "agrega_filhos",
DROP COLUMN "ic_iv",
DROP COLUMN "indicador",
DROP COLUMN "pai_id",
DROP COLUMN "produto_id",
DROP COLUMN "tipo_acumulado",
DROP COLUMN "tipo_agregacao_meta",
DROP COLUMN "tipo_agregacao_real",
DROP COLUMN "unidade",
ADD COLUMN     "indicador_id" UUID NOT NULL,
ADD COLUMN     "acum_meta_manual" DECIMAL(15,4),
ADD COLUMN     "acum_real_manual" DECIMAL(15,4),
ALTER COLUMN "meta_ano" SET DATA TYPE DECIMAL(15,4),
ALTER COLUMN "criado_em" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "atualizado_em" SET DATA TYPE TIMESTAMP(3);
-- status_jan..status_dez e status_acum são colunas GENERATED ALWAYS AS no banco (não têm
-- DEFAULT de verdade — Prisma não modela colunas geradas, então essa parte do diff é ruído).

-- AlterTable
ALTER TABLE "metas_historico" ALTER COLUMN "alterado_em" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "setores" ALTER COLUMN "criado_em" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "atualizado_em" SET DATA TYPE TIMESTAMP(3);

-- AlterTable
ALTER TABLE "usuarios" ALTER COLUMN "ultimo_acesso" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "criado_em" SET DATA TYPE TIMESTAMP(3),
ALTER COLUMN "atualizado_em" SET DATA TYPE TIMESTAMP(3);

-- CreateTable
CREATE TABLE "indicadores" (
    "id" UUID NOT NULL,
    "setor_id" UUID NOT NULL,
    "nome" VARCHAR(500) NOT NULL,
    "ic_iv" "ic_iv_type" NOT NULL,
    "unidade" VARCHAR(50) NOT NULL,
    "pai_id" UUID,
    "produto_id" UUID,
    "agrega_filhos" BOOLEAN NOT NULL DEFAULT false,
    "tipo_acumulado_meta" VARCHAR(10) NOT NULL DEFAULT 'soma',
    "tipo_acumulado_real" VARCHAR(10) NOT NULL DEFAULT 'soma',
    "tipo_agregacao_meta" "tipo_agregacao_meta_type" NOT NULL DEFAULT 'soma',
    "tipo_agregacao_real" "tipo_agregacao_real_type" NOT NULL DEFAULT 'soma',
    "real_manual_acum" DECIMAL(15,4),
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "indicadores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "indicadores_setor_id_idx" ON "indicadores"("setor_id");

-- CreateIndex
CREATE INDEX "indicadores_pai_id_idx" ON "indicadores"("pai_id");

-- CreateIndex
CREATE INDEX "indicadores_produto_id_idx" ON "indicadores"("produto_id");

-- CreateIndex
CREATE UNIQUE INDEX "indicadores_nome_setor_id_key" ON "indicadores"("nome", "setor_id");

-- CreateIndex
CREATE INDEX "metas_indicador_id_idx" ON "metas"("indicador_id");

-- CreateIndex
CREATE INDEX "metas_indicador_id_ano_idx" ON "metas"("indicador_id", "ano");

-- AddForeignKey
ALTER TABLE "indicadores" ADD CONSTRAINT "indicadores_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicadores" ADD CONSTRAINT "indicadores_pai_id_fkey" FOREIGN KEY ("pai_id") REFERENCES "indicadores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "indicadores" ADD CONSTRAINT "indicadores_produto_id_fkey" FOREIGN KEY ("produto_id") REFERENCES "produtos"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas" ADD CONSTRAINT "metas_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas" ADD CONSTRAINT "metas_indicador_id_fkey" FOREIGN KEY ("indicador_id") REFERENCES "indicadores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas" ADD CONSTRAINT "metas_atualizado_por_fkey" FOREIGN KEY ("atualizado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_historico" ADD CONSTRAINT "metas_historico_metas_id_fkey" FOREIGN KEY ("metas_id") REFERENCES "metas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metas_historico" ADD CONSTRAINT "metas_historico_alterado_por_fkey" FOREIGN KEY ("alterado_por") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_fkey" FOREIGN KEY ("usuario_id") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- RenameIndex
ALTER INDEX "idx_auditoria_acao" RENAME TO "auditoria_acao_idx";

-- RenameIndex
ALTER INDEX "idx_auditoria_setor_id" RENAME TO "auditoria_setor_id_idx";

-- RenameIndex
ALTER INDEX "idx_auditoria_timestamp" RENAME TO "auditoria_timestamp_idx";

-- RenameIndex
ALTER INDEX "idx_auditoria_usuario_id" RENAME TO "auditoria_usuario_id_idx";

-- RenameIndex
ALTER INDEX "idx_metas_ano" RENAME TO "metas_ano_idx";

-- RenameIndex
ALTER INDEX "idx_metas_ordem" RENAME TO "metas_setor_id_ano_ordem_idx";

-- RenameIndex
ALTER INDEX "idx_metas_setor_ano" RENAME TO "metas_setor_id_ano_idx";

-- RenameIndex
ALTER INDEX "idx_metas_setor_id" RENAME TO "metas_setor_id_idx";

-- RenameIndex
ALTER INDEX "idx_metas_historico_alterado_em" RENAME TO "metas_historico_alterado_em_idx";

-- RenameIndex
ALTER INDEX "idx_metas_historico_metas_id" RENAME TO "metas_historico_metas_id_idx";

-- RenameIndex
ALTER INDEX "idx_setores_email" RENAME TO "setores_email_idx";

-- RenameIndex
ALTER INDEX "idx_setores_nome" RENAME TO "setores_nome_idx";

-- RenameIndex
ALTER INDEX "idx_usuarios_email" RENAME TO "usuarios_email_idx";

-- RenameIndex
ALTER INDEX "idx_usuarios_role" RENAME TO "usuarios_role_idx";

-- RenameIndex
ALTER INDEX "idx_usuarios_setor_id" RENAME TO "usuarios_setor_id_idx";

-- Recria as views derrubadas no início da migration.
CREATE VIEW "v_auditoria_setor" AS
 SELECT a.id,
    a.setor_id,
    s.nome AS nome_setor,
    a.usuario_id,
    u.nome AS nome_usuario,
    a.acao,
    a.tabela,
    a."timestamp"
   FROM ((auditoria a
     JOIN setores s ON ((a.setor_id = s.id)))
     JOIN usuarios u ON ((a.usuario_id = u.id)));

-- v_metas_completa (OS-013): nome/unidade/ic_iv/pai_id/produto_id/agrega_filhos/tipo_acumulado
-- agora vêm de indicadores via join, em vez de colunas diretas de metas.
CREATE VIEW "v_metas_completa" AS
 SELECT m.id,
    m.setor_id,
    s.nome AS nome_setor,
    m.ano,
    m.ordem,
    i.produto_id,
    p.nome AS nome_produto,
    i.ic_iv,
    i.pai_id,
    i.nome AS indicador,
    m.responsavel,
    i.unidade,
    m.tipo_meta,
    i.agrega_filhos,
    i.tipo_acumulado_meta,
    i.tipo_acumulado_real,
    m.meta_ano,
    m.meta_jan,
    m.real_jan,
    m.status_jan,
    m.meta_fev,
    m.real_fev,
    m.status_fev,
    m.meta_mar,
    m.real_mar,
    m.status_mar,
    m.meta_abr,
    m.real_abr,
    m.status_abr,
    m.meta_mai,
    m.real_mai,
    m.status_mai,
    m.meta_jun,
    m.real_jun,
    m.status_jun,
    m.meta_jul,
    m.real_jul,
    m.status_jul,
    m.meta_ago,
    m.real_ago,
    m.status_ago,
    m.meta_set,
    m.real_set,
    m.status_set,
    m.meta_out,
    m.real_out,
    m.status_out,
    m.meta_nov,
    m.real_nov,
    m.status_nov,
    m.meta_dez,
    m.real_dez,
    m.status_dez,
    m.acum_meta,
    m.acum_real,
    m.status_acum,
    m.criado_em,
    m.atualizado_em,
    m.atualizado_por
   FROM (((metas m
     JOIN setores s ON ((m.setor_id = s.id)))
     JOIN indicadores i ON ((m.indicador_id = i.id)))
     LEFT JOIN produtos p ON ((i.produto_id = p.id)));
