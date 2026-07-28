import { PrismaClient } from '@prisma/client'
import { calcularAcumuladoLinha } from '../src/lib/metasCalc'

const prisma = new PrismaClient()

/**
 * OS-018: corrige a classificação do indicador "Acidentes - MDI" (setor Segurança do
 * Trabalho), identificada na auditoria de regressão da OS-017 (linha 23 da planilha, unidade
 * "nº", acumulado inconclusivo — nem soma nem média dos 12 meses batiam com o valor da
 * planilha). O acumulado de Meta desse indicador é um teto anual (1 acidente MDI tolerado no
 * ano) reafirmado mês a mês, não uma quantidade a somar — a config atual (tipo_acumulado_meta=
 * "soma") faz o sistema somar os meses (ex: 11 em 2025, com meta=1 em 11 dos 12 meses) em vez
 * de mostrar o teto (1), que é o valor de negócio correto confirmado nesta OS.
 *
 * Ajusta indicador.tipo_acumulado_meta para "manual" (fixo entre anos, igual ao seed já
 * corrigido em prisma/metas-seed-data.ts) e, para cada linha de Meta já existente desse
 * indicador, preenche acum_meta_manual=1 e recalcula acum_meta a partir da nova config — sem
 * mexer no lado Real (tipo_acumulado_real="soma" já bate com a planilha, não faz parte desta
 * correção) nem nos valores mês a mês (histórico/rastreio, preservados como estão).
 */
const NOME_INDICADOR = 'Acidentes - MDI'
const NOME_SETOR = 'Segurança do Trabalho'
const TETO_ANUAL = 1

async function main() {
  const setor = await prisma.setor.findFirst({ where: { nome: NOME_SETOR } })
  if (!setor) {
    console.log(`⚠️ Setor "${NOME_SETOR}" não encontrado — nada a fazer.`)
    return
  }

  const indicador = await prisma.indicador.findFirst({ where: { setorId: setor.id, nome: NOME_INDICADOR } })
  if (!indicador) {
    console.log(`⚠️ Indicador "${NOME_INDICADOR}" não encontrado no setor "${NOME_SETOR}" — nada a fazer.`)
    return
  }

  if (indicador.tipoAcumuladoMeta === 'manual') {
    console.log(`✓ Indicador "${NOME_INDICADOR}" já está com tipo_acumulado_meta="manual" — nada a fazer.`)
    return
  }

  const indicadorAtualizado = await prisma.indicador.update({
    where: { id: indicador.id },
    data: { tipoAcumuladoMeta: 'manual' },
  })
  console.log(`📊 "${NOME_INDICADOR}": tipo_acumulado_meta "${indicador.tipoAcumuladoMeta}" → "manual"`)

  const metas = await prisma.meta.findMany({ where: { indicadorId: indicador.id } })
  for (const meta of metas) {
    const metaAtualizada = await prisma.meta.update({
      where: { id: meta.id },
      data: { acumMetaManual: TETO_ANUAL },
    })
    const acumMeta = calcularAcumuladoLinha({ ...metaAtualizada, indicador: indicadorAtualizado }, 'meta')
    await prisma.meta.update({ where: { id: meta.id }, data: { acumMeta } })
    console.log(`   ✓ [${meta.ano}] acum_meta ${meta.acumMeta} → ${acumMeta} (acum_meta_manual=${TETO_ANUAL})`)
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
