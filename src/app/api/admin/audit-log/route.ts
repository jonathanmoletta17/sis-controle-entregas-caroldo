import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

// GET /api/admin/audit-log?usuarioId=...&tabela=...&limit=... — apenas admin
export async function GET(req: NextRequest) {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
  }

  const { searchParams } = new URL(req.url)
  const usuarioId = searchParams.get('usuarioId')
  const tabela = searchParams.get('tabela')
  const dataInicio = searchParams.get('dataInicio')
  const dataFim = searchParams.get('dataFim')
  const limit = parseInt(searchParams.get('limit') || '100', 10)

  const where: any = {}
  if (usuarioId) where.usuarioId = usuarioId
  if (tabela) where.tabela = tabela
  if (dataInicio || dataFim) {
    where.timestamp = {}
    if (dataInicio) where.timestamp.gte = new Date(dataInicio)
    if (dataFim) where.timestamp.lte = new Date(`${dataFim}T23:59:59`)
  }

  const logs = await db.auditLog.findMany({
    where,
    take: limit,
    orderBy: { timestamp: 'desc' },
    include: { usuario: { select: { id: true, nome: true, email: true } } },
  })

  return NextResponse.json(logs)
}
