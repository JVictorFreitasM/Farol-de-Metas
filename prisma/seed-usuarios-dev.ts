import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";

const prisma = new PrismaClient();

async function main() {
  const gustavo = await prisma.setor.findUniqueOrThrow({ where: { nome: "TI" } });

  const senhaHash = await hashPassword("senha123");

  await prisma.usuario.upsert({
    where: { email: "gustavo.borges@company.com" },
    update: { setorId: gustavo.id },
    create: {
      email: "gustavo.borges@company.com",
      senhaHash,
      setorId: gustavo.id,
      nome: "Gustavo Borges",
      role: "responsavel",
    },
  });

  await prisma.usuario.upsert({
    where: { email: "gerente@company.com" },
    update: {},
    create: {
      email: "gerente@company.com",
      senhaHash,
      setorId: null,
      nome: "Gerente Geral",
      role: "gerente",
    },
  });

  console.log("Usuários de teste criados (senha: senha123)");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
