import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { metasSeed } from './metas-seed-data'

const prisma = new PrismaClient()

const SETORES = [
  { nome: 'Anny Moraes',       email: 'anny.moraes@company.com' },
  { nome: 'Davi',              email: 'davi@company.com' },
  { nome: 'Francisca Adriele', email: 'francisca.adriele@company.com' },
  { nome: 'Gustavo Borges',    email: 'gustavo.borges@company.com' },
  { nome: 'Maria Nadiane',     email: 'maria.nadiane@company.com' },
  { nome: 'Orleans',           email: 'orleans@company.com' },
]

const USUARIOS = [
  { email: 'admin@farol.com',            nome: 'Administrador',      senha: 'Admin@2025',       role: 'admin'       as const, setor: null },
  { email: 'gerente@farol.com',          nome: 'Gerente',            senha: 'Gerente@2025',     role: 'gerente'     as const, setor: null },
  { email: 'anny@farol.com',             nome: 'Anny Moraes',        senha: 'Anny@2025',        role: 'responsavel' as const, setor: 'Anny Moraes' },
  { email: 'davi@farol.com',             nome: 'Davi',               senha: 'Davi@2025',        role: 'responsavel' as const, setor: 'Davi' },
  { email: 'francisca@farol.com',        nome: 'Francisca Adriele',  senha: 'Franc@2025',       role: 'responsavel' as const, setor: 'Francisca Adriele' },
  { email: 'gustavo@farol.com',          nome: 'Gustavo Borges',     senha: 'Gustavo@2025',     role: 'responsavel' as const, setor: 'Gustavo Borges' },
  { email: 'maria.nadiane@farol.com',    nome: 'Maria Nadiane',      senha: 'Maria@2025',       role: 'responsavel' as const, setor: 'Maria Nadiane' },
  { email: 'orleans@farol.com',          nome: 'Orleans',            senha: 'Orleans@2025',     role: 'responsavel' as const, setor: 'Orleans' },
]

// Mapeamento: nome do responsável do Excel → nome do setor no banco
const RESPONSAVEL_PARA_SETOR: Record<string, string> = {
  'Anny Moraes':       'Anny Moraes',
  'Davi':              'Davi',
  'Francisca Adriele': 'Francisca Adriele',
  'Gustavo Borges':    'Gustavo Borges',
  'Maria Nadiane':     'Maria Nadiane',
  'Orleans':           'Orleans',
}

async function calcularAcumulado(m: typeof metasSeed[0]) {
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const metas  = meses.map(mes => m.meses[mes]?.meta).filter(v => v != null) as number[]
  const reais  = meses.map(mes => m.meses[mes]?.real).filter(v => v != null) as number[]

  if (m.tipo_acumulado === 'media') {
    return {
      acumMeta: metas.length  ? metas.reduce((a, b) => a + b, 0)  / metas.length  : null,
      acumReal: reais.length  ? reais.reduce((a, b) => a + b, 0)  / reais.length  : null,
    }
  }
  // soma (default)
  return {
    acumMeta: metas.length ? metas.reduce((a, b) => a + b, 0) : null,
    acumReal: reais.length ? reais.reduce((a, b) => a + b, 0) : null,
  }
}

const MESES_CAP = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const

/** Cria um setor de demonstração com 1 IC + 4 IVs configurados para o mês atual:
 * exatamente 1 dos 4 indicadores com "real" preenchido no mês atual (consolidação = 25%),
 * sendo esse único preenchido uma meta não batida — as outras 3 aparecem como pendentes. */
