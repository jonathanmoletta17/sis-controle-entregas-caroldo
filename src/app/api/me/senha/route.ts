import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

// PUT /api/me/senha — o próprio usuário troca a senha (precisa da senha atual)
export async function PUT(req: NextRequest) {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId) return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })

  try {
    const body = await req.json()
    const senhaAtual = String(body.senhaAtual || '')
    const senhaNova = String(body.senhaNova || '')

    if (senhaNova.length < 6) {
      return NextResponse.json({ error: 'A nova senha deve ter ao menos 6 caracteres' }, { status: 400 })
    }

    const usuario = await db.usuario.findUnique({ where: { id: userId } })
    if (!usuario) return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })

    const senhaValida = await bcrypt.compare(senhaAtual, usuario.senhaHash)
    if (!senhaValida) {
      return NextResponse.json({ error: 'Senha atual incorreta' }, { status: 400 })
    }

    const senhaHash = await bcrypt.hash(senhaNova, 10)
    await db.usuario.update({ where: { id: userId }, data: { senhaHash } })

    return NextResponse.json({ message: 'Senha alterada com sucesso' })
  } catch (err: any) {
    console.error('[PUT /api/me/senha] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao trocar senha' }, { status: 500 })
  }
}
