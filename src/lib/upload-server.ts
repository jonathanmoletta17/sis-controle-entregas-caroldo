import { del, head } from '@vercel/blob'
import fs from 'fs/promises'
import path from 'path'
import {
  contentTypeFor,
  UPLOAD_CONFIG,
  UploadValidationError,
  type UploadPurpose,
  type UploadReference,
} from '@/lib/uploads'

function isBlobUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('.blob.vercel-storage.com')
  } catch {
    return false
  }
}

function expectedPrefix(purpose: UploadPurpose, userId: string): string {
  return `${UPLOAD_CONFIG[purpose].folder}/${userId}/`
}

function localUploadPath(url: string): string {
  const match = url.match(/^\/uploads\/(itens|entregas-fotos|anexos)\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+\.[A-Za-z0-9]+)$/)
  if (!match) {
    throw new UploadValidationError('INVALID_UPLOAD_URL', 'A referência local do arquivo é inválida.')
  }
  return path.join(process.cwd(), 'public', 'uploads', match[1], match[2], match[3])
}

export function hasValidFileSignature(bytes: Uint8Array, purpose: UploadPurpose, contentType: string): boolean {
  const starts = (...values: number[]) => values.every((value, index) => bytes[index] === value)
  if (contentType === 'image/jpeg') return starts(0xff, 0xd8, 0xff)
  if (contentType === 'image/png') return starts(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)
  if (contentType === 'image/gif') return String.fromCharCode(...bytes.slice(0, 4)) === 'GIF8'
  if (contentType === 'image/webp') {
    return String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF'
      && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
  }
  if (purpose === 'delivery-attachment' && contentType === 'application/pdf') {
    return String.fromCharCode(...bytes.slice(0, 5)) === '%PDF-'
  }
  if (purpose === 'delivery-attachment' && contentType === 'application/msword') {
    return starts(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1)
  }
  if (
    purpose === 'delivery-attachment'
    && contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return starts(0x50, 0x4b, 0x03, 0x04)
  }
  return false
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

// Vercel Blob é consistente após a escrita para a URL retornada, mas logo depois do
// upload direto pode haver um curto atraso de propagação no CDN. Tentamos algumas
// vezes com backoff curto antes de desistir, para não bloquear um save legítimo por
// uma leitura prematura.
async function withRetry<T>(fn: () => Promise<T>, attempts = 3, baseDelayMs = 250): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error
      if (i < attempts - 1) await sleep(baseDelayMs * (i + 1))
    }
  }
  throw lastError
}

// Lê os primeiros bytes para conferir a assinatura real do arquivo. Em falha
// transitória de rede (não um "não encontrado" definitivo), retorna null para que o
// chamador NÃO bloqueie o save — o tipo já foi validado pelo metadata do head e
// restringido no token de upload. Só bloqueamos quando conseguimos ler bytes e eles
// não batem com o formato.
async function readPrefixSafe(reference: UploadReference): Promise<Uint8Array | null> {
  if (isBlobUrl(reference.url)) {
    try {
      return await withRetry(async () => {
        const response = await fetch(reference.url, { headers: { Range: 'bytes=0-15' }, cache: 'no-store' })
        if (!response.ok) throw new Error(`blob prefix fetch ${response.status}`)
        return new Uint8Array(await response.arrayBuffer())
      })
    } catch (error) {
      console.warn('[upload.validate] não foi possível ler prefixo do blob, seguindo sem checagem de assinatura:', {
        url: reference.url,
        error,
      })
      return null
    }
  }

  const absolute = localUploadPath(reference.url)
  const handle = await fs.open(absolute, 'r')
  try {
    const buffer = Buffer.alloc(16)
    const { bytesRead } = await handle.read(buffer, 0, 16, 0)
    return buffer.subarray(0, bytesRead)
  } finally {
    await handle.close()
  }
}

export async function validateUploadReference(
  reference: UploadReference,
  purpose: UploadPurpose,
  userId: string,
): Promise<void> {
  if (!reference?.url || !reference?.nome) {
    throw new UploadValidationError('INVALID_UPLOAD_REFERENCE', 'A referência do arquivo está incompleta.')
  }
  if (reference.nome.length > 255 || /[\u0000-\u001f\u007f]/.test(reference.nome)) {
    throw new UploadValidationError('INVALID_UPLOAD_NAME', 'O nome original do arquivo é inválido.')
  }

  const config = UPLOAD_CONFIG[purpose]
  let size: number
  let contentType: string
  let pathname: string

  if (isBlobUrl(reference.url)) {
    let metadata
    try {
      metadata = await withRetry(() => head(reference.url))
    } catch {
      throw new UploadValidationError('UPLOAD_NOT_FOUND', 'O arquivo enviado não foi encontrado.', 400)
    }
    size = metadata.size
    contentType = metadata.contentType.toLowerCase()
    pathname = metadata.pathname
  } else {
    const prefix = `/uploads/${expectedPrefix(purpose, userId)}`
    if (!reference.url.startsWith(prefix)) {
      throw new UploadValidationError('UPLOAD_OWNERSHIP_MISMATCH', 'O arquivo não pertence a esta operação.', 403)
    }
    const absolute = localUploadPath(reference.url)
    const stat = await fs.stat(absolute)
    size = stat.size
    contentType = contentTypeFor({ name: reference.url, type: '' } as File)
    pathname = reference.url.replace(/^\/uploads\//, '')
  }

  if (!pathname.startsWith(expectedPrefix(purpose, userId))) {
    throw new UploadValidationError('UPLOAD_OWNERSHIP_MISMATCH', 'O arquivo não pertence ao usuário atual.', 403)
  }
  if (size <= 0 || size > config.maxBytes) {
    throw new UploadValidationError('FILE_TOO_LARGE', 'O tamanho do arquivo enviado é inválido.')
  }
  if (!config.allowedContentTypes.includes(contentType)) {
    throw new UploadValidationError('UNSUPPORTED_CONTENT_TYPE', 'O tipo do arquivo enviado não é permitido.')
  }

  const prefix = await readPrefixSafe(reference)
  if (prefix && !hasValidFileSignature(prefix, purpose, contentType)) {
    throw new UploadValidationError(
      'INVALID_FILE_CONTENT',
      'O conteúdo do arquivo não corresponde ao formato informado. Selecione outro arquivo.',
    )
  }
}

export async function deleteUpload(url: string | null | undefined): Promise<void> {
  if (!url) return
  try {
    if (isBlobUrl(url)) {
      await del(url)
      return
    }
    if (url.startsWith('/uploads/')) {
      await fs.unlink(localUploadPath(url))
    }
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code
    if (code !== 'ENOENT') console.error('[upload.cleanup] falha ao remover arquivo:', { url, error })
  }
}

export async function cleanupUploads(references: Array<UploadReference | null | undefined>): Promise<void> {
  await Promise.allSettled(references.map(reference => deleteUpload(reference?.url)))
}