async function seedVendasDemo() {
  const hoje = new Date()
  const anoAtual = hoje.getFullYear()
  const mesAtualIdx = hoje.getMonth() // 0 = Jan
  const mesAtual = MESES_CAP[mesAtualIdx]
  const mesAnterior = mesAtualIdx > 0 ? MESES_CAP[mesAtualIdx - 1] : undefined

  const setor = await prisma.setor.upsert({
    where: { nome: 'Vendas Demo' },
    update: {},
    create: { nome: 'Vendas Demo', email: 'vendas.demo@company.com' },
  })

  const senhaHash = await bcrypt.hash('VendasDemo@2025', 12)
  const gerenteDemo = await prisma.usuario.upsert({
    where: { email: 'gerente.demo@farol.com' },
    update: {},
    create: { email: 'gerente.demo@farol.com', nome: 'Gerente Vendas Demo', senhaHash, role: 'gerente', setorId: setor.id },
  })

  const icExistente = await prisma.meta.findFirst({
    where: { setorId: setor.id, ano: anoAtual, icIv: 'IC', indicador: 'Resultados do Mês' },
  })
  if (icExistente) {
    console.log('   ↷ Vendas Demo já possui dados de demonstração para este ano, pulando.')
    return
  }

  function acumular(meta1: number | undefined, meta2: number | undefined, real1: number | undefined, real2: number | undefined) {
    const metas = [meta1, meta2].filter((v): v is number => v != null)
    const reais = [real1, real2].filter((v): v is number => v != null)
    return {
      acumMeta: metas.length ? metas.reduce((a, b) => a + b, 0) : undefined,
      acumReal: reais.length ? reais.reduce((a, b) => a + b, 0) : undefined,
    }
  }

  const ic = await prisma.meta.create({
    data: {
      setorId: setor.id,
      ano: anoAtual,
      ordem: 0,
      icIv: 'IC',
      indicador: 'Resultados do Mês',
      responsavel: 'Gerente Vendas Demo',
      unidade: 'UN',
      tipoMeta: 'maior_melhor',
      agregaFilhos: false,
      tipoAcumulado: 'soma',
    },
  })

  interface DadoIv {
    indicador: string
    unidade: string
    metaAnteriorVal?: number
    realAnteriorVal?: number
    metaAtualVal?: number
    realAtualVal?: number
  }

  // Apenas "Ticket Médio" tem real preenchido no mês atual (1 de 4 = 25% consolidação),
  // e está abaixo da meta (não batida). As demais 3 ficam pendentes no mês atual.
  const ivs: DadoIv[] = [
    { indicador: 'Vendas Totais', unidade: 'R$', metaAnteriorVal: 50000, realAnteriorVal: 50000, metaAtualVal: 55000, realAtualVal: undefined },
    { indicador: 'Ticket Médio', unidade: 'R$', metaAnteriorVal: 600, realAnteriorVal: 500, metaAtualVal: 600, realAtualVal: 400 },
    { indicador: 'Taxa de Conversão', unidade: '%', metaAnteriorVal: 100, realAnteriorVal: 95, metaAtualVal: 100, realAtualVal: undefined },
    { indicador: 'NPS', unidade: 'nº', metaAnteriorVal: 80, realAnteriorVal: undefined, metaAtualVal: 80, realAtualVal: undefined },
  ]

  for (let i = 0; i < ivs.length; i++) {
    const iv = ivs[i]
    const mesesData: Record<string, number | undefined> = {}
    if (mesAnterior) {
      mesesData[`meta${mesAnterior}`] = iv.metaAnteriorVal
      mesesData[`real${mesAnterior}`] = iv.realAnteriorVal
    }
    mesesData[`meta${mesAtual}`] = iv.metaAtualVal
    mesesData[`real${mesAtual}`] = iv.realAtualVal

    const { acumMeta, acumReal } = acumular(iv.metaAnteriorVal, iv.metaAtualVal, iv.realAnteriorVal, iv.realAtualVal)

    await prisma.meta.create({
      data: {
        setorId: setor.id,
        ano: anoAtual,
        ordem: i + 1,
        icIv: 'IV',
        paiId: ic.id,
        indicador: iv.indicador,
        responsavel: 'Gerente Vendas Demo',
        unidade: iv.unidade,
        tipoMeta: 'maior_melhor',
        agregaFilhos: false,
        tipoAcumulado: 'soma',
        ...mesesData,
        acumMeta,
        acumReal,
      },
    })
    console.log(`   ✓ IV "${iv.indicador}" (${mesAtual}: ${iv.realAtualVal ?? 'pendente'})`)
  }

  console.log(`   ✓ Setor "Vendas Demo" (gerente: ${gerenteDemo.email} / VendasDemo@2025)`)
}

