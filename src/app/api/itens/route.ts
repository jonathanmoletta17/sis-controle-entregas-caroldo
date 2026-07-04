import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import path from 'path'
import { saveUpload } from '@/lib/storage'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'

// GET /api/itens?categoriaId=...&postoId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const categoriaId = searchParams.get('categoriaId')
  const postoId = searchParams.get('postoId')

  const where: any = {}
  if (categoriaId) where.categoriaId = categoriaId

  if (postoId) {
    const itensPosto = await db.itemPosto.findMany({
      where: { postoId },
      include: {
        item: {
          include: { categoria: true, postos: { include: { posto: true } } },
        },
      },
      orderBy: { item: { descricao: 'asc' } },
    })
    return NextResponse.json(itensPosto.map(ip => ({
      ...ip.item,
      quantidadeEsperada: ip.quantidadeEsperada,
      obrigatorio: ip.obrigatorio,
    })))
  }

  const itens = await db.item.findMany({
    where,
    include: {
      categoria: true,
      postos: { include: { posto: true } },
      criadoPor: { select: { nome: true } },
      atualizadoPor: { select: { nome: true } },
      _count: { select: { entregas: true } },
    },
    orderBy: { descricao: 'asc' },
  })
  return NextResponse.json(itens)
}

// POST /api/itens — criar novo item (multipart/form-data com imagem OU JSON sem imagem)
export async function POST(req: NextRequest) {
  return withAuditContext(req, async ({ userId, ip }) => {
  try {
    const contentType = req.headers.get('content-type') || ''
    let descricao: string
    let unidade: string = '1'
    let categoriaId: string
    let ativo: boolean = true
    let postos: string[] = []
    let imagemUrl: string | null = null
    let imagemNome: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      descricao = String(formData.get('descricao') || '')
      unidade = String(formData.get('unidade') || '1')
      categoriaId = String(formData.get('categoriaId') || '')
      ativo = formData.get('ativo') !== 'false'
      const postosStr = formData.get('postos') as string | null
      postos = postosStr ? JSON.parse(postosStr) : []

      const file = formData.get('imagem') as File | null
      if (file && file.size > 0) {
        const result = await saveImage(file)
        if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
        imagemUrl = result.url
        imagemNome = result.nome
      }
    } else {
      const body = await req.json()
      descricao = body.descricao
      unidade = body.unidade || '1'
      categoriaId = body.categoriaId
      ativo = body.ativo !== false
      postos = Array.isArray(body.postos) ? body.postos : []
    }

    if (!descricao || String(descricao).trim().length < 3) {
      return NextResponse.json({ error: 'Descrição é obrigatória (mínimo 3 caracteres)' }, { status: 400 })
    }
    if (!categoriaId) {
      return NextResponse.json({ error: 'Categoria é obrigatória' }, { status: 400 })
    }

    const item = await db.item.create({
      data: {
        descricao: String(descricao).trim(),
        unidade: String(unidade).replace(/\D/g, '') || '1',
        categoriaId,
        ativo,
        imagemUrl,
        imagemNome,
        criadoPorId: userId,
      },
      include: { categoria: true },
    })

    if (postos.length > 0) {
      const uniquePostos = Array.from(new Set(postos as string[]))
      await db.itemPosto.createMany({
        data: uniquePostos.map((postoId: string) => ({
          itemId: item.id,
          postoId,
          quantidadeEsperada: 1,
          obrigatorio: true,
        })),
      })
    }

    const final = await db.item.findUnique({
      where: { id: item.id },
      include: {
        categoria: true,
        postos: { include: { posto: true } },
        criadoPor: { select: { nome: true } },
        atualizadoPor: { select: { nome: true } },
      },
    })
    await logAudit({ userId, ip, acao: 'CREATE', tabela: 'Item', registroId: item.id, valoresNovos: final })
    return NextResponse.json(final, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/itens] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao criar item' }, { status: 500 })
  }
  })
}

// Helper: salvar imagem do item
async function saveImage(file: File): Promise<{ url?: string; nome?: string; error?: string }> {
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Imagem muito grande. Máximo 5MB.' }
  }
  const ext = path.extname(file.name).toLowerCase()
  const extsPermitidas = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
  if (!extsPermitidas.includes(ext)) {
    return { error: `Extensão ${ext} não permitida para imagem. Aceitas: ${extsPermitidas.join(', ')}` }
  }
  const { url, nome } = await saveUpload(file, 'itens')
  return { url, nome }
}
