-- OS-016: as ALTER TABLE ... DROP DEFAULT geradas automaticamente pelo Prisma para "id" (todas
-- as tabelas) e "status_*"/"status_acum" (metas) foram removidas deste arquivo — id.DEFAULT
-- é usado pelo trigger log_metas_historico (ver OS-013) e status_* são colunas GENERATED ALWAYS
-- AS no banco, que nem aceitam DROP DEFAULT (erro 42601). Só as tabelas novas desta OS seguem.

-- CreateTable
CREATE TABLE "configuracao_sistema" (
    "id" UUID NOT NULL,
    "dia_limite_preenchimento" INTEGER NOT NULL DEFAULT 15,
    "atualizado_por" UUID,
    "atualizado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracao_sistema_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "desbloqueios_preenchimento" (
    "id" UUID NOT NULL,
    "setor_id" UUID NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "liberado_por" UUID NOT NULL,
    "liberado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "desbloqueios_preenchimento_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "desbloqueios_preenchimento_setor_id_idx" ON "desbloqueios_preenchimento"("setor_id");

-- CreateIndex
CREATE UNIQUE INDEX "desbloqueios_preenchimento_setor_id_ano_mes_key" ON "desbloqueios_preenchimento"("setor_id", "ano", "mes");

-- AddForeignKey
ALTER TABLE "desbloqueios_preenchimento" ADD CONSTRAINT "desbloqueios_preenchimento_setor_id_fkey" FOREIGN KEY ("setor_id") REFERENCES "setores"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
