import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/empresas
export async function GET() {
  const empresas = await db.empresa.findMany({
    include: { _count: { select: { colaboradores: true } } },
    orderBy: { nome: 'asc' },
  })
  return NextResponse.json(empresas)
}
