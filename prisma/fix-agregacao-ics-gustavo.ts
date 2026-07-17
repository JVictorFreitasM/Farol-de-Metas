import { PrismaClient } from '@prisma/client'
import { recalcularAgregadoIC, MESES } from '../src/lib/metasCalc'

const prisma = new PrismaClient()

/**
 * Os ICs "Sistemas", "Equipamentos e Serviços" e "Inventário" do setor Gustavo Borges nunca
 * tiveram "real" preenchido diretamente (agrega_filhos=false) — mas seu real acumulado deveria
 * ser calculado como proporção agregada dos filhos, replicando a fórmula da planilha original:
 *   Acum. Real do IC = SOMA(acum_real dos filhos) / SOMA(acum_meta dos filhos)
 * Isso já existe no sistema como tipo_agregacao_real = "proporcao_agregada", disponível na
 * criação de novos ICs com filhos — este script aplica essa configuração aos 3 ICs já
 * existentes (nos 3 anos) e persiste o valor calculado.
 *
 * A meta desses ICs (meta_ano ~0.98/0.95/1, unidade "%") é um alvo percentual fixo definido
 * pelo gerente, não uma soma dos valores brutos dos filhos (que estão em outras unidades/
 * escalas, ex: contagens, R$) — por isso tipo_agregacao_meta = "meta_manual", usando o
 * meta_ano do próprio IC como valor fixo (não o acum_meta antigo, que era apenas a soma das
 * 12 células mensais repetindo esse mesmo alvo — um artefato do formato antigo, não o alvo
 * real). Só o Real passa a ser calculado a partir dos filhos; a Meta continua um valor fixo
 * (as células mensais de Meta, que antes repetiam o mesmo valor todo mês, ficam em branco —
 * só o acumulado anual importa para esse tipo de indicador).
 *
 * tipo_acumulado também muda de "soma" para "media": os 12 meses de Real passam a guardar a
 * proporção agregada MENSAL dos filhos (uma razão ~1.0 = ~100%, não uma quantidade); somar 12
 * meses de ~100% daria ~1200% sem sentido em qualquer cálculo que re-acumule a partir dos meses
 * (ex: GET /metas/:id/comparativo, /acumulado-periodo) — média é a agregação correta para uma
 * série de percentuais mensais.
 */
const ICS_ALVO = ['Sistemas', 'Equipamentos e Serviços', 'Inventário']
const ANOS = [2024, 2025, 2026]

async function main() {
  const setor = await prisma.setor.findFirstOrThrow({ where: { nome: 'Gustavo Borges' } })

  for (const ano of ANOS) {
    console.log(`\n📊 Ano ${ano}`)
    for (const nome of ICS_ALVO) {
      const ic = await prisma.meta.findFirst({ where: { setorId: setor.id, ano, indicador: nome, icIv: 'IC' } })
      if (!ic) {
        console.log(`   ⚠️ IC "${nome}" não encontrado, pulando.`)
        continue
      }

      const metaManualAcum = ic.metaAno // alvo anual fixo do IC (ex: 0.98 = 98%), não o acum_meta antigo
      const filhos = await prisma.meta.findMany({ where: { paiId: ic.id, ativo: true } })
      const agregado = recalcularAgregadoIC(filhos, {
        tipoAgregacaoMeta: 'meta_manual',
        tipoAgregacaoReal: 'proporcao_agregada',
        metaManualAcum,
      })

      const dataMeses = Object.fromEntries([
        ...MESES.map((mes) => [`meta${mes}`, agregado.metaPorMes[mes]]),
        ...MESES.map((mes) => [`real${mes}`, agregado.realPorMes[mes]]),
      ])

      await prisma.meta.update({
        where: { id: ic.id },
        data: {
          agregaFilhos: true,
          tipoAgregacaoMeta: 'meta_manual',
          tipoAgregacaoReal: 'proporcao_agregada',
          tipoAcumulado: 'media',
          metaManualAcum,
          ...dataMeses,
          acumMeta: agregado.acumMeta,
          acumReal: agregado.acumReal,
        },
      })

      const percentual =
        agregado.acumMeta && !agregado.acumMeta.isZero() ? agregado.acumReal?.div(agregado.acumMeta).mul(100).toDecimalPlaces(1) : null
      console.log(`   ✓ "${nome}": acumMeta=${agregado.acumMeta} acumReal=${agregado.acumReal} (${percentual}% da meta)`)
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
