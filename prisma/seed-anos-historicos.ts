import { PrismaClient } from '@prisma/client'
import { metasSeed } from './metas-seed-data'

const prisma = new PrismaClient()

const MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Mapeamento: nome do responsável do Excel → nome do setor no banco (igual ao seed.ts)
const RESPONSAVEL_PARA_SETOR: Record<string, string> = {
  'Anny Moraes': 'Anny Moraes',
  'Davi': 'Davi',
  'Francisca Adriele': 'Francisca Adriele',
  'Gustavo Borges': 'Gustavo Borges',
  'Maria Nadiane': 'Maria Nadiane',
  'Orleans': 'Orleans',
}

interface ConfigAno {
  ano: number
  fatorMeta: number
  fatorReal: number
  /** Índice (0=jan) do último mês com "real" preenchido. Undefined = todos os 12 meses. */
  ultimoMesComReal?: number
  jitter: number
}

/** Aplica um fator com pequena variação aleatória (±jitter/2) em torno do valor base, mantendo 4 casas decimais. */
function transformarValor(valor: number | null | undefined, fator: number, jitter: number): number | null {
  if (valor === null || valor === undefined) return null
  const fatorEfetivo = fator * (1 + (Math.random() - 0.5) * jitter)
  return Math.round(valor * fatorEfetivo * 10000) / 10000
}

async function calcularAcumulado(
  valoresPorMes: Record<string, { meta: number | null; real: number | null }>,
  tipoAcumulado: 'soma' | 'media'
) {
  const metas = MESES.map((mes) => valoresPorMes[mes]?.meta).filter((v): v is number => v != null)
  const reais = MESES.map((mes) => valoresPorMes[mes]?.real).filter((v): v is number => v != null)
  return {
    acumMeta: metas.length ? metas.reduce((a, b) => a + b, 0) / (tipoAcumulado === 'media' ? metas.length : 1) : null,
    acumReal: reais.length ? reais.reduce((a, b) => a + b, 0) / (tipoAcumulado === 'media' ? reais.length : 1) : null,
  }
}

