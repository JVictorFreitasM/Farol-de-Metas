// OS-009-B: vincula usuários de teste já existentes no Farol ao usuário correspondente
// criado no IdP, preenchendo Usuario.idpUserId a partir do email (elo entre os dois cadastros).
// Uso: preencher VINCULOS abaixo com os pares email -> sub do IdP e rodar:
//   npx ts-node scripts/vincular-idp-user.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const VINCULOS: { email: string; idpUserId: string }[] = [
  { email: 'admin@farol.com', idpUserId: '5e1826ee-a22e-40b8-889a-3e8f4af6fa22' },
  { email: 'anny@farol.com', idpUserId: 'bb1b99d3-fc22-4cb0-9785-01a7e25d2ada' },
]

async function main() {
  if (VINCULOS.length === 0) {
    console.log('Nenhum vínculo configurado em VINCULOS. Edite scripts/vincular-idp-user.ts antes de rodar.')
    return
  }

  for (const { email, idpUserId } of VINCULOS) {
    const usuario = await prisma.usuario.update({
      where: { email },
      data: { idpUserId },
    })
    console.log(`Vinculado: ${usuario.email} -> ${idpUserId}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
