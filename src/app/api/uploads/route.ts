import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { canWrite } from '@/lib/permissions'
import { saveUpload } from '@/lib/storage'
import { deleteUpload, validateUploadReference } from '@/lib/upload-server'
import {
  UPLOAD_CONFIG,
  UploadValidationError,
  type UploadPurpose,
  uploadErrorResponse,
  validateFileMetadata,
} from '@/lib/uploads'

async function getActor() {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  const userId = (session?.user as { id?: string } | undefined)?.id
  if (!userId || !canWrite(role)) return null
  return { userId }
}

function parsePurpose(value: unknown): UploadPurpose {
  if (typeof value === 'string' && value in UPLOAD_CONFIG) return value as UploadPurpose
  throw new UploadValidationError('INVALID_UPLOAD_PURPOSE', 'Finalidade de upload inválida.')
}

export async function GET() {
  const actor = await getActor()
  if (!actor) return NextResponse.json({ error: 'Upload não autorizado.' }, { status: 403 })
  return NextResponse.json({
    directUpload: !!process.env.VERCEL || !!process.env.BLOB_READ_WRITE_TOKEN,
    userId: actor.userId,
  })
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID()
  const actor = await getActor()
  if (!actor) {
    return NextResponse.json(
      { error: 'Upload não autorizado.', code: 'UPLOAD_FORBIDDEN', requestId },
      { status: 403 },
    )
  }

  try {
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      if (process.env.VERCEL) {
        throw new UploadValidationError('DIRECT_UPLOAD_REQUIRED', 'Use o envio direto para arquivos em produção.')
      }
      const form = await req.formData()
      const purpose = parsePurpose(form.get('purpose'))
      const file = form.get('file')
      if (!(file instanceof File)) throw new UploadValidationError('FILE_REQUIRED', 'Selecione um arquivo.')
      validateFileMetadata(file, purpose)
      const config = UPLOAD_CONFIG[purpose]
      const result = await saveUpload(file, config.folder, actor.userId)
      return NextResponse.json(result, { status: 201 })
    }

    const body = await req.json() as HandleUploadBody
    const result = await handleUpload({
      request: req,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        const payload = JSON.parse(clientPayload || '{}') as { purpose?: string }
        const purpose = parsePurpose(payload.purpose)
        const config = UPLOAD_CONFIG[purpose]
        const expectedPrefix = `${config.folder}/${actor.userId}/`
        if (!pathname.startsWith(expectedPrefix) || pathname.includes('..')) {
          throw new UploadValidationError('INVALID_UPLOAD_PATH', 'Destino de upload inválido.', 403)
        }
        return {
          allowedContentTypes: config.allowedContentTypes,
          maximumSizeInBytes: config.maxBytes,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ purpose, userId: actor.userId }),
        }
      },
    })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[upload.request] falha:', { requestId, error })
    const response = uploadErrorResponse(error, requestId)
    return NextResponse.json(response.body, { status: response.status })
  }
}

export async function DELETE(req: NextRequest) {
  const requestId = crypto.randomUUID()
  const actor = await getActor()
  if (!actor) {
    return NextResponse.json(
      { error: 'Remoção não autorizada.', code: 'UPLOAD_FORBIDDEN', requestId },
      { status: 403 },
    )
  }

  try {
    const body = await req.json() as {
      uploads?: Array<{ reference: { url: string; nome: string }; purpose: UploadPurpose }>
    }
    const uploads = Array.isArray(body.uploads) ? body.uploads.slice(0, 4) : []
    for (const upload of uploads) {
      const purpose = parsePurpose(upload.purpose)
      await validateUploadReference(upload.reference, purpose, actor.userId)
      await deleteUpload(upload.reference.url)
    }
    return NextResponse.json({ removed: uploads.length })
  } catch (error) {
    console.error('[upload.cleanup.request] falha:', { requestId, error })
    const response = uploadErrorResponse(error, requestId)
    return NextResponse.json(response.body, { status: response.status })
  }
}
