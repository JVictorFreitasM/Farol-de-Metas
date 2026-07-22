import { PrismaClient } from '@prisma/client'
import { recalcularAgregadoIC, MESES } from '../src/lib/metasCalc'

const prisma = new PrismaClient()

/**
 * O script de seed original (prisma/seed.ts) grava os valores de meta/real de cada linha
 * diretamente a partir da planilha Excel — inclusive para ICs com agrega_ivs=true, cujo
 * valor deveria ser CALCULADO a partir dos IVs (via recalcularAgregadoIC), não copiado da
 * planilha. Quando a planilha não trazia um valor para o próprio IC (comum, já que o Excel às
 * vezes só tinha os IVs preenchidos), o IC fica com acum_meta/acum_real nulos para sempre —
 * "nunca calculado" — até alguém editar um IV (o que dispara o recálculo automático do pai).
 *
 * Este script varre todos os ICs com agrega_ivs=true cujo acum_meta E acum_real estão nulos
 * (nunca foram calculados) e roda a agregação já configurada em cada um (tipo_agregacao_meta/
 * tipo_agregacao_real, sem alterar a configuração — diferente do fix dos ICs do Gustavo Borges,
 * que precisou trocar a configuração). Idempotente: como sempre recalcula a partir dos IVs
 * atuais, pode ser rodado de novo sem problema (só não faz nada em ICs que já têm valor).
 *
 * OS-013: agrega_ivs/tipo_agregacao_meta/tipo_agregacao_real agora vivem em Indicador —
 * o candidato é filtrado via a relação `indicador`, e os IVs são resolvidos por
 * indicador.ivs (hierarquia fixa) restrita ao mesmo ano do IC.
 */
async function main() {
  const candidatos = await prisma.meta.findMany({
    where: { indicador: { icIv: 'IC', agregaIvs: true }, ativo: true, acumMeta: null, acumReal: null },
    include: { indicador: true },
    orderBy: [{ ano: 'asc' }],
  })

  if (candidatos.length === 0) {
    console.log('Nenhum IC agregador pendente de cálculo encontrado.')
    return
  }

  console.log(`Encontrados ${candidatos.length} ICs agregadores nunca calculados:\n`)

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

    const dataMeses = Object.fromEntries([
      ...MESES.map((mes) => [`meta${mes}`, agregado.metaPorMes ? agregado.metaPorMes[mes] : undefined]),
      ...MESES.map((mes) => [`real${mes}`, agregado.realPorMes ? agregado.realPorMes[mes] : undefined]),
    ])

    await prisma.meta.update({
      where: { id: ic.id },
      data: { ...dataMeses, metaAno: agregado.metaAno, acumMeta: agregado.acumMeta, acumReal: agregado.acumReal },
    })

    console.log(`   ✓ [${ic.ano}] "${ic.indicador.nome}" (${ivs.length} IVs): acumMeta=${agregado.acumMeta} acumReal=${agregado.acumReal}`)
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
