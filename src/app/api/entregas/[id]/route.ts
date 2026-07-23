import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'
import { cleanupUploads } from '@/lib/upload-server'

// DELETE /api/entregas/[id] — excluir entrega (apenas se foi registrada por engano)
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuditContext(req, async ({ userId, ip }) => {
    const { id } = await ctx.params
    const entrega = await db.entrega.findUnique({ where: { id } })
    if (!entrega) return NextResponse.json({ error: 'Entrega não encontrada.' }, { status: 404 })
    await db.entrega.delete({ where: { id } })
    await logAudit({ userId, ip, acao: 'DELETE', tabela: 'Entrega', registroId: entrega.id, valoresAntigos: entrega })
    await cleanupUploads([
      entrega.fotoUrl ? { url: entrega.fotoUrl, nome: 'foto' } : null,
      entrega.anexoUrl ? { url: entrega.anexoUrl, nome: entrega.anexoNome || 'anexo' } : null,
    ])
    return NextResponse.json({ message: 'Entrega removida' })
  })
}
