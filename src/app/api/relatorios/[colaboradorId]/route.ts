import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/relatorios/[colaboradorId] — dados completos para o relatório
export async function GET(_req: NextRequest, ctx: { params: Promise<{ colaboradorId: string }> }) {
  try {
    const { colaboradorId } = await ctx.params

    const colab = await db.colaborador.findUnique({
      where: { id: colaboradorId },
      include: {
        posto: true,
        empresa: true,
        contrato: true,
        mudancasPosto: {
          orderBy: { dataMudanca: 'desc' },
          include: { postoAnterior: true, postoNovo: true },
        },
      },
    })
    if (!colab) {
      return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })
    }

    // Itens esperados para o posto atual (com entregas deste colaborador)
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
    const porCategoria: Record<string, Array<{
      itemId: string
      descricao: string
      unidade: string
      imagemUrl: string | null
      entregue: boolean
      ultimaEntrega: string | null
      totalEntregas: number
    }>> = {}

    for (const ip of itensPosto) {
      const cat = ip.item.categoria.nome
      if (!porCategoria[cat]) porCategoria[cat] = []
      porCategoria[cat].push({
        itemId: ip.item.id,
        descricao: ip.item.descricao,
        unidade: ip.item.unidade,
        imagemUrl: ip.item.imagemUrl,
        entregue: ip.item.entregas.length > 0,
        ultimaEntrega: ip.item.entregas[0]?.dataEntrega.toISOString() || null,
        totalEntregas: ip.item.entregas.length,
      })
    }

    const totalItens = itensPosto.length
    const totalEntregues = itensPosto.filter(ip => ip.item.entregas.length > 0).length
    const totalPendentes = totalItens - totalEntregues
    const percentual = totalItens > 0 ? Math.round((totalEntregues / totalItens) * 100) : 0

    return NextResponse.json({
      colaborador: {
        id: colab.id,
        nomeCompleto: colab.nomeCompleto,
        cpf: colab.cpf,
        dataAdmissao: colab.dataAdmissao.toISOString(),
        dataDesligamento: colab.dataDesligamento?.toISOString() || null,
        motivoDesligamento: colab.motivoDesligamento,
        ativo: colab.ativo,
        observacoes: colab.observacoes,
        posto: colab.posto,
        empresa: colab.empresa,
        contrato: colab.contrato,
        mudancasPosto: colab.mudancasPosto.map(m => ({
          id: m.id,
          dataMudanca: m.dataMudanca.toISOString(),
          motivo: m.motivo,
          postoAnterior: m.postoAnterior,
          postoNovo: m.postoNovo,
        })),
      },
      porCategoria,
      estatisticas: {
        totalItens,
        totalEntregues,
        totalPendentes,
        percentual,
      },
      geradoEm: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[GET /api/relatorios/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao gerar relatório' }, { status: 500 })
  }
}
