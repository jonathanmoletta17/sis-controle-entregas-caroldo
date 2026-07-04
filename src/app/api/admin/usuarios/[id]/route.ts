import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

async function exigirAdmin() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (role !== 'admin') return null
  return session
}

// PUT /api/admin/usuarios/[id] — ativar/desativar ou trocar role (apenas admin)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await exigirAdmin()
  if (!session) return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })

  try {
    const { id } = await ctx.params
    const body = await req.json()
    const meuId = (session.user as { id?: string }).id

    if (id === meuId && body.ativo === false) {
      return NextResponse.json({ error: 'Você não pode desativar sua própria conta' }, { status: 400 })
    }

    const update: any = {}
    if (typeof body.ativo === 'boolean') update.ativo = body.ativo
    if (body.role === 'admin' || body.role === 'fiscal') update.role = body.role

    const usuario = await db.usuario.update({
      where: { id },
      data: update,
      select: { id: true, email: true, nome: true, role: true, ativo: true },
    })
    return NextResponse.json(usuario)
  } catch (err: any) {
    console.error('[PUT /api/admin/usuarios/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao atualizar usuário' }, { status: 500 })
  }
}
