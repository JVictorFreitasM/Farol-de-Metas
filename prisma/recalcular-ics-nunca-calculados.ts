import { PrismaClient } from '@prisma/client'
import { recalcularAgregadoIC, MESES } from '../src/lib/metasCalc'

const prisma = new PrismaClient()

/**
 * O script de seed original (prisma/seed.ts) grava os valores de meta/real de cada linha
 * diretamente a partir da planilha Excel — inclusive para ICs com agrega_filhos=true, cujo
 * valor deveria ser CALCULADO a partir dos filhos (via recalcularAgregadoIC), não copiado da
 * planilha. Quando a planilha não trazia um valor para o próprio IC (comum, já que o Excel às
 * vezes só tinha os filhos preenchidos), o IC fica com acum_meta/acum_real nulos para sempre —
 * "nunca calculado" — até alguém editar um filho (o que dispara o recálculo automático do pai).
 *
 * Este script varre todos os ICs com agrega_filhos=true cujo acum_meta E acum_real estão nulos
 * (nunca foram calculados) e roda a agregação já configurada em cada um (tipo_agregacao_meta/
 * tipo_agregacao_real, sem alterar a configuração — diferente do fix dos ICs do Gustavo Borges,
 * que precisou trocar a configuração). Idempotente: como sempre recalcula a partir dos filhos
 * atuais, pode ser rodado de novo sem problema (só não faz nada em ICs que já têm valor).
 */
async function main() {
  const candidatos = await prisma.meta.findMany({
    where: { icIv: 'IC', agregaFilhos: true, ativo: true, acumMeta: null, acumReal: null },
    orderBy: [{ ano: 'asc' }, { indicador: 'asc' }],
  })

  if (candidatos.length === 0) {
    console.log('Nenhum IC agregador pendente de cálculo encontrado.')
    return
  }

  console.log(`Encontrados ${candidatos.length} ICs agregadores nunca calculados:\n`)

  for (const ic of candidatos) {
    const filhos = await prisma.meta.findMany({ where: { paiId: ic.id, ativo: true } })
    if (filhos.length === 0) {
      console.log(`   ⚠️ [${ic.ano}] "${ic.indicador}" não tem filhos ativos, pulando.`)
      continue
    }

    const agregado = recalcularAgregadoIC(filhos, {
      tipoAgregacaoMeta: ic.tipoAgregacaoMeta,
      tipoAgregacaoReal: ic.tipoAgregacaoReal,
      metaManualAcum: ic.metaManualAcum,
    })

    const dataMeses = Object.fromEntries([
      ...MESES.map((mes) => [`meta${mes}`, agregado.metaPorMes ? agregado.metaPorMes[mes] : undefined]),
      ...MESES.map((mes) => [`real${mes}`, agregado.realPorMes[mes]]),
    ])

    await prisma.meta.update({
      where: { id: ic.id },
      data: { ...dataMeses, acumMeta: agregado.acumMeta, acumReal: agregado.acumReal },
    })

    console.log(`   ✓ [${ic.ano}] "${ic.indicador}" (${filhos.length} filhos): acumMeta=${agregado.acumMeta} acumReal=${agregado.acumReal}`)
  }

  console.log('\n✅ Concluído!')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Erro:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
