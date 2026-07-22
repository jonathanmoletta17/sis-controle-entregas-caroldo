import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/pendencias — resumo de conclusão por posto (todos os postos)
// GET /api/pendencias?postoId=... — matriz item x colaborador para um posto específico
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const postoId = searchParams.get('postoId')

    if (postoId) {
      return await matrizPorPosto(postoId)
    }
    return await resumoTodosPostos()
  } catch (err: any) {
    console.error('[GET /api/pendencias] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao calcular pendências' }, { status: 500 })
  }
}

async function matrizPorPosto(postoId: string) {
  const posto = await db.posto.findUnique({ where: { id: postoId } })
  if (!posto) return NextResponse.json({ error: 'Posto não encontrado' }, { status: 404 })

  const colaboradores = await db.colaborador.findMany({
    where: { postoId, ativo: true },
    select: { id: true, nomeCompleto: true },
    orderBy: { nomeCompleto: 'asc' },
  })

  const itensPosto = await db.itemPosto.findMany({
    where: { postoId },
    include: { item: { include: { categoria: true } } },
    orderBy: { item: { descricao: 'asc' } },
  })

  const colabIds = colaboradores.map(c => c.id)
  const itemIds = itensPosto.map(ip => ip.itemId)

  // Soma das quantidades entregues por colaborador+item
  const entregas = colabIds.length && itemIds.length
    ? await db.entrega.groupBy({
        by: ['colaboradorId', 'itemId'],
        where: { colaboradorId: { in: colabIds }, itemId: { in: itemIds } },
        _sum: { quantidade: true },
      })
    : []

  const entregueQtdMap = new Map<string, number>()
  for (const e of entregas) {
    entregueQtdMap.set(`${e.colaboradorId}__${e.itemId}`, e._sum.quantidade || 0)
  }
  const esperadaPorItem = new Map<string, number>()
  for (const ip of itensPosto) esperadaPorItem.set(ip.itemId, ip.quantidadeEsperada || 1)

  const porCategoria: Record<string, Array<{
    itemId: string
    descricao: string
    imagemUrl: string | null
    quantidadeEsperada: number
    entregasPorColaborador: Record<string, { entregue: number; esperada: number; completo: boolean }>
  }>> = {}

  for (const ip of itensPosto) {
    const cat = ip.item.categoria.nome
    if (!porCategoria[cat]) porCategoria[cat] = []
    const esperada = ip.quantidadeEsperada || 1
    const entregasPorColaborador: Record<string, { entregue: number; esperada: number; completo: boolean }> = {}
    for (const c of colaboradores) {
      const entregue = entregueQtdMap.get(`${c.id}__${ip.itemId}`) || 0
      entregasPorColaborador[c.id] = { entregue, esperada, completo: entregue >= esperada }
    }
    porCategoria[cat].push({
      itemId: ip.itemId,
      descricao: ip.item.descricao,
      imagemUrl: ip.item.imagemUrl,
      quantidadeEsperada: esperada,
      entregasPorColaborador,
    })
  }

  // Percentual de conclusão por colaborador — ponderado por quantidade, só obrigatórios
  const obrigatorios = itensPosto.filter(ip => ip.obrigatorio)
  const totalEsperadoColab = obrigatorios.reduce((s, ip) => s + (ip.quantidadeEsperada || 1), 0)
  const colaboradoresComPercentual = colaboradores.map(c => {
    const entregueColab = obrigatorios.reduce((s, ip) => {
      const esperada = ip.quantidadeEsperada || 1
      const entregue = entregueQtdMap.get(`${c.id}__${ip.itemId}`) || 0
      return s + Math.min(entregue, esperada)
    }, 0)
    return {
      id: c.id,
      nomeCompleto: c.nomeCompleto,
      percentual: totalEsperadoColab > 0 ? Math.round((entregueColab / totalEsperadoColab) * 100) : 0,
    }
  })

  return NextResponse.json({
    posto: { id: posto.id, nome: posto.nome, corCapacete: posto.corCapacete },
    colaboradores: colaboradoresComPercentual,
    porCategoria,
    totalItens: itemIds.length,
  })
}

async function resumoTodosPostos() {
  const postos = await db.posto.findMany({
    include: {
      colaboradores: { where: { ativo: true }, select: { id: true } },
      itensPosto: { select: { itemId: true, quantidadeEsperada: true, obrigatorio: true } },
    },
    orderBy: { nome: 'asc' },
  })

  // Soma das quantidades entregues por colaborador+item (colaboradores ativos)
  const colabAtivosIds = postos.flatMap(p => p.colaboradores.map(c => c.id))
  const entregas = colabAtivosIds.length
    ? await db.entrega.groupBy({
        by: ['colaboradorId', 'itemId'],
        where: { colaboradorId: { in: colabAtivosIds } },
        _sum: { quantidade: true },
      })
    : []
  const entregueQtdMap = new Map<string, number>()
  for (const e of entregas) {
    entregueQtdMap.set(`${e.colaboradorId}__${e.itemId}`, e._sum.quantidade || 0)
  }

  const resumo = postos.map(p => {
    const colaboradoresAtivos = p.colaboradores.length
    const itensEsperados = p.itensPosto.length
    // Unidades esperadas = para cada colaborador, a soma das metas obrigatórias do posto
    const obrigatorios = p.itensPosto.filter(ip => ip.obrigatorio)
    const esperadoPorColab = obrigatorios.reduce((s, ip) => s + (ip.quantidadeEsperada || 1), 0)
    const unidadesEsperadas = colaboradoresAtivos * esperadoPorColab
    let unidadesEntregues = 0
    for (const c of p.colaboradores) {
      for (const ip of obrigatorios) {
        const esperada = ip.quantidadeEsperada || 1
        const entregue = entregueQtdMap.get(`${c.id}__${ip.itemId}`) || 0
        unidadesEntregues += Math.min(entregue, esperada)
      }
    }
    return {
      postoId: p.id,
      postoNome: p.nome,
      corCapacete: p.corCapacete,
      colaboradoresAtivos,
      itensEsperados,
      totalPares: unidadesEsperadas,
      paresEntregues: unidadesEntregues,
      pendentes: unidadesEsperadas - unidadesEntregues,
      percentual: unidadesEsperadas > 0 ? Math.round((unidadesEntregues / unidadesEsperadas) * 100) : 0,
    }
  })

  return NextResponse.json({ postos: resumo })
}
