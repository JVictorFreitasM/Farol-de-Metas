import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { metasSeed } from './metas-seed-data'

const prisma = new PrismaClient()

const SETORES = [
  { nome: 'Gestão de Gente 1',   email: 'anny.moraes@company.com' },
  { nome: 'Financeiro 2',        email: 'davi@company.com' },
  { nome: 'Gestão de Gente 2',   email: 'francilane@company.com' },
  { nome: 'Faturamento',         email: 'francisca.adriele@company.com' },
  { nome: 'TI',                  email: 'gustavo.borges@company.com' },
  { nome: 'Financeiro 1',        email: 'maria.nadiane@company.com' },
  { nome: 'Segurança do Trabalho', email: 'orleans@company.com' },
]

const USUARIOS = [
  { email: 'admin@farol.com',            nome: 'Administrador',      senha: 'Admin@2025',       role: 'admin'       as const, setor: null },
  { email: 'gerente@farol.com',          nome: 'Gerente',            senha: 'Gerente@2025',     role: 'gerente'     as const, setor: null },
  { email: 'anny@farol.com',             nome: 'Anny Moraes',        senha: 'Anny@2025',        role: 'responsavel' as const, setor: 'Gestão de Gente 1' },
  { email: 'davi@farol.com',             nome: 'Davi',               senha: 'Davi@2025',        role: 'responsavel' as const, setor: 'Financeiro 2' },
  { email: 'francilane@farol.com',       nome: 'Francilane',         senha: 'Francilane@2025',  role: 'responsavel' as const, setor: 'Gestão de Gente 2' },
  { email: 'francisca@farol.com',        nome: 'Francisca Adriele',  senha: 'Franc@2025',       role: 'responsavel' as const, setor: 'Faturamento' },
  { email: 'gustavo@farol.com',          nome: 'Gustavo Borges',     senha: 'Gustavo@2025',     role: 'responsavel' as const, setor: 'TI' },
  { email: 'maria.nadiane@farol.com',    nome: 'Maria Nadiane',      senha: 'Maria@2025',       role: 'responsavel' as const, setor: 'Financeiro 1' },
  { email: 'orleans@farol.com',          nome: 'Orleans',            senha: 'Orleans@2025',     role: 'responsavel' as const, setor: 'Segurança do Trabalho' },
]

// Mapeamento: nome do responsável do Excel → nome do setor no banco
const RESPONSAVEL_PARA_SETOR: Record<string, string> = {
  'Anny Moraes':       'Gestão de Gente 1',
  'Davi':              'Financeiro 2',
  'Francilane':        'Gestão de Gente 2',
  'Francisca Adriele': 'Faturamento',
  'Gustavo Borges':    'TI',
  'Maria Nadiane':     'Financeiro 1',
  'Orleans':           'Segurança do Trabalho',
}

