import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

async function exigirAdmin() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (role !== 'admin') return null
  return session
}

// PUT /api/admin/usuarios/[id] — ativar/desativar, trocar role, ou editar nome/e-mail (apenas admin)
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
    if (['admin', 'tecnico', 'leitura'].includes(body.role)) update.role = body.role

    if (body.nome !== undefined) {
      const nome = String(body.nome).trim()
      if (!nome || nome.length < 3) {
        return NextResponse.json({ error: 'Nome deve ter ao menos 3 caracteres' }, { status: 400 })
      }
      update.nome = nome
    }

    if (body.email !== undefined) {
      const email = String(body.email).trim().toLowerCase()
      if (!email || !email.includes('@')) {
        return NextResponse.json({ error: 'E-mail inválido' }, { status: 400 })
      }
      const existente = await db.usuario.findUnique({ where: { email } })
      if (existente && existente.id !== id) {
        return NextResponse.json({ error: 'Já existe um usuário com este e-mail' }, { status: 409 })
      }
      update.email = email
    }

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

// DELETE /api/admin/usuarios/[id] — exclui de vez, só se o usuário não tiver nenhum
// histórico registrado (audit log ou registros criados/atualizados por ele). Se tiver
// histórico, a exclusão é bloqueada — o caminho correto nesse caso é desativar.
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const session = await exigirAdmin()
  if (!session) return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })

  try {
    const { id } = await ctx.params
    const meuId = (session.user as { id?: string }).id

    if (id === meuId) {
      return NextResponse.json({ error: 'Você não pode excluir sua própria conta' }, { status: 400 })
    }

    const usuario = await db.usuario.findUnique({ where: { id } })
    if (!usuario) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 })
    }

    const [
      auditLogs, colaboradoresCriados, colaboradoresAtualizados,
      itensCriados, itensAtualizados, entregasCriadas, entregasAtualizadas,
      mudancasPostoCriadas, desligamentosCriados, desligamentosAtualizados,
    ] = await Promise.all([
      db.auditLog.count({ where: { usuarioId: id } }),
      db.colaborador.count({ where: { criadoPorId: id } }),
      db.colaborador.count({ where: { atualizadoPorId: id } }),
      db.item.count({ where: { criadoPorId: id } }),
      db.item.count({ where: { atualizadoPorId: id } }),
      db.entrega.count({ where: { criadoPorId: id } }),
      db.entrega.count({ where: { atualizadoPorId: id } }),
      db.mudancaPosto.count({ where: { criadoPorId: id } }),
      db.desligamento.count({ where: { criadoPorId: id } }),
      db.desligamento.count({ where: { atualizadoPorId: id } }),
    ])

    const totalHistorico = auditLogs + colaboradoresCriados + colaboradoresAtualizados
      + itensCriados + itensAtualizados + entregasCriadas + entregasAtualizadas
      + mudancasPostoCriadas + desligamentosCriados + desligamentosAtualizados

    if (totalHistorico > 0) {
      return NextResponse.json({
        error: 'Este usuário já tem ações registradas no sistema (auditoria/histórico) e não pode ser excluído. Desative-o em vez de excluir — isso preserva o histórico e bloqueia o acesso.',
      }, { status: 409 })
    }

    await db.$transaction([
      db.sessaoLogin.deleteMany({ where: { usuarioId: id } }),
      db.usuario.delete({ where: { id } }),
    ])

    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[DELETE /api/admin/usuarios/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao excluir usuário' }, { status: 500 })
  }
}
