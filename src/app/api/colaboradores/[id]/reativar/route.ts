import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'

// PUT /api/colaboradores/[id]/reativar — reativar colaborador desligado
// O registro de desligamento é preservado no histórico (Desligamento), só é fechado com a data de reativação.
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuditContext(req, async ({ userId, ip }) => {
  try {
    const { id } = await ctx.params
    const agora = new Date()

    const desligamentoAberto = await db.desligamento.findFirst({
      where: { colaboradorId: id, dataReativacao: null },
      orderBy: { dataDesligamento: 'desc' },
    })

    const [atualizado] = await db.$transaction([
      db.colaborador.update({
        where: { id },
        data: {
          ativo: true,
          dataDesligamento: null,
          motivoDesligamento: null,
          atualizadoPorId: userId,
        },
        include: { posto: true, empresa: true },
      }),
      ...(desligamentoAberto
        ? [db.desligamento.update({ where: { id: desligamentoAberto.id }, data: { dataReativacao: agora, atualizadoPorId: userId } })]
        : []),
    ])

    await logAudit({ userId, ip, acao: 'UPDATE', tabela: 'Colaborador', registroId: atualizado.id, valoresNovos: atualizado })

    return NextResponse.json(atualizado)
  } catch (err: any) {
    console.error('[PUT /api/colaboradores/[id]/reativar] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao reativar colaborador' }, { status: 500 })
  }
  })
}
