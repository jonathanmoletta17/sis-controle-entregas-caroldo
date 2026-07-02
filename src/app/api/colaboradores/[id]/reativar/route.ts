import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// PUT /api/colaboradores/[id]/reativar — reativar colaborador desligado
export async function PUT(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const atualizado = await db.colaborador.update({
    where: { id },
    data: {
      ativo: true,
      dataDesligamento: null,
      motivoDesligamento: null,
    },
    include: { posto: true, empresa: true },
  })
  return NextResponse.json(atualizado)
}
