import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'

// GET /api/colaboradores?incluirDesligados=true
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const incluirDesligados = searchParams.get('incluirDesligados') === 'true'
  const buscar = searchParams.get('q') || ''

  const where: any = {}
  if (!incluirDesligados) {
    where.ativo = true
  }
  if (buscar) {
    where.OR = [
      { nomeCompleto: { contains: buscar } },
      { cpf: { contains: buscar } },
    ]
  }

  const colaboradores = await db.colaborador.findMany({
    where,
    include: {
      posto: true,
      empresa: true,
      contrato: true,
      _count: { select: { entregas: true, mudancasPosto: true } },
    },
    orderBy: [{ ativo: 'desc' }, { nomeCompleto: 'asc' }],
  })

  return NextResponse.json(colaboradores)
}

// POST /api/colaboradores — criar novo
export async function POST(req: NextRequest) {
  return withAuditContext(req, async ({ userId, ip }) => {
  try {
    const body = await req.json()

    // Validar CPF (apenas dígitos)
    const cpf = (body.cpf || '').replace(/\D/g, '')
    if (!cpf || cpf.length !== 11) {
      return NextResponse.json({ error: 'CPF inválido. Deve conter 11 dígitos.' }, { status: 400 })
    }
    if (!body.nomeCompleto || body.nomeCompleto.trim().length < 3) {
      return NextResponse.json({ error: 'Nome completo é obrigatório (mínimo 3 caracteres).' }, { status: 400 })
    }
    if (!body.postoId) {
      return NextResponse.json({ error: 'Posto é obrigatório.' }, { status: 400 })
    }
    if (!body.empresaId) {
      return NextResponse.json({ error: 'Empresa é obrigatória.' }, { status: 400 })
    }

    // Verificar CPF único
    const existente = await db.colaborador.findUnique({ where: { cpf } })
    if (existente) {
      return NextResponse.json({ error: 'Já existe um colaborador com este CPF.' }, { status: 409 })
    }

    // Buscar contrato ativo (004/2026)
    const contrato = await db.contrato.findFirst({ orderBy: { dataAssinatura: 'desc' } })
    if (!contrato) {
      return NextResponse.json({ error: 'Nenhum contrato cadastrado. Rode o seed.' }, { status: 500 })
    }

    const novo = await db.colaborador.create({
      data: {
        cpf,
        nomeCompleto: body.nomeCompleto.trim(),
        empresaId: body.empresaId,
        contratoId: contrato.id,
        postoId: body.postoId,
        dataAdmissao: body.dataAdmissao ? new Date(body.dataAdmissao) : new Date(),
        observacoes: body.observacoes || null,
        ativo: true,
        criadoPorId: userId,
      },
      include: { posto: true, empresa: true, contrato: true },
    })

    await logAudit({ userId, ip, acao: 'CREATE', tabela: 'Colaborador', registroId: novo.id, valoresNovos: novo })

    return NextResponse.json(novo, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/colaboradores] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
  })
}