async function popularAno(config: ConfigAno) {
  const jaExiste = await prisma.meta.findFirst({ where: { ano: config.ano } })
  if (jaExiste) {
    console.log(`   ↷ Ano ${config.ano} já possui dados (ex: "${jaExiste.indicador}") — pulando para não duplicar.`)
    return
  }

  console.log(`\n📊 Populando ano ${config.ano} (fator meta=${config.fatorMeta}, fator real=${config.fatorReal}${config.ultimoMesComReal !== undefined ? `, real até ${MESES[config.ultimoMesComReal]}` : ''})...`)

  const setores = await prisma.setor.findMany()
  const setorMap = new Map(setores.map((s) => [s.nome, s.id]))

  const produtoMap = new Map<string, string>()
  const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: 'admin@farol.com' } })
  async function resolverProdutoId(nome: string | null | undefined, setorId: string): Promise<string | undefined> {
    if (!nome) return undefined
    const chave = `${setorId}:${nome}`
    const existente = produtoMap.get(chave)
    if (existente) return existente
    const produto = await prisma.produto.upsert({
      where: { nome_setorId: { nome, setorId } },
      update: {},
      create: { nome, setorId, criadoPor: admin.id },
    })
    produtoMap.set(chave, produto.id)
    return produto.id
  }

  function transformarMeses(m: (typeof metasSeed)[number]) {
    const resultado: Record<string, { meta: number | null; real: number | null }> = {}
    MESES.forEach((mes, idx) => {
      const original = m.meses[mes]
      const metaV = transformarValor(original?.meta, config.fatorMeta, config.jitter)
      const realBruto =
        config.ultimoMesComReal !== undefined && idx > config.ultimoMesComReal
          ? null
          : transformarValor(original?.real, config.fatorReal, config.jitter)
      resultado[mes] = { meta: metaV, real: realBruto }
    })
    return resultado
  }

  const idsPorIdx: string[] = []

  // Passagem 1: ICs
  for (let i = 0; i < metasSeed.length; i++) {
    const m = metasSeed[i]
    if (m.ic_iv !== 'IC') {
      idsPorIdx.push('')
      continue
    }
    const setorNome = RESPONSAVEL_PARA_SETOR[m.responsavel]
    const setorId = setorNome ? setorMap.get(setorNome) : undefined
    if (!setorId) {
      idsPorIdx.push('')
      continue
    }

    const meses = transformarMeses(m)
    const { acumMeta, acumReal } = await calcularAcumulado(meses, m.tipo_acumulado)
    const produtoId = await resolverProdutoId(m.produto, setorId)
    const metaAnoTransformado = transformarValor(m.meta_ano, config.fatorMeta, config.jitter)

    const criado = await prisma.meta.create({
      data: {
        setorId,
        ano: config.ano,
        ordem: m.ordem,
        produtoId,
        icIv: 'IC',
        indicador: m.indicador,
        responsavel: m.responsavel,
        unidade: m.unidade,
        tipoMeta: (m.tipo_meta ?? 'maior_melhor') as 'maior_melhor' | 'menor_melhor',
        agregaFilhos: m.agrega_filhos,
        tipoAcumulado: m.tipo_acumulado,
        metaAno: metaAnoTransformado ?? undefined,
        metaJan: meses.jan.meta ?? undefined,
        metaFev: meses.fev.meta ?? undefined,
        metaMar: meses.mar.meta ?? undefined,
        metaAbr: meses.abr.meta ?? undefined,
        metaMai: meses.mai.meta ?? undefined,
        metaJun: meses.jun.meta ?? undefined,
        metaJul: meses.jul.meta ?? undefined,
        metaAgo: meses.ago.meta ?? undefined,
        metaSet: meses.set.meta ?? undefined,
        metaOut: meses.out.meta ?? undefined,
        metaNov: meses.nov.meta ?? undefined,
        metaDez: meses.dez.meta ?? undefined,
        realJan: meses.jan.real ?? undefined,
        realFev: meses.fev.real ?? undefined,
        realMar: meses.mar.real ?? undefined,
        realAbr: meses.abr.real ?? undefined,
        realMai: meses.mai.real ?? undefined,
        realJun: meses.jun.real ?? undefined,
        realJul: meses.jul.real ?? undefined,
        realAgo: meses.ago.real ?? undefined,
        realSet: meses.set.real ?? undefined,
        realOut: meses.out.real ?? undefined,
        realNov: meses.nov.real ?? undefined,
        realDez: meses.dez.real ?? undefined,
        acumMeta: acumMeta ?? undefined,
        acumReal: acumReal ?? undefined,
      },
    })
    idsPorIdx.push(criado.id)
  }
  console.log(`   ✓ ${idsPorIdx.filter((id, i) => id && metasSeed[i].ic_iv === 'IC').length} ICs criados`)

  // Passagem 2: IVs (com paiId correto)
  let contadorIv = 0
  for (let i = 0; i < metasSeed.length; i++) {
    const m = metasSeed[i]
    if (m.ic_iv !== 'IV') continue
    const setorNome = RESPONSAVEL_PARA_SETOR[m.responsavel]
    const setorId = setorNome ? setorMap.get(setorNome) : undefined
    if (!setorId) continue

    const paiId = m.pai_idx !== null ? idsPorIdx[m.pai_idx] : undefined
    const meses = transformarMeses(m)
    const { acumMeta, acumReal } = await calcularAcumulado(meses, m.tipo_acumulado)
    const metaAnoTransformado = transformarValor(m.meta_ano, config.fatorMeta, config.jitter)

    const criado = await prisma.meta.create({
      data: {
        setorId,
        ano: config.ano,
        ordem: m.ordem,
        icIv: 'IV',
        paiId: paiId || undefined,
        indicador: m.indicador,
        responsavel: m.responsavel,
        unidade: m.unidade,
        tipoMeta: (m.tipo_meta ?? 'maior_melhor') as 'maior_melhor' | 'menor_melhor',
        agregaFilhos: false,
        tipoAcumulado: m.tipo_acumulado,
        metaAno: metaAnoTransformado ?? undefined,
        metaJan: meses.jan.meta ?? undefined,
        metaFev: meses.fev.meta ?? undefined,
        metaMar: meses.mar.meta ?? undefined,
        metaAbr: meses.abr.meta ?? undefined,
        metaMai: meses.mai.meta ?? undefined,
        metaJun: meses.jun.meta ?? undefined,
        metaJul: meses.jul.meta ?? undefined,
        metaAgo: meses.ago.meta ?? undefined,
        metaSet: meses.set.meta ?? undefined,
        metaOut: meses.out.meta ?? undefined,
        metaNov: meses.nov.meta ?? undefined,
        metaDez: meses.dez.meta ?? undefined,
        realJan: meses.jan.real ?? undefined,
        realFev: meses.fev.real ?? undefined,
        realMar: meses.mar.real ?? undefined,
        realAbr: meses.abr.real ?? undefined,
        realMai: meses.mai.real ?? undefined,
        realJun: meses.jun.real ?? undefined,
        realJul: meses.jul.real ?? undefined,
        realAgo: meses.ago.real ?? undefined,
        realSet: meses.set.real ?? undefined,
        realOut: meses.out.real ?? undefined,
        realNov: meses.nov.real ?? undefined,
        realDez: meses.dez.real ?? undefined,
        acumMeta: acumMeta ?? undefined,
        acumReal: acumReal ?? undefined,
      },
    })
    idsPorIdx.push(criado.id)
    contadorIv++
  }
  console.log(`   ✓ ${contadorIv} IVs criados`)
}

async function main() {
  console.log('🌱 Populando anos históricos (2024) e corrente (2026) com os mesmos indicadores de 2025...')

  // 2024: ano anterior "fechado" — todos os 12 meses preenchidos, valores um pouco menores (crescimento até 2025)
  await popularAno({ ano: 2024, fatorMeta: 0.88, fatorReal: 0.85, jitter: 0.12 })

  // 2026: ano corrente (hoje: 2026-07-16) — metas um pouco maiores que 2025, "real" preenchido só até junho
  // (mês de julho ainda em andamento, sem fechamento) para refletir um ano em progresso.
  await popularAno({ ano: 2026, fatorMeta: 1.08, fatorReal: 1.05, ultimoMesComReal: 5, jitter: 0.12 })

  console.log('\n✅ Concluído!')
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Erro:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
