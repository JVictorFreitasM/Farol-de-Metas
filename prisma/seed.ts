import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const setores = [
  { nome: "Anny Moraes", email: "anny.moraes@company.com" },
  { nome: "Davi", email: "davi@company.com" },
  { nome: "Francilane", email: "francilane@company.com" },
  { nome: "Francisca Adriele", email: "francisca.adriele@company.com" },
  { nome: "Gustavo Borges", email: "gustavo.borges@company.com" },
  { nome: "Maria Nadiane", email: "maria.nadiane@company.com" },
  { nome: "Orleans", email: "orleans@company.com" },
];

async function main() {
  for (const setor of setores) {
    await prisma.setor.upsert({
      where: { nome: setor.nome },
      update: {},
      create: setor,
    });
  }
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
