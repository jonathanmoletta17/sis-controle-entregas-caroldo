import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/colaboradores/[id] — detalhe com histórico completo
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const colab = await db.colaborador.findUnique({
      where: { id },
      include: {
        posto: true,
        empresa: true,
        contrato: true,
        entregas: {
          orderBy: { dataEntrega: 'desc' },
          include: { item: { include: { categoria: true } } },
        },
        mudancasPosto: {
          orderBy: { dataMudanca: 'desc' },
          include: {
            postoAnterior: true,
            postoNovo: true,
          },
        },
        desligamentos: { orderBy: { dataDesligamento: 'desc' } },
        assinaturas: { orderBy: { dataHora: 'desc' }, include: { empresa: true } },
        _count: { select: { entregas: true, mudancasPosto: true } },
      },
    })
    if (!colab) return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })
    return NextResponse.json(colab)
  } catch (err: any) {
    console.error('[GET /api/colaboradores/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao buscar colaborador' }, { status: 500 })
  }
}

// PUT /api/colaboradores/[id] — editar (nome, observacoes, etc.)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const body = await req.json()

    const update: any = {}
    if (body.nomeCompleto !== undefined) {
      if (!body.nomeCompleto || body.nomeCompleto.trim().length < 3) {
        return NextResponse.json({ error: 'Nome completo deve ter ao menos 3 caracteres' }, { status: 400 })
      }
      update.nomeCompleto = body.nomeCompleto.trim()
    }
    if (body.observacoes !== undefined) update.observacoes = body.observacoes || null
    if (body.empresaId !== undefined) update.empresaId = body.empresaId
    if (body.postoId !== undefined) {
      // Mudança de posto — registrar na tabela MudancaPosto
      const atual = await db.colaborador.findUnique({ where: { id } })
      if (atual && atual.postoId !== body.postoId) {
        // criar registro de mudança
        await db.mudancaPosto.create({
          data: {
            colaboradorId: id,
            postoAnteriorId: atual.postoId,
            postoNovoId: body.postoId,
            dataMudanca: new Date(),
            motivo: body.motivoMudancaPosto || 'Alteração manual de posto',
          },
        })
        update.postoId = body.postoId
      }
    }
    if (body.dataAdmissao !== undefined) {
      update.dataAdmissao = new Date(body.dataAdmissao)
    }

    const atualizado = await db.colaborador.update({
      where: { id },
      data: update,
      include: { posto: true, empresa: true, contrato: true },
    })

    return NextResponse.json(atualizado)
  } catch (err: any) {
    console.error('[PUT /api/colaboradores/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao atualizar colaborador' }, { status: 500 })
  }
}

// DELETE — não apaga, apenas marca como desligado (preserva histórico)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const { searchParams } = new URL(req.url)
    const motivo = searchParams.get('motivo') || 'Desligamento registrado'

    const colab = await db.colaborador.findUnique({ where: { id } })
    if (!colab) return NextResponse.json({ error: 'Não encontrado' }, { status: 404 })

    const agora = new Date()

    // Não apagar — apenas marcar como desligado, e registrar no histórico permanente
    const [atualizado] = await db.$transaction([
      db.colaborador.update({
        where: { id },
        data: {
          ativo: false,
          dataDesligamento: agora,
          motivoDesligamento: motivo,
        },
        include: { posto: true, empresa: true },
      }),
      db.desligamento.create({
        data: {
          colaboradorId: id,
          dataDesligamento: agora,
          motivo,
        },
      }),
    ])

    return NextResponse.json({
      message: 'Colaborador desligado. Histórico preservado.',
      colaborador: atualizado,
    })
  } catch (err: any) {
    console.error('[DELETE /api/colaboradores/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao desligar colaborador' }, { status: 500 })
  }
}