async function calcularAcumulado(m: typeof metasSeed[0]) {
  const meses = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
  const metas  = meses.map(mes => m.meses[mes]?.meta).filter(v => v != null) as number[]
  const reais  = meses.map(mes => m.meses[mes]?.real).filter(v => v != null) as number[]

  // OS-015: tipo_acumulado_meta/tipo_acumulado_real separados — "manual" em qualquer lado
  // significa que o acumulado não vem da soma/média dos meses, vem do valor digitado direto.
  const acumMeta = m.tipo_acumulado_meta === 'manual'
    ? (m.acum_meta_manual ?? null)
    : m.tipo_acumulado_meta === 'media'
      ? (metas.length ? metas.reduce((a, b) => a + b, 0) / metas.length : null)
      : (metas.length ? metas.reduce((a, b) => a + b, 0) : null)

  const usaRealManual = m.tipo_acumulado_real === 'manual' || m.tipo_agregacao_real === 'real_manual'
  const acumReal = usaRealManual
    ? (m.acum_real_manual ?? null)
    : m.tipo_acumulado_real === 'media'
      ? (reais.length ? reais.reduce((a, b) => a + b, 0) / reais.length : null)
      : (reais.length ? reais.reduce((a, b) => a + b, 0) : null)

  return { acumMeta, acumReal }
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
    where: { setorId: setor.id, ano: anoAtual, indicador: { nome: 'Resultados do Mês', icIv: 'IC' } },
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

  const indicadorIc = await prisma.indicador.upsert({
    where: { nome_setorId: { nome: 'Resultados do Mês', setorId: setor.id } },
    update: {},
    create: {
      setorId: setor.id,
      icIv: 'IC',
      nome: 'Resultados do Mês',
      unidade: 'UN',
      agregaFilhos: false,
      tipoAcumuladoMeta: 'soma',
      tipoAcumuladoReal: 'soma',
    },
  })

  const ic = await prisma.meta.create({
    data: {
      setorId: setor.id,
      ano: anoAtual,
      ordem: 0,
      indicadorId: indicadorIc.id,
      responsavel: 'Gerente Vendas Demo',
      tipoMeta: 'maior_melhor',
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

    const indicadorIv = await prisma.indicador.upsert({
      where: { nome_setorId: { nome: iv.indicador, setorId: setor.id } },
      update: {},
      create: {
        setorId: setor.id,
        icIv: 'IV',
        paiId: indicadorIc.id,
        nome: iv.indicador,
        unidade: iv.unidade,
        agregaFilhos: false,
        tipoAcumuladoMeta: 'soma',
        tipoAcumuladoReal: 'soma',
      },
    })

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
        indicadorId: indicadorIv.id,
        responsavel: 'Gerente Vendas Demo',
        tipoMeta: 'maior_melhor',
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

  // 3. Indicadores — 2 passagens para resolver hierarquia (OS-013: nome/unidade/hierarquia
  // agora vivem em Indicador, fixos entre anos; Meta guarda só o que varia por ano)
  console.log('\n📋 Criando indicadores...')

  // IDs de Indicador criados indexados por posição no array de metasSeed
  const indicadorIdsPorIdx: string[] = []

  // Passagem 1: ICs (sem pai)
  for (let i = 0; i < metasSeed.length; i++) {
    const m = metasSeed[i]
    if (m.ic_iv !== 'IC') {
      indicadorIdsPorIdx.push('')
      continue
    }

    const setorNome = RESPONSAVEL_PARA_SETOR[m.responsavel]
    const setorId = setorNome ? setorMap.get(setorNome) : undefined
    if (!setorId) {
      console.warn(`   ⚠️ Setor não encontrado para responsável "${m.responsavel}" — ${m.indicador}`)
      indicadorIdsPorIdx.push('')
      continue
    }

    const produtoId = await resolverProdutoId(m.produto, setorId)

    const indicador = await prisma.indicador.upsert({
      where: { nome_setorId: { nome: m.indicador, setorId } },
      update: {},
      create: {
        setorId,
        produtoId,
        icIv: 'IC',
        nome: m.indicador,
        unidade: m.unidade,
        agregaFilhos: m.agrega_filhos,
        tipoAcumuladoMeta: m.tipo_acumulado_meta,
        tipoAcumuladoReal: m.tipo_acumulado_real,
        tipoAgregacaoMeta: m.tipo_agregacao_meta ?? 'soma',
        tipoAgregacaoReal: m.tipo_agregacao_real ?? 'soma',
        realManualAcum: m.real_manual_acum ?? undefined,
      },
    })
    indicadorIdsPorIdx.push(indicador.id)
    console.log(`   ✓ IC [${i}] ${m.indicador}`)
  }

  // Passagem 2: IVs (com pai já resolvido)
  for (let i = 0; i < metasSeed.length; i++) {
    const m = metasSeed[i]
    if (m.ic_iv !== 'IV') continue

    const setorNome = RESPONSAVEL_PARA_SETOR[m.responsavel]
    const setorId = setorNome ? setorMap.get(setorNome) : undefined
    if (!setorId) {
      console.warn(`   ⚠️ Setor não encontrado para responsável "${m.responsavel}" — ${m.indicador}`)
      continue
    }

    const paiId = m.pai_idx !== null ? indicadorIdsPorIdx[m.pai_idx] : undefined
    if (!paiId) {
      console.warn(`   ⚠️ Pai não encontrado para IV [${i}] ${m.indicador}`)
    }

    const indicador = await prisma.indicador.upsert({
      where: { nome_setorId: { nome: m.indicador, setorId } },
      update: {},
      create: {
        setorId,
        icIv: 'IV',
        paiId: paiId || undefined,
        nome: m.indicador,
        unidade: m.unidade,
        agregaFilhos: false,
        tipoAcumuladoMeta: m.tipo_acumulado_meta,
        tipoAcumuladoReal: m.tipo_acumulado_real,
      },
    })
    indicadorIdsPorIdx[i] = indicador.id
    console.log(`      ✓ IV [${i}] ${m.indicador}`)
  }

  // 4. Metas (2025) — uma linha por indicador, referenciando indicadorId
  console.log('\n📊 Criando metas (2025)...')
  for (let i = 0; i < metasSeed.length; i++) {
    const m = metasSeed[i]
    const setorNome = RESPONSAVEL_PARA_SETOR[m.responsavel]
    const setorId = setorNome ? setorMap.get(setorNome) : undefined
    const indicadorId = indicadorIdsPorIdx[i]
    if (!setorId || !indicadorId) continue

    const { acumMeta, acumReal } = await calcularAcumulado(m)

    await prisma.meta.create({
      data: {
        setorId,
        ano: 2025,
        ordem: m.ordem,
        indicadorId,
        responsavel: m.responsavel,
        tipoMeta: (m.tipo_meta ?? 'maior_melhor') as 'maior_melhor' | 'menor_melhor',
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
        acumMetaManual: m.acum_meta_manual ?? undefined,
        acumRealManual: m.acum_real_manual ?? undefined,
        acumMeta: acumMeta ?? undefined,
        acumReal: acumReal ?? undefined,
      },
    })
    console.log(`   ✓ Meta [${i}] ${m.indicador}`)
  }

  // 5. Setor de demonstração com metas pendentes/não batidas (mês atual)
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
