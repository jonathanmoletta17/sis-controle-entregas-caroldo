import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'

// DELETE /api/entregas/[id] — excluir entrega (apenas se foi registrada por engano)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuditContext(req, async ({ userId, ip }) => {
    const { id } = await ctx.params
    const entrega = await db.entrega.delete({ where: { id } })
    await logAudit({ userId, ip, acao: 'DELETE', tabela: 'Entrega', registroId: entrega.id, valoresAntigos: entrega })
    return NextResponse.json({ message: 'Entrega removida' })
  })
}
