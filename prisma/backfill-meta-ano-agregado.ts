import { PrismaClient } from '@prisma/client'
import { recalcularAgregadoIC } from '../src/lib/metasCalc'

const prisma = new PrismaClient()

/**
 * Até aqui, meta_ano de um IC agregador (agrega_ivs=true, tipo_agregacao_meta soma/media)
 * nunca era calculado a partir dos IVs — só metaJan..Dez e acum_meta eram (ver
 * recalcularAgregadoIC). Isso deixava meta_ano nulo para sempre em ICs cuja planilha original
 * só trazia o valor anual nos IVs, não no próprio IC (ex.: "Volume de MP( Cobre+PVC)",
 * "OBZ Geral"). recalcularAgregadoIC agora também retorna meta_ano (soma/média dos meta_ano
 * dos IVs, mesmo padrão de acum_meta); este script faz o backfill único para os ICs que já
 * existem no banco com meta_ano nulo. Dali em diante, toda edição num IV já recalcula o pai
 * automaticamente via recalcularPaiSeAgrega (metas.routes.ts).
 */
async function main() {
  const candidatos = await prisma.meta.findMany({
    where: {
      indicador: { icIv: 'IC', agregaIvs: true, tipoAgregacaoMeta: { in: ['soma', 'media'] } },
      ativo: true,
      metaAno: null,
    },
    include: { indicador: true },
    orderBy: [{ ano: 'asc' }],
  })

  if (candidatos.length === 0) {
    console.log('Nenhum IC agregador com meta_ano pendente de cálculo encontrado.')
    return
  }

  console.log(`Encontrados ${candidatos.length} ICs agregadores com meta_ano nulo:\n`)

  for (const ic of candidatos) {
    const ivsIndicadores = await prisma.indicador.findMany({ where: { paiId: ic.indicadorId }, select: { id: true } })
    const ivs = await prisma.meta.findMany({
      where: { indicadorId: { in: ivsIndicadores.map((f) => f.id) }, ano: ic.ano, ativo: true },
    })
    if (ivs.length === 0) {
      console.log(`   ⚠️ [${ic.ano}] "${ic.indicador.nome}" não tem IVs ativos, pulando.`)
      continue
    }

    const agregado = recalcularAgregadoIC(ivs, {
      tipoAgregacaoMeta: ic.indicador.tipoAgregacaoMeta,
      tipoAgregacaoReal: ic.indicador.tipoAgregacaoReal,
      metaManualAcum: ic.metaManualAcum,
      realManualAcum: ic.indicador.realManualAcum,
    })

    if (agregado.metaAno == null) {
      console.log(`   ⚠️ [${ic.ano}] "${ic.indicador.nome}": nenhum IV tem meta_ano preenchido, pulando.`)
      continue
    }

    await prisma.meta.update({ where: { id: ic.id }, data: { metaAno: agregado.metaAno } })
    console.log(`   ✓ [${ic.ano}] "${ic.indicador.nome}" (${ivs.length} IVs): meta_ano=${agregado.metaAno}`)
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
