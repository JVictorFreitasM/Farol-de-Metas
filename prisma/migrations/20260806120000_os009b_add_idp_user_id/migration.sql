-- OS-009-B: vínculo entre o usuário local do Farol e o usuário correspondente no IdP
-- (claim "sub"). Autenticação passa a ser feita pelo IdP; este campo é o elo entre o
-- token recebido e o registro local de Usuario.
--
-- Escrita à mão, seguindo o mesmo padrão da migration OS-018: `prisma migrate dev` falha
-- neste banco por causa de drift pré-existente entre schema.prisma e as colunas
-- GENERATED ALWAYS AS (status_*/status_acum), sem relação com esta OS.
ALTER TABLE "usuarios"
  ADD COLUMN "idp_user_id" UUID;

CREATE UNIQUE INDEX "usuarios_idp_user_id_key" ON "usuarios"("idp_user_id");
