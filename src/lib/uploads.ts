export type UploadPurpose = 'item-image' | 'delivery-photo' | 'delivery-attachment'

export interface UploadReference {
  url: string
  nome: string
}

export const UPLOAD_CONFIG: Record<UploadPurpose, {
  folder: 'itens' | 'entregas-fotos' | 'anexos'
  maxBytes: number
  allowedExtensions: string[]
  allowedContentTypes: string[]
}> = {
  'item-image': {
    folder: 'itens',
    maxBytes: 5 * 1024 * 1024,
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  'delivery-photo': {
    folder: 'entregas-fotos',
    maxBytes: 5 * 1024 * 1024,
    allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp', '.gif'],
    allowedContentTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
  },
  'delivery-attachment': {
    folder: 'anexos',
    maxBytes: 10 * 1024 * 1024,
    allowedExtensions: ['.pdf', '.jpg', '.jpeg', '.png', '.webp', '.gif', '.doc', '.docx'],
    allowedContentTypes: [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/webp',
      'image/gif',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
  },
}

export class UploadValidationError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 400,
  ) {
    super(message)
    this.name = 'UploadValidationError'
  }
}

export function extensionOf(fileName: string): string {
  const dot = fileName.lastIndexOf('.')
  return dot >= 0 ? fileName.slice(dot).toLowerCase() : ''
}

export function contentTypeFor(file: Pick<File, 'name' | 'type'>): string {
  if (file.type) {
    const normalized = file.type.toLowerCase()
    if (normalized === 'image/jpg' || normalized === 'image/pjpeg') return 'image/jpeg'
    return normalized
  }
  const extension = extensionOf(file.name)
  const byExtension: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.webp': 'image/webp',
    '.gif': 'image/gif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
  return byExtension[extension] || 'application/octet-stream'
}

export function validateFileMetadata(
  file: Pick<File, 'name' | 'size' | 'type'>,
  purpose: UploadPurpose,
): void {
  const config = UPLOAD_CONFIG[purpose]
  const extension = extensionOf(file.name)
  const contentType = contentTypeFor(file)

  if (!config.allowedExtensions.includes(extension)) {
    throw new UploadValidationError(
      'UNSUPPORTED_EXTENSION',
      `Formato não permitido. Use ${config.allowedExtensions.join(', ')}.`,
    )
  }
  if (!config.allowedContentTypes.includes(contentType)) {
    throw new UploadValidationError(
      'UNSUPPORTED_CONTENT_TYPE',
      'O tipo real informado pelo arquivo não corresponde a um formato permitido.',
    )
  }
  if (file.size <= 0) {
    throw new UploadValidationError('EMPTY_FILE', 'O arquivo selecionado está vazio.')
  }
  if (file.size > config.maxBytes) {
    const maxMb = config.maxBytes / (1024 * 1024)
    throw new UploadValidationError('FILE_TOO_LARGE', `Arquivo muito grande. Máximo ${maxMb}MB.`)
  }
}

export function uploadErrorResponse(error: unknown, requestId: string) {
  if (error instanceof UploadValidationError) {
    return {
      body: { error: error.message, code: error.code, requestId },
      status: error.status,
    }
  }
  return {
    body: { error: 'Não foi possível processar o arquivo.', code: 'UPLOAD_FAILED', requestId },
    status: 500,
  }
}
