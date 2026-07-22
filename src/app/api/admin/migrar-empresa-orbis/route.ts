import { NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { auth } from '@/lib/auth'

// GET /api/admin/migrar-empresa-orbis — rota temporária, só admin.
// Renomeia a empresa "CAROLDO" para "ORBIS" no banco que a própria aplicação
// está usando em runtime (mesma DATABASE_URL do deploy) — evita precisar
// extrair a connection string de produção manualmente. Idempotente: pode
// visitar mais de uma vez sem risco. Mesma lógica de
// scripts/renomear_empresa_caroldo_orbis.ts.
//
// Remover esta rota depois de confirmar que o relatório mostra "ORBIS".
export async function GET() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Acesso restrito a administradores' }, { status: 403 })
  }

  const caroldo = await db.empresa.findUnique({ where: { nome: 'CAROLDO' } })
  if (!caroldo) {
    return NextResponse.json({ ok: true, message: 'Nenhuma empresa "CAROLDO" encontrada. Nada a fazer.' })
  }

  const orbis = await db.empresa.findUnique({ where: { nome: 'ORBIS' } })

  if (!orbis) {
    await db.empresa.update({ where: { id: caroldo.id }, data: { nome: 'ORBIS' } })
    return NextResponse.json({ ok: true, message: `Empresa "CAROLDO" (${caroldo.id}) renomeada para "ORBIS".` })
  }

  const colaboradores = await db.colaborador.updateMany({
    where: { empresaId: caroldo.id },
    data: { empresaId: orbis.id },
  })

  const contratosCaroldo = await db.empresaContrato.findMany({ where: { empresaId: caroldo.id } })
  for (const ec of contratosCaroldo) {
    const jaExiste = await db.empresaContrato.findUnique({
      where: { empresaId_contratoId: { empresaId: orbis.id, contratoId: ec.contratoId } },
    })
    if (jaExiste) {
      await db.empresaContrato.delete({ where: { id: ec.id } })
    } else {
      await db.empresaContrato.update({ where: { id: ec.id }, data: { empresaId: orbis.id } })
    }
  }

  await db.empresa.delete({ where: { id: caroldo.id } })

  return NextResponse.json({
    ok: true,
    message: `Duplicata "CAROLDO" removida. ${colaboradores.count} colaborador(es) migrado(s) para "ORBIS".`,
  })
}
