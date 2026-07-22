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

    // Agrupar por categoria — com quantidade esperada, entregue e saldo
    const porCategoria: Record<string, Array<{
      itemId: string
      descricao: string
      unidade: string
      imagemUrl: string | null
      quantidadeEsperada: number
      entregueQtd: number
      saldo: number
      status: 'pendente' | 'parcial' | 'completo'
      obrigatorio: boolean
      entregue: boolean
      ultimaEntrega: string | null
      totalEntregas: number
    }>> = {}

    let unidadesEsperadas = 0
    let unidadesEntregues = 0
    let itensCompletos = 0
    let obrigatoriosTotal = 0

    for (const ip of itensPosto) {
      const cat = ip.item.categoria.nome
      if (!porCategoria[cat]) porCategoria[cat] = []
      const esperada = ip.quantidadeEsperada || 1
      const entregueQtd = ip.item.entregas.reduce((s, e) => s + (e.quantidade || 0), 0)
      const status = entregueQtd <= 0 ? 'pendente' : entregueQtd >= esperada ? 'completo' : 'parcial'
      // Percentual/contadores só com obrigatórios (opcionais aparecem mas não pesam)
      if (ip.obrigatorio) {
        obrigatoriosTotal++
        unidadesEsperadas += esperada
        unidadesEntregues += Math.min(entregueQtd, esperada)
        if (status === 'completo') itensCompletos++
      }
      porCategoria[cat].push({
        itemId: ip.item.id,
        descricao: ip.item.descricao,
        unidade: ip.item.unidade,
        imagemUrl: ip.item.imagemUrl,
        quantidadeEsperada: esperada,
        entregueQtd,
        saldo: Math.max(0, esperada - entregueQtd),
        status,
        obrigatorio: ip.obrigatorio,
        entregue: status === 'completo',
        ultimaEntrega: ip.item.entregas[0]?.dataEntrega.toISOString() || null,
        totalEntregas: ip.item.entregas.length,
      })
    }

    const totalItens = itensPosto.length
    const totalEntregues = itensCompletos
    const totalPendentes = obrigatoriosTotal - itensCompletos
    const percentual = unidadesEsperadas > 0 ? Math.round((unidadesEntregues / unidadesEsperadas) * 100) : 0

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
        unidadesEsperadas,
        unidadesEntregues,
      },
      geradoEm: new Date().toISOString(),
    })
  } catch (err: any) {
    console.error('[GET /api/relatorios/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao gerar relatório' }, { status: 500 })
  }
}