async function main() {
  console.log('🌱 Iniciando seed...\n')

  // 1. Setores
  console.log('📍 Criando setores...')
  const setorMap = new Map<string, string>()
  for (const s of SETORES) {
    const created = await prisma.setor.upsert({
      where: { nome: s.nome },
      update: {},
      create: s,
    })
    setorMap.set(s.nome, created.id)
    console.log(`   ✓ ${s.nome}`)
  }

  // 2. Usuários
  console.log('\n👤 Criando usuários...')
  for (const u of USUARIOS) {
    const senhaHash = await bcrypt.hash(u.senha, 12)
    const setorId = u.setor ? setorMap.get(u.setor) ?? null : null
    await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: { email: u.email, nome: u.nome, senhaHash, role: u.role, setorId },
    })
    console.log(`   ✓ ${u.email} (${u.role})`)
  }

  const admin = await prisma.usuario.findUniqueOrThrow({ where: { email: 'admin@farol.com' } })
  const produtoMap = new Map<string, string>()

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

  // 3. Metas — 2 passagens para resolver hierarquia
  console.log('\n📊 Criando metas (2025)...')

  // IDs criados indexados por posição no array
  const idsPorIdx: string[] = []

  // Passagem 1: criar apenas ICs (sem paiId)
  for (let i = 0; i < metasSeed.length; i++) {
    const m = metasSeed[i]
    if (m.ic_iv !== 'IC') {
      idsPorIdx.push('')
      continue
    }

    const setorNome = RESPONSAVEL_PARA_SETOR[m.responsavel]
    const setorId = setorNome ? setorMap.get(setorNome) : undefined
    if (!setorId) {
      console.warn(`   ⚠️ Setor não encontrado para responsável "${m.responsavel}" — ${m.indicador}`)
      idsPorIdx.push('')
      continue
    }

    const { acumMeta, acumReal } = await calcularAcumulado(m)
    const produtoId = await resolverProdutoId(m.produto, setorId)

    const criado = await prisma.meta.create({
      data: {
        setorId,
        ano: 2025,
        ordem: m.ordem,
        produtoId,
        icIv: 'IC',
        indicador: m.indicador,
        responsavel: m.responsavel,
        unidade: m.unidade,
        tipoMeta: (m.tipo_meta ?? 'maior_melhor') as 'maior_melhor' | 'menor_melhor',
        agregaFilhos: m.agrega_filhos,
        tipoAcumulado: m.tipo_acumulado,
        metaAno: m.meta_ano ?? undefined,
        metaJan: m.meses.jan?.meta ?? undefined,
        metaFev: m.meses.fev?.meta ?? undefined,
        metaMar: m.meses.mar?.meta ?? undefined,
        metaAbr: m.meses.abr?.meta ?? undefined,
        metaMai: m.meses.mai?.meta ?? undefined,
        metaJun: m.meses.jun?.meta ?? undefined,
        metaJul: m.meses.jul?.meta ?? undefined,
        metaAgo: m.meses.ago?.meta ?? undefined,
        metaSet: m.meses.set?.meta ?? undefined,
        metaOut: m.meses.out?.meta ?? undefined,
        metaNov: m.meses.nov?.meta ?? undefined,
        metaDez: m.meses.dez?.meta ?? undefined,
        realJan: m.meses.jan?.real ?? undefined,
        realFev: m.meses.fev?.real ?? undefined,
        realMar: m.meses.mar?.real ?? undefined,
        realAbr: m.meses.abr?.real ?? undefined,
        realMai: m.meses.mai?.real ?? undefined,
        realJun: m.meses.jun?.real ?? undefined,
        realJul: m.meses.jul?.real ?? undefined,
        realAgo: m.meses.ago?.real ?? undefined,
        realSet: m.meses.set?.real ?? undefined,
        realOut: m.meses.out?.real ?? undefined,
        realNov: m.meses.nov?.real ?? undefined,
        realDez: m.meses.dez?.real ?? undefined,
        acumMeta: acumMeta ?? undefined,
        acumReal: acumReal ?? undefined,
      },
    })
    idsPorIdx.push(criado.id)
    console.log(`   ✓ IC [${i}] ${m.indicador}`)
  }

  // Passagem 2: criar IVs com paiId correto
  for (let i = 0; i < metasSeed.length; i++) {
    const m = metasSeed[i]
    if (m.ic_iv !== 'IV') continue

    const setorNome = RESPONSAVEL_PARA_SETOR[m.responsavel]
    const setorId = setorNome ? setorMap.get(setorNome) : undefined
    if (!setorId) {
      console.warn(`   ⚠️ Setor não encontrado para responsável "${m.responsavel}" — ${m.indicador}`)
      idsPorIdx.push('')
      continue
    }

    const paiId = m.pai_idx !== null ? idsPorIdx[m.pai_idx] : undefined
    if (!paiId) {
      console.warn(`   ⚠️ Pai não encontrado para IV [${i}] ${m.indicador}`)
    }

    const { acumMeta, acumReal } = await calcularAcumulado(m)

    const criado = await prisma.meta.create({
      data: {
        setorId,
        ano: 2025,
        ordem: m.ordem,
        icIv: 'IV',
        paiId: paiId || undefined,
        indicador: m.indicador,
        responsavel: m.responsavel,
        unidade: m.unidade,
        tipoMeta: (m.tipo_meta ?? 'maior_melhor') as 'maior_melhor' | 'menor_melhor',
        agregaFilhos: false,
        tipoAcumulado: m.tipo_acumulado,
        metaAno: m.meta_ano ?? undefined,
        metaJan: m.meses.jan?.meta ?? undefined,
        metaFev: m.meses.fev?.meta ?? undefined,
        metaMar: m.meses.mar?.meta ?? undefined,
        metaAbr: m.meses.abr?.meta ?? undefined,
        metaMai: m.meses.mai?.meta ?? undefined,
        metaJun: m.meses.jun?.meta ?? undefined,
        metaJul: m.meses.jul?.meta ?? undefined,
        metaAgo: m.meses.ago?.meta ?? undefined,
        metaSet: m.meses.set?.meta ?? undefined,
        metaOut: m.meses.out?.meta ?? undefined,
        metaNov: m.meses.nov?.meta ?? undefined,
        metaDez: m.meses.dez?.meta ?? undefined,
        realJan: m.meses.jan?.real ?? undefined,
        realFev: m.meses.fev?.real ?? undefined,
        realMar: m.meses.mar?.real ?? undefined,
        realAbr: m.meses.abr?.real ?? undefined,
        realMai: m.meses.mai?.real ?? undefined,
        realJun: m.meses.jun?.real ?? undefined,
        realJul: m.meses.jul?.real ?? undefined,
        realAgo: m.meses.ago?.real ?? undefined,
        realSet: m.meses.set?.real ?? undefined,
        realOut: m.meses.out?.real ?? undefined,
        realNov: m.meses.nov?.real ?? undefined,
        realDez: m.meses.dez?.real ?? undefined,
        acumMeta: acumMeta ?? undefined,
        acumReal: acumReal ?? undefined,
      },
    })
    idsPorIdx.push(criado.id)
    console.log(`      ✓ IV [${i}] ${m.indicador}`)
  }

  // 4. Setor de demonstração com metas pendentes/não batidas (mês atual)
  console.log('\n🎯 Criando dados de demonstração (Vendas Demo)...')
  await seedVendasDemo()

  console.log('\n✅ Seed concluído!')
  console.log(`   ${metasSeed.filter(m => m.ic_iv === 'IC').length} ICs + ${metasSeed.filter(m => m.ic_iv === 'IV').length} IVs`)
  console.log('\n📝 Credenciais:')
  for (const u of USUARIOS) {
    console.log(`   ${u.email} / ${u.senha}`)
  }
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error('❌ Erro no seed:', e)
    await prisma.$disconnect()
    process.exit(1)
  })
