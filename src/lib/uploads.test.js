import { describe, expect, it } from 'bun:test'
import { hasValidFileSignature } from '@/lib/upload-server'
import {
  contentTypeFor,
  extensionOf,
  UploadValidationError,
  validateFileMetadata,
} from '@/lib/uploads'

function metadata(name, size, type) {
  return { name, size, type }
}

describe('contrato de uploads', () => {
  it('normaliza extensão e aliases MIME usados por câmeras', () => {
    expect(extensionOf('FOTO.JPEG')).toBe('.jpeg')
    expect(contentTypeFor(metadata('foto.jpg', 10, 'image/jpg'))).toBe('image/jpeg')
    expect(contentTypeFor(metadata('documento.docx', 10, ''))).toBe(
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    )
  })

  it('aceita imagens válidas exatamente até 5 MB', () => {
    expect(() => validateFileMetadata(metadata('foto.jpg', 5 * 1024 * 1024, 'image/jpeg'), 'delivery-photo')).not.toThrow()
  })

  it('rejeita imagem acima de 5 MB com código estável', () => {
    try {
      validateFileMetadata(metadata('foto.jpg', 5 * 1024 * 1024 + 1, 'image/jpeg'), 'delivery-photo')
      throw new Error('deveria rejeitar')
    } catch (error) {
      expect(error).toBeInstanceOf(UploadValidationError)
      expect(error.code).toBe('FILE_TOO_LARGE')
    }
  })

  it('aceita documento até 10 MB e rejeita extensão não permitida', () => {
    expect(() => validateFileMetadata(metadata('aso.pdf', 10 * 1024 * 1024, 'application/pdf'), 'delivery-attachment')).not.toThrow()
    expect(() => validateFileMetadata(metadata('script.exe', 100, 'application/octet-stream'), 'delivery-attachment')).toThrow()
  })

  it('não confia apenas na extensão quando o MIME diverge', () => {
    expect(() => validateFileMetadata(metadata('foto.jpg', 100, 'application/pdf'), 'item-image')).toThrow()
  })
})

describe('assinatura real dos arquivos', () => {
  it('reconhece JPEG, PNG, GIF e WEBP', () => {
    expect(hasValidFileSignature(Uint8Array.from([0xff, 0xd8, 0xff]), 'item-image', 'image/jpeg')).toBeTrue()
    expect(hasValidFileSignature(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), 'item-image', 'image/png')).toBeTrue()
    expect(hasValidFileSignature(new TextEncoder().encode('GIF89a'), 'delivery-photo', 'image/gif')).toBeTrue()
    expect(hasValidFileSignature(new TextEncoder().encode('RIFF1234WEBP'), 'delivery-photo', 'image/webp')).toBeTrue()
  })

  it('reconhece PDF, DOC e DOCX e rejeita conteúdo mascarado', () => {
    expect(hasValidFileSignature(new TextEncoder().encode('%PDF-1.7'), 'delivery-attachment', 'application/pdf')).toBeTrue()
    expect(hasValidFileSignature(Uint8Array.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), 'delivery-attachment', 'application/msword')).toBeTrue()
    expect(hasValidFileSignature(Uint8Array.from([0x50, 0x4b, 0x03, 0x04]), 'delivery-attachment', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')).toBeTrue()
    expect(hasValidFileSignature(new TextEncoder().encode('not-a-jpeg'), 'item-image', 'image/jpeg')).toBeFalse()
  })
})
