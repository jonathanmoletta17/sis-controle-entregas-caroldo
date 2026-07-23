import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { saveUpload, rejeitarSeGrandeDemais } from '@/lib/storage'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'
import { normalizarPostos, type PostoConfig } from '@/lib/item-postos'
import { normalizarUnidade } from '@/lib/unidades'
import { cleanupUploads, validateUploadReference } from '@/lib/upload-server'
import {
  UploadValidationError,
  type UploadReference,
  uploadErrorResponse,
  validateFileMetadata,
} from '@/lib/uploads'

const MAX_LEGACY_REQUEST_BYTES = 4 * 1024 * 1024

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
  const requestId = crypto.randomUUID()
  let imagem: UploadReference | null = null
  try {
    if (!userId) return NextResponse.json({ error: 'Usuário não identificado.', code: 'USER_REQUIRED', requestId }, { status: 403 })
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const rejeitado = rejeitarSeGrandeDemais(req, MAX_LEGACY_REQUEST_BYTES)
      if (rejeitado) return rejeitado
    }
    let descricao: string
    let unidade: string = ''
    let categoriaId: string
    let ativo: boolean = true
    let postos: PostoConfig[] = []
    let imagemUrl: string | null = null
    let imagemNome: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      descricao = String(formData.get('descricao') || '')
      unidade = String(formData.get('unidade') || '')
      categoriaId = String(formData.get('categoriaId') || '')
      ativo = formData.get('ativo') !== 'false'
      const postosStr = formData.get('postos') as string | null
      postos = postosStr ? normalizarPostos(JSON.parse(postosStr)) : []

      const file = formData.get('imagem') as File | null
      if (file && file.size > 0) {
        const result = await saveImage(file, userId)
        if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
        imagemUrl = result.url!
        imagemNome = result.nome!
        imagem = { url: result.url!, nome: result.nome! }
      }
    } else {
      const body = await req.json()
      descricao = body.descricao
      unidade = body.unidade || ''
      categoriaId = body.categoriaId
      ativo = body.ativo !== false
      postos = normalizarPostos(body.postos)
      imagem = body.imagem || null
    }

    if (!descricao || String(descricao).trim().length < 3) {
      await cleanupUploads([imagem])
      imagem = null
      return NextResponse.json({ error: 'Descrição é obrigatória (mínimo 3 caracteres)' }, { status: 400 })
    }
    if (!categoriaId) {
      await cleanupUploads([imagem])
      imagem = null
      return NextResponse.json({ error: 'Categoria é obrigatória' }, { status: 400 })
    }
    if (imagem) {
      await validateUploadReference(imagem, 'item-image', userId)
      imagemUrl = imagem.url
      imagemNome = imagem.nome
    }

    const final = await db.$transaction(async tx => {
      const item = await tx.item.create({
        data: {
          descricao: String(descricao).trim(),
          unidade: normalizarUnidade(unidade),
          categoriaId,
          ativo,
          imagemUrl,
          imagemNome,
          criadoPorId: userId,
        },
      })
      if (postos.length > 0) {
        await tx.itemPosto.createMany({
          data: postos.map(p => ({
            itemId: item.id,
            postoId: p.postoId,
            quantidadeEsperada: p.quantidadeEsperada,
            obrigatorio: p.obrigatorio,
          })),
        })
      }
      return tx.item.findUnique({
        where: { id: item.id },
        include: {
          categoria: true,
          postos: { include: { posto: true } },
          criadoPor: { select: { nome: true } },
          atualizadoPor: { select: { nome: true } },
        },
      })
    })
    if (!final) throw new Error('Item não encontrado após criação.')
    await logAudit({ userId, ip, acao: 'CREATE', tabela: 'Item', registroId: final.id, valoresNovos: final })
    return NextResponse.json(final, { status: 201 })
  } catch (err: any) {
    await cleanupUploads([imagem])
    console.error('[POST /api/itens] error:', { requestId, code: err?.code, error: err })
    if (err instanceof UploadValidationError) {
      const response = uploadErrorResponse(err, requestId)
      return NextResponse.json(response.body, { status: response.status })
    }
    return NextResponse.json(
      { error: 'Erro ao criar item. Tente novamente.', code: 'ITEM_CREATE_FAILED', requestId },
      { status: 500 },
    )
  }
  })
}

// Helper: salvar imagem do item
async function saveImage(file: File, userId: string): Promise<{ url?: string; nome?: string; error?: string }> {
  try {
    validateFileMetadata(file, 'item-image')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Imagem inválida.' }
  }
  const { url, nome } = await saveUpload(file, 'itens', userId)
  return { url, nome }
}
