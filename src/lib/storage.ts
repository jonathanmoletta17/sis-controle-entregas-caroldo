import { put } from '@vercel/blob'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import sharp from 'sharp'
import { NextRequest, NextResponse } from 'next/server'

// Pastas cujo conteúdo é sempre imagem exibida como miniatura/preview (catálogo
// de itens, foto de confirmação de entrega) — redimensionamos para não guardar
// nem servir fotos de câmera/celular em resolução original só para mostrar um
// quadrado de 40-64px na tela. 'anexos' fica de fora porque pode ser PDF/DOC e,
// quando é imagem (documento escaneado), queremos preservar legibilidade.
const PASTAS_REDIMENSIONAVEIS = new Set(['itens', 'entregas-fotos'])
const LADO_MAXIMO_PX = 800
const QUALIDADE_JPEG_WEBP = 82

async function redimensionarSeImagem(buffer: Buffer, mimeType: string): Promise<Buffer> {
  if (!mimeType.startsWith('image/')) return buffer
  try {
    const imagem = sharp(buffer).rotate() // aplica orientação EXIF antes de medir/redimensionar
    const metadata = await imagem.metadata()
    if ((metadata.width ?? 0) <= LADO_MAXIMO_PX && (metadata.height ?? 0) <= LADO_MAXIMO_PX) {
      return buffer // já é pequena, não reprocessa (evita perda de qualidade à toa)
    }
    const redimensionada = imagem.resize({
      width: LADO_MAXIMO_PX,
      height: LADO_MAXIMO_PX,
      fit: 'inside',
      withoutEnlargement: true,
    })
    if (metadata.format === 'png') return await redimensionada.png({ compressionLevel: 8 }).toBuffer()
    if (metadata.format === 'webp') return await redimensionada.webp({ quality: QUALIDADE_JPEG_WEBP }).toBuffer()
    if (metadata.format === 'gif') return buffer // evita perder animação; gif de item costuma já ser pequeno
    return await redimensionada.jpeg({ quality: QUALIDADE_JPEG_WEBP }).toBuffer()
  } catch {
    // Se o sharp não conseguir processar (arquivo corrompido, formato exótico),
    // não bloqueia o upload — segue com o arquivo original.
    return buffer
  }
}

// Rejeita requisições grandes demais ANTES de req.formData() ler o corpo inteiro
// para memória. Sem essa checagem via Content-Length, um upload muito grande é
// integralmente bufferizado (multipart + arrayBuffer) antes de qualquer validação
// de tamanho por arquivo — o que pode estourar a memória do processo em um servidor
// com poucos recursos, mesmo que o arquivo depois seja rejeitado pelo limite por campo.
export function rejeitarSeGrandeDemais(req: NextRequest, maxBytes: number): NextResponse | null {
  const contentLength = Number(req.headers.get('content-length') || '0')
  if (contentLength > maxBytes) {
    const maxMb = (maxBytes / (1024 * 1024)).toFixed(0)
    return NextResponse.json(
      { error: `Requisição muito grande. Máximo permitido: ${maxMb}MB.` },
      { status: 413 }
    )
  }
  return null
}

// Salva um arquivo enviado pelo usuário.
// Na Vercel (process.env.VERCEL sempre definido pela plataforma) usa Vercel Blob —
// /public é read-only em runtime serverless. A autenticação do Blob é resolvida
// internamente pelo SDK (token clássico ou OIDC, dependendo de como a store foi
// conectada) — não dependemos do nome exato de nenhuma env var específica do Blob.
// Em desenvolvimento local (sem BLOB_READ_WRITE_TOKEN setado manualmente), grava em
// public/uploads/<pasta>/ para não depender de conta externa.
export async function saveUpload(
  file: File,
  pasta: 'itens' | 'anexos' | 'entregas-fotos'
): Promise<{ url: string; nome: string }> {
  const ext = path.extname(file.name).toLowerCase()
  const hash = crypto.randomBytes(8).toString('hex')
  const nomeArquivo = `${Date.now()}-${hash}${ext}`
  let buffer: Buffer = Buffer.from(await file.arrayBuffer())

  if (PASTAS_REDIMENSIONAVEIS.has(pasta)) {
    buffer = Buffer.from(await redimensionarSeImagem(buffer, file.type || ''))
  }

  const usarBlob = !!process.env.VERCEL || !!process.env.BLOB_READ_WRITE_TOKEN
  if (usarBlob) {
    const blob = await put(`${pasta}/${nomeArquivo}`, buffer, {
      access: 'public',
      contentType: file.type || undefined,
    })
    return { url: blob.url, nome: file.name }
  }

  const caminhoAbs = path.join(process.cwd(), 'public', 'uploads', pasta, nomeArquivo)
  await fs.writeFile(caminhoAbs, buffer)
  return { url: `/uploads/${pasta}/${nomeArquivo}`, nome: file.name }
}
