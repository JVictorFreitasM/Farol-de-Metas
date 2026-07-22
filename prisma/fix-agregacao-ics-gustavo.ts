import { PrismaClient } from '@prisma/client'
import { recalcularAgregadoIC, MESES } from '../src/lib/metasCalc'

const prisma = new PrismaClient()

/**
 * Os ICs "Sistemas", "Equipamentos e Serviços" e "Inventário" do setor Gustavo Borges nunca
 * tiveram "real" preenchido diretamente (agrega_ivs=false) — mas seu real acumulado deveria
 * ser calculado como proporção agregada dos IVs, replicando a fórmula da planilha original:
 *   Acum. Real do IC = SOMA(acum_real dos IVs) / SOMA(acum_meta dos IVs)
 * Isso já existe no sistema como tipo_agregacao_real = "proporcao_agregada", disponível na
 * criação de novos ICs com IVs — este script aplica essa configuração aos 3 ICs já
 * existentes (nos 3 anos) e persiste o valor calculado.
 *
 * A Meta desses ICs continua sendo digitada manualmente mês a mês pelo gerente, exatamente
 * como antes — só o Real passa a ser calculado automaticamente a partir dos IVs. Por isso
 * tipo_agregacao_meta = "meta_manual", que nesse sistema significa "a Meta não é derivada dos
 * IVs" (ver recalcularAgregadoIC): a agregação nunca sobrescreve metaJan..Dez, e PUT
 * /metas/:id/meta continua liberado para editar a Meta mês a mês mesmo com agrega_ivs=true.
 * Este script restaura o valor mensal de Meta que já existia antes (repetindo meta_ano em
 * todos os meses, igual ao dado original da planilha) como ponto de partida editável.
 *
 * tipo_acumulado muda de "soma" para "media": os 12 meses de Real passam a guardar a proporção
 * agregada MENSAL dos IVs (uma razão ~1.0 = ~100%, não uma quantidade); somar 12 meses de
 * ~100% daria ~1200% sem sentido em qualquer cálculo que re-acumule a partir dos meses (ex: GET
 * /metas/:id/comparativo, /acumulado-periodo) — média é a agregação correta para uma série de
 * percentuais mensais. A Meta (agora manual) usa a mesma tipo_acumulado, então também é
 * mediada — como todo mês tem o mesmo valor (meta_ano repetido), a média bate com o próprio
 * meta_ano.
 *
 * OS-013: agrega_ivs/tipo_agregacao_meta/tipo_agregacao_real/tipo_acumulado agora vivem em
 * Indicador (fixos entre anos) — só precisam ser trocados uma vez, fora do loop de anos. Os
 * valores mensais/acumulados (por ano) continuam em Meta.
 */
const ICS_ALVO = ['Sistemas', 'Equipamentos e Serviços', 'Inventário']
const ANOS = [2024, 2025, 2026]

async function main() {
  const setor = await prisma.setor.findFirstOrThrow({ where: { nome: 'TI' } })

  for (const nome of ICS_ALVO) {
    const indicador = await prisma.indicador.findFirst({ where: { setorId: setor.id, nome, icIv: 'IC' } })
    if (!indicador) {
      console.log(`\n⚠️ Indicador "${nome}" não encontrado, pulando.`)
      continue
    }

    await prisma.indicador.update({
      where: { id: indicador.id },
      data: {
        agregaIvs: true,
        tipoAgregacaoMeta: 'meta_manual',
        tipoAgregacaoReal: 'proporcao_agregada',
        tipoAcumuladoMeta: 'media',
        tipoAcumuladoReal: 'media',
      },
    })

    console.log(`\n📊 "${nome}"`)
    for (const ano of ANOS) {
      const ic = await prisma.meta.findFirst({ where: { indicadorId: indicador.id, ano } })
      if (!ic) {
        console.log(`   ⚠️ [${ano}] linha de meta não encontrada, pulando.`)
        continue
      }

      const ivsIndicadores = await prisma.indicador.findMany({ where: { paiId: indicador.id }, select: { id: true } })
      const ivs = await prisma.meta.findMany({
        where: { indicadorId: { in: ivsIndicadores.map((f) => f.id) }, ano, ativo: true },
      })
      const agregado = recalcularAgregadoIC(ivs, {
        tipoAgregacaoMeta: 'meta_manual',
        tipoAgregacaoReal: 'proporcao_agregada',
        metaManualAcum: null, // não usado mais nesse modo — meta é digitada mês a mês
        realManualAcum: null, // não usado — tipo_agregacao_real aqui é proporcao_agregada, não real_manual
      })

      // Meta: restaura o valor mensal original (meta_ano repetido em todo mês), editável
      // daqui pra frente via PUT /:id/meta — recalcularAgregadoIC nunca mexe nisso.
      const metaMensal = ic.metaAno
      const dataMesesMeta = Object.fromEntries(MESES.map((mes) => [`meta${mes}`, metaMensal ?? undefined]))
      const dataMesesReal = Object.fromEntries(
        MESES.map((mes) => [`real${mes}`, agregado.realPorMes ? agregado.realPorMes[mes] : undefined])
      )

      await prisma.meta.update({
        where: { id: ic.id },
        data: {
          metaManualAcum: null,
          ...dataMesesMeta,
          ...dataMesesReal,
          acumMeta: metaMensal, // média de 12 meses iguais = o próprio valor
          acumReal: agregado.acumReal,
        },
      })

      const percentual = metaMensal && !metaMensal.isZero() ? agregado.acumReal?.div(metaMensal).mul(100).toDecimalPlaces(1) : null
      console.log(`   ✓ [${ano}] metaMensal=${metaMensal} acumReal=${agregado.acumReal} (${percentual}% da meta)`)
    }
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
