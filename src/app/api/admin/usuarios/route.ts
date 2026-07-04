import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'
import type { Role } from '@/lib/permissions'

async function exigirAdmin() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (role !== 'admin') return null
  return session
}

// GET /api/admin/usuarios — listar todos (apenas admin)
export async function GET() {
  const session = await exigirAdmin()
  if (!session) return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })

  const usuarios = await db.usuario.findMany({
    select: { id: true, email: true, nome: true, role: true, ativo: true, createdAt: true },
    orderBy: [{ ativo: 'desc' }, { nome: 'asc' }],
  })
  return NextResponse.json(usuarios)
}

// POST /api/admin/usuarios — criar novo usuário com senha temporária (apenas admin)
export async function POST(req: NextRequest) {
  const session = await exigirAdmin()
  if (!session) return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })

  try {
    const body = await req.json()
    const email = String(body.email || '').trim().toLowerCase()
    const nome = String(body.nome || '').trim()
    const rolesValidos: Role[] = ['admin', 'tecnico', 'leitura']
    const role: Role = rolesValidos.includes(body.role) ? body.role : 'tecnico'

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
    }
    if (!nome || nome.length < 3) {
      return NextResponse.json({ error: 'Nome deve ter ao menos 3 caracteres' }, { status: 400 })
    }

    const existente = await db.usuario.findUnique({ where: { email } })
    if (existente) {
      return NextResponse.json({ error: 'Já existe um usuário com este e-mail' }, { status: 409 })
    }

    const senhaTemporaria = crypto.randomBytes(9).toString('base64url')
    const senhaHash = await bcrypt.hash(senhaTemporaria, 10)

    const usuario = await db.usuario.create({
      data: { email, nome, senhaHash, role, ativo: true },
      select: { id: true, email: true, nome: true, role: true, ativo: true },
    })

    return NextResponse.json({ usuario, senhaTemporaria }, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/admin/usuarios] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao criar usuário' }, { status: 500 })
  }
}
