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

  const entregas = colabIds.length && itemIds.length
    ? await db.entrega.findMany({
        where: { colaboradorId: { in: colabIds }, itemId: { in: itemIds } },
        select: { colaboradorId: true, itemId: true },
        distinct: ['colaboradorId', 'itemId'],
      })
    : []

  const entregueSet = new Set(entregas.map(e => `${e.colaboradorId}__${e.itemId}`))

  const porCategoria: Record<string, Array<{
    itemId: string
    descricao: string
    imagemUrl: string | null
    entregasPorColaborador: Record<string, boolean>
  }>> = {}

  for (const ip of itensPosto) {
    const cat = ip.item.categoria.nome
    if (!porCategoria[cat]) porCategoria[cat] = []
    const entregasPorColaborador: Record<string, boolean> = {}
    for (const c of colaboradores) {
      entregasPorColaborador[c.id] = entregueSet.has(`${c.id}__${ip.itemId}`)
    }
    porCategoria[cat].push({
      itemId: ip.itemId,
      descricao: ip.item.descricao,
      imagemUrl: ip.item.imagemUrl,
      entregasPorColaborador,
    })
  }

  // Percentual de conclusão por colaborador
  const colaboradoresComPercentual = colaboradores.map(c => {
    const totalItens = itemIds.length
    const entregues = itemIds.filter(itemId => entregueSet.has(`${c.id}__${itemId}`)).length
    return {
      id: c.id,
      nomeCompleto: c.nomeCompleto,
      percentual: totalItens > 0 ? Math.round((entregues / totalItens) * 100) : 0,
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
      itensPosto: { select: { itemId: true } },
    },
    orderBy: { nome: 'asc' },
  })

  // Todas as entregas distintas (colaborador ativo, sem duplicar item já entregue mais de uma vez)
  const colabAtivosIds = postos.flatMap(p => p.colaboradores.map(c => c.id))
  const entregas = colabAtivosIds.length
    ? await db.entrega.findMany({
        where: { colaboradorId: { in: colabAtivosIds } },
        select: { colaboradorId: true, itemId: true },
        distinct: ['colaboradorId', 'itemId'],
      })
    : []
  const entregueSet = new Set(entregas.map(e => `${e.colaboradorId}__${e.itemId}`))

  const resumo = postos.map(p => {
    const colaboradoresAtivos = p.colaboradores.length
    const itensEsperados = p.itensPosto.length
    const totalPares = colaboradoresAtivos * itensEsperados
    let paresEntregues = 0
    for (const c of p.colaboradores) {
      for (const ip of p.itensPosto) {
        if (entregueSet.has(`${c.id}__${ip.itemId}`)) paresEntregues++
      }
    }
    return {
      postoId: p.id,
      postoNome: p.nome,
      corCapacete: p.corCapacete,
      colaboradoresAtivos,
      itensEsperados,
      totalPares,
      paresEntregues,
      pendentes: totalPares - paresEntregues,
      percentual: totalPares > 0 ? Math.round((paresEntregues / totalPares) * 100) : 0,
    }
  })

  return NextResponse.json({ postos: resumo })
}
