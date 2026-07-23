'use client'

import { upload } from '@vercel/blob/client'
import {
  contentTypeFor,
  extensionOf,
  UPLOAD_CONFIG,
  type UploadPurpose,
  type UploadReference,
  validateFileMetadata,
  validateFileType,
} from '@/lib/uploads'

interface UploadContext {
  directUpload: boolean
  userId: string
}

let uploadContextPromise: Promise<UploadContext> | null = null

async function getUploadContext(): Promise<UploadContext> {
  uploadContextPromise ??= fetch('/api/uploads', { cache: 'no-store' }).then(async response => {
    const body = await response.json().catch(() => ({}))
    if (!response.ok) throw new Error(body.error || 'Não foi possível preparar o upload.')
    return body as UploadContext
  })
  return uploadContextPromise
}

async function resizeImage(file: File, purpose: UploadPurpose): Promise<File> {
  if (purpose === 'delivery-attachment') return file
  // Câmeras/pickers móveis frequentemente entregam File.type vazio; inferimos o
  // tipo pela extensão para não pular o resize de uma foto grande só porque o MIME
  // veio em branco (era um bug: fotos cheias subiam sem redução).
  const effectiveType = file.type || contentTypeFor(file)
  if (effectiveType === 'image/gif') return file
  if (!effectiveType.startsWith('image/')) return file

  try {
    const bitmap = await createImageBitmap(file)
    const maxSide = 800
    if (bitmap.width <= maxSide && bitmap.height <= maxSide) {
      bitmap.close()
      return file
    }

    const scale = Math.min(maxSide / bitmap.width, maxSide / bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) {
      bitmap.close()
      return file
    }
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    bitmap.close()

    const targetType = effectiveType === 'image/png' ? 'image/png' : effectiveType === 'image/webp' ? 'image/webp' : 'image/jpeg'
    const blob = await new Promise<Blob | null>(resolve =>
      canvas.toBlob(resolve, targetType, targetType === 'image/png' ? undefined : 0.82),
    )
    if (!blob || blob.size >= file.size) return file

    const targetExtension = targetType === 'image/png' ? '.png' : targetType === 'image/webp' ? '.webp' : '.jpg'
    const baseName = file.name.replace(/\.[^.]+$/, '')
    return new File([blob], `${baseName}${targetExtension}`, { type: targetType, lastModified: file.lastModified })
  } catch {
    return file
  }
}

function normalizedFile(file: File): File {
  const contentType = contentTypeFor(file)
  return file.type === contentType
    ? file
    : new File([file], file.name, { type: contentType, lastModified: file.lastModified })
}

export async function uploadUserFile(
  originalFile: File,
  purpose: UploadPurpose,
  onProgress?: (percentage: number) => void,
): Promise<UploadReference> {
  // Valida formato e o teto bruto no arquivo original; o limite final de tamanho é
  // aplicado só depois do resize (uma foto de celular de 8MB vira <200KB e passa).
  validateFileType(originalFile, purpose)
  const processed = normalizedFile(await resizeImage(originalFile, purpose))
  validateFileMetadata(processed, purpose)

  const context = await getUploadContext()
  const config = UPLOAD_CONFIG[purpose]
  const pathname = `${config.folder}/${context.userId}/${crypto.randomUUID()}${extensionOf(processed.name)}`

  if (context.directUpload) {
    const blob = await upload(pathname, processed, {
      access: 'public',
      handleUploadUrl: '/api/uploads',
      clientPayload: JSON.stringify({ purpose }),
      contentType: processed.type,
      multipart: processed.size > 4 * 1024 * 1024,
      onUploadProgress: progress => onProgress?.(Math.round(progress.percentage)),
    })
    return { url: blob.url, nome: originalFile.name }
  }

  const formData = new FormData()
  formData.append('purpose', purpose)
  formData.append('file', processed)
  const response = await fetch('/api/uploads', { method: 'POST', body: formData })
  const body = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(body.error || 'Não foi possível enviar o arquivo.')
  onProgress?.(100)
  return { url: body.url, nome: originalFile.name }
}

export async function cleanupUserUploads(
  uploads: Array<{ reference: UploadReference; purpose: UploadPurpose }>,
): Promise<void> {
  if (uploads.length === 0) return
  await fetch('/api/uploads', {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ uploads }),
  }).catch(() => undefined)
}
