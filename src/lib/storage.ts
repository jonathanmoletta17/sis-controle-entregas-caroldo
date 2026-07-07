import { put } from '@vercel/blob'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'

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
  const buffer = Buffer.from(await file.arrayBuffer())

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
