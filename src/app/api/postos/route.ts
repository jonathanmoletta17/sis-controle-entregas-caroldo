import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/postos — listar postos com itens
export async function GET() {
  const postos = await db.posto.findMany({
    include: {
      _count: { select: { colaboradores: true, itensPosto: true } },
    },
    orderBy: { nome: 'asc' },
  })
  return NextResponse.json(postos)
}
