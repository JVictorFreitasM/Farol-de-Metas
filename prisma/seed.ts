import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import { metasSeed } from './metas-seed-data'

const prisma = new PrismaClient()

const SETORES = [
  { nome: 'Anny Moraes',       email: 'anny.moraes@company.com' },
  { nome: 'Davi',              email: 'davi@company.com' },
  { nome: 'Francilane',        email: 'francilane@company.com' },
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
  { email: 'francilane@farol.com',       nome: 'Francilane',         senha: 'Franc@2025',       role: 'responsavel' as const, setor: 'Francilane' },
  { email: 'francisca@farol.com',        nome: 'Francisca Adriele',  senha: 'Franc@2025',       role: 'responsavel' as const, setor: 'Francisca Adriele' },
  { email: 'gustavo@farol.com',          nome: 'Gustavo Borges',     senha: 'Gustavo@2025',     role: 'responsavel' as const, setor: 'Gustavo Borges' },
  { email: 'maria.nadiane@farol.com',    nome: 'Maria Nadiane',      senha: 'Maria@2025',       role: 'responsavel' as const, setor: 'Maria Nadiane' },
  { email: 'orleans@farol.com',          nome: 'Orleans',            senha: 'Orleans@2025',     role: 'responsavel' as const, setor: 'Orleans' },
]

// Mapeamento: nome do responsável do Excel → nome do setor no banco
const RESPONSAVEL_PARA_SETOR: Record<string, string> = {
  'Anny Moraes':       'Anny Moraes',
  'Davi':              'Davi',
  'Francilane':        'Francilane',
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

    const criado = await prisma.meta.create({
      data: {
        setorId,
        ano: 2025,
        ordem: m.ordem,
        produto: m.produto ?? undefined,
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
        produto: undefined,
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
