import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/checklist?colaboradorId=... — itens esperados vs entregues para um colaborador
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const colaboradorId = searchParams.get('colaboradorId')
  if (!colaboradorId) {
    return NextResponse.json({ error: 'colaboradorId é obrigatório' }, { status: 400 })
  }

  const colab = await db.colaborador.findUnique({
    where: { id: colaboradorId },
    include: { posto: true },
  })
  if (!colab) {
    return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })
  }

  // Itens esperados para o posto atual
  const itensPosto = await db.itemPosto.findMany({
    where: { postoId: colab.postoId },
    include: {
      item: {
        include: {
          categoria: true,
          entregas: {
            where: { colaboradorId },
            orderBy: { dataEntrega: 'desc' },
          },
        },
      },
    },
    orderBy: { item: { descricao: 'asc' } },
  })

  // Agrupar por categoria
  const porCategoria: Record<string, any[]> = {}
  for (const ip of itensPosto) {
    const cat = ip.item.categoria.nome
    if (!porCategoria[cat]) porCategoria[cat] = []
    porCategoria[cat].push({
      itemId: ip.item.id,
      descricao: ip.item.descricao,
      unidade: ip.item.unidade,
      imagemUrl: ip.item.imagemUrl,
      imagemNome: ip.item.imagemNome,
      quantidadeEsperada: ip.quantidadeEsperada,
      obrigatorio: ip.obrigatorio,
      entregas: ip.item.entregas,
      entregue: ip.item.entregas.length > 0,
      ultimaEntrega: ip.item.entregas[0]?.dataEntrega || null,
    })
  }

  // Estatísticas
  const totalItens = itensPosto.length
  const totalEntregues = itensPosto.filter(ip => ip.item.entregas.length > 0).length
  const totalPendentes = totalItens - totalEntregues
  const percentual = totalItens > 0 ? Math.round((totalEntregues / totalItens) * 100) : 0

  return NextResponse.json({
    colaborador: {
      id: colab.id,
      nomeCompleto: colab.nomeCompleto,
      cpf: colab.cpf,
      posto: colab.posto,
      ativo: colab.ativo,
    },
    porCategoria,
    estatisticas: {
      totalItens,
      totalEntregues,
      totalPendentes,
      percentual,
    },
  })
}
