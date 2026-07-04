import { NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

// POST /api/admin/usuarios/[id]/resetar-senha — gera nova senha temporária (apenas admin)
export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const session = await auth()
  if ((session?.user as { role?: string } | undefined)?.role !== 'admin') {
    return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
  }

  try {
    const { id } = await ctx.params
    const senhaTemporaria = crypto.randomBytes(9).toString('base64url')
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10)

    const usuario = await db.usuario.update({
      where: { id },
      data: { senhaHash },
      select: { id: true, email: true, nome: true },
    })

    return NextResponse.json({ usuario, senhaTemporaria })
  } catch (err: any) {
    console.error('[POST /api/admin/usuarios/[id]/resetar-senha] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao redefinir senha' }, { status: 500 })
  }
}
