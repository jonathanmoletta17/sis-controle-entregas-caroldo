import { put } from '@vercel/blob'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

// Salva um arquivo enviado pelo usuário.
// Em produção (BLOB_READ_WRITE_TOKEN definido) usa Vercel Blob — /public é read-only após o build.
// Em desenvolvimento local, grava em public/uploads/<pasta>/ para não depender de conta externa.
export async function saveUpload(
  file: File,
  pasta: 'itens' | 'anexos' | 'entregas-fotos'
): Promise<{ url: string; nome: string }> {
  const ext = path.extname(file.name).toLowerCase()
  const hash = crypto.randomBytes(8).toString('hex')
  const nomeArquivo = `${Date.now()}-${hash}${ext}`
  const buffer = Buffer.from(await file.arrayBuffer())

  if (process.env.BLOB_READ_WRITE_TOKEN) {
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
