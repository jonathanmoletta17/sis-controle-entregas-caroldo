import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// DELETE /api/entregas/[id] — excluir entrega (apenas se foi registrada por engano)
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  await db.entrega.delete({ where: { id } })
  return NextResponse.json({ message: 'Entrega removida' })
}
