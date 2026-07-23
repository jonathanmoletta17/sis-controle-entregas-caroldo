import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { saveUpload, rejeitarSeGrandeDemais } from '@/lib/storage'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'
import { cleanupUploads, validateUploadReference } from '@/lib/upload-server'
import {
  UploadValidationError,
  type UploadReference,
  uploadErrorResponse,
  validateFileMetadata,
} from '@/lib/uploads'

const MAX_LEGACY_REQUEST_BYTES = 4 * 1024 * 1024

class ApiError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) {
    super(message)
  }
}

const entregaInclude = {
  colaborador: { select: { id: true, nomeCompleto: true, cpf: true, posto: true } },
  item: { select: { id: true, descricao: true, categoria: true } },
} as const

// POST /api/entregas — registrar nova entrega com anexo (multipart/form-data)
// Ou application/json (sem anexo)
export async function POST(req: NextRequest) {
  return withAuditContext(req, async ({ userId, ip }) => {
  const requestId = crypto.randomUUID()
  let anexoRef: UploadReference | null = null
  let fotoRef: UploadReference | null = null
  try {
    if (!userId) throw new ApiError('USER_REQUIRED', 'Usuário não identificado.', 403)
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const rejeitado = rejeitarSeGrandeDemais(req, MAX_LEGACY_REQUEST_BYTES)
      if (rejeitado) return rejeitado
    }

    let colaboradorId: string
    let itemId: string
    let dataEntrega: string
    let quantidade: number = 1
    let observacao: string | null = null
    let anexoUrl: string | null = null
    let anexoNome: string | null = null
    let fotoUrl: string | null = null
    let anexo: File | null = null
    let foto: File | null = null
    let idempotencyKey: string = crypto.randomUUID()

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      colaboradorId = String(formData.get('colaboradorId') || '')
      itemId = String(formData.get('itemId') || '')
      dataEntrega = String(formData.get('dataEntrega') || '')
      quantidade = parseInt(String(formData.get('quantidade') || '1'), 10) || 1
      observacao = (formData.get('observacao') as string) || null
      idempotencyKey = String(formData.get('idempotencyKey') || idempotencyKey)

      anexo = formData.get('anexo') as File | null
      if (anexo && anexo.size > 0) {
        validateFileMetadata(anexo, 'delivery-attachment')
      }

      foto = formData.get('foto') as File | null
      if (foto && foto.size > 0) {
        validateFileMetadata(foto, 'delivery-photo')
      }
    } else {
      // JSON sem anexo
      const body = await req.json()
      colaboradorId = body.colaboradorId
      itemId = body.itemId
      dataEntrega = body.dataEntrega
      quantidade = body.quantidade || 1
      observacao = body.observacao || null
      idempotencyKey = String(body.idempotencyKey || idempotencyKey)
      anexoRef = body.anexo || null
      fotoRef = body.foto || null
    }

    if (!colaboradorId) {
      throw new ApiError('COLABORADOR_REQUIRED', 'Colaborador é obrigatório.')
    }
    if (!itemId) {
      throw new ApiError('ITEM_REQUIRED', 'Item é obrigatório.')
    }
    if (!dataEntrega) {
      throw new ApiError('DATA_ENTREGA_REQUIRED', 'Data de entrega é obrigatória.')
    }
    const dataEntregaParsed = new Date(dataEntrega)
    if (Number.isNaN(dataEntregaParsed.getTime())) {
      throw new ApiError('DATA_ENTREGA_INVALID', 'A data de entrega é inválida.')
    }
    if (!Number.isInteger(quantidade) || quantidade < 1) {
      throw new ApiError('QUANTIDADE_INVALID', 'A quantidade deve ser um número inteiro maior que zero.')
    }
    if (!/^[0-9a-f-]{20,64}$/i.test(idempotencyKey)) {
      throw new ApiError('IDEMPOTENCY_KEY_INVALID', 'Identificador da operação inválido.')
    }

    const existente = await db.entrega.findUnique({
      where: { idempotencyKey },
      include: entregaInclude,
    })
    if (existente) {
      if (existente.criadoPorId !== userId) {
        throw new ApiError('IDEMPOTENCY_KEY_CONFLICT', 'Identificador de operação já utilizado.', 409)
      }
      const descartaveis = [
        fotoRef?.url !== existente.fotoUrl ? fotoRef : null,
        anexoRef?.url !== existente.anexoUrl ? anexoRef : null,
      ]
      await cleanupUploads(descartaveis)
      return NextResponse.json(existente, {
        status: 200,
        headers: { 'x-idempotent-replay': 'true', 'x-request-id': requestId },
      })
    }

    // Verificar se colaborador está ativo
    const colab = await db.colaborador.findUnique({
      where: { id: colaboradorId },
      select: { ativo: true, postoId: true, posto: { select: { nome: true } } },
    })
    if (!colab) throw new ApiError('COLABORADOR_NOT_FOUND', 'Colaborador não encontrado.', 404)
    if (!colab.ativo) {
      throw new ApiError('COLABORADOR_INACTIVE', 'Não é possível registrar entrega para colaborador desligado. Reative o cadastro antes.')
    }

    // A filtragem da interface não é uma garantia de integridade: confirme no servidor
    // que o item ainda está ativo e vinculado ao posto atual do colaborador.
    const vinculo = await db.itemPosto.findUnique({
      where: { itemId_postoId: { itemId, postoId: colab.postoId } },
      select: { item: { select: { ativo: true, categoria: { select: { nome: true } } } } },
    })
    if (!vinculo) {
      throw new ApiError('ITEM_POSTO_INVALID', `O item selecionado não está vinculado ao posto ${colab.posto.nome}.`)
    }
    if (!vinculo.item.ativo) {
      throw new ApiError('ITEM_INACTIVE', 'Não é possível registrar entrega de um item inativo.')
    }
    if ((anexo || anexoRef) && vinculo.item.categoria.nome !== 'Documento') {
      throw new ApiError('ATTACHMENT_NOT_ALLOWED', 'Anexos são permitidos somente para itens da categoria Documento.')
    }

    // Compatibilidade local/legada: a interface atual usa upload direto e envia referências JSON.
    if (anexo && anexo.size > 0) {
      const { url, nome } = await saveUpload(anexo, 'anexos', userId)
      anexoUrl = url
      anexoNome = nome
      anexoRef = { url, nome }
    }
    if (foto && foto.size > 0) {
      const { url, nome } = await saveUpload(foto, 'entregas-fotos', userId)
      fotoUrl = url
      fotoRef = { url, nome }
    }
    if (anexoRef) {
      await validateUploadReference(anexoRef, 'delivery-attachment', userId)
      anexoUrl = anexoRef.url
      anexoNome = anexoRef.nome
    }
    if (fotoRef) {
      await validateUploadReference(fotoRef, 'delivery-photo', userId)
      fotoUrl = fotoRef.url
    }

    const entrega = await db.entrega.create({
      data: {
        idempotencyKey,
        colaboradorId,
        itemId,
        dataEntrega: dataEntregaParsed,
        quantidade,
        observacao,
        anexoUrl,
        anexoNome,
        fotoUrl,
        criadoPorId: userId,
      },
      include: entregaInclude,
    })

    await logAudit({ userId, ip, acao: 'CREATE', tabela: 'Entrega', registroId: entrega.id, valoresNovos: entrega })

    return NextResponse.json(entrega, { status: 201, headers: { 'x-request-id': requestId } })
  } catch (err: any) {
    await cleanupUploads([anexoRef, fotoRef])
    console.error('[POST /api/entregas] error:', { requestId, code: err?.code, error: err })
    if (err instanceof UploadValidationError) {
      const response = uploadErrorResponse(err, requestId)
      return NextResponse.json(response.body, { status: response.status })
    }
    if (err instanceof ApiError) {
      return NextResponse.json(
        { error: err.message, code: err.code, requestId },
        { status: err.status },
      )
    }
    return NextResponse.json(
      { error: 'Erro ao registrar entrega. Tente novamente.', code: 'ENTREGA_CREATE_FAILED', requestId },
      { status: 500 },
    )
  }
  })
}

// GET /api/entregas?colaboradorId=...&itemId=...&postoId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const colaboradorId = searchParams.get('colaboradorId')
  const itemId = searchParams.get('itemId')
  const postoId = searchParams.get('postoId')
  const limit = parseInt(searchParams.get('limit') || '100', 10)

  const where: any = {}
  if (colaboradorId) where.colaboradorId = colaboradorId
  if (itemId) where.itemId = itemId
  if (postoId) where.colaborador = { postoId }

  const entregas = await db.entrega.findMany({
    where,
    take: limit,
    orderBy: { dataEntrega: 'desc' },
    include: {
      colaborador: { select: { id: true, nomeCompleto: true, cpf: true, posto: true } },
      item: { select: { id: true, descricao: true, unidade: true, categoria: true, imagemUrl: true, imagemNome: true } },
    },
  })

  return NextResponse.json(entregas)
}
