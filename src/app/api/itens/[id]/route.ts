import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import fs from 'fs/promises'
import path from 'path'
import crypto from 'crypto'

async function saveImage(file: File): Promise<{ url?: string; nome?: string; error?: string }> {
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Imagem muito grande. Máximo 5MB.' }
  }
  const ext = path.extname(file.name).toLowerCase()
  const extsPermitidas = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
  if (!extsPermitidas.includes(ext)) {
    return { error: `Extensão ${ext} não permitida. Aceitas: ${extsPermitidas.join(', ')}` }
  }
  const hash = crypto.randomBytes(8).toString('hex')
  const nomeArquivo = `${Date.now()}-${hash}${ext}`
  const caminhoAbs = path.join(process.cwd(), 'public', 'uploads', 'itens', nomeArquivo)
  const buffer = Buffer.from(await file.arrayBuffer())
  await fs.writeFile(caminhoAbs, buffer)
  return { url: `/uploads/itens/${nomeArquivo}`, nome: file.name }
}

// PUT /api/itens/[id] — editar item (multipart com imagem OU JSON)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    const contentType = req.headers.get('content-type') || ''

    let descricao: string | undefined
    let unidade: string | undefined
    let ativo: boolean | undefined
    let categoriaId: string | undefined
    let postos: string[] | undefined
    let removerImagem = false
    let imagemUrl: string | null | undefined = undefined
    let imagemNome: string | null | undefined = undefined

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      if (formData.has('descricao')) descricao = String(formData.get('descricao')).trim()
      if (formData.has('unidade')) unidade = String(formData.get('unidade') || '1')
      if (formData.has('ativo')) ativo = formData.get('ativo') === 'true'
      if (formData.has('categoriaId')) categoriaId = String(formData.get('categoriaId'))
      const postosStr = formData.get('postos') as string | null
      postos = postosStr ? JSON.parse(postosStr) : undefined
      if (formData.has('removerImagem')) removerImagem = formData.get('removerImagem') === 'true'

      const file = formData.get('imagem') as File | null
      if (file && file.size > 0) {
        const result = await saveImage(file)
        if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
        imagemUrl = result.url
        imagemNome = result.nome
      }
    } else {
      const body = await req.json()
      if (body.descricao !== undefined) descricao = String(body.descricao).trim()
      if (body.unidade !== undefined) unidade = String(body.unidade)
      if (body.ativo !== undefined) ativo = !!body.ativo
      if (body.categoriaId !== undefined) categoriaId = body.categoriaId
      if (Array.isArray(body.postos)) postos = body.postos
      if (body.removerImagem) removerImagem = true
    }

    const update: any = {}
    if (descricao !== undefined) {
      if (descricao.length < 3) {
        return NextResponse.json({ error: 'Descrição deve ter ao menos 3 caracteres' }, { status: 400 })
      }
      update.descricao = descricao
    }
    if (unidade !== undefined) update.unidade = unidade.replace(/\D/g, '') || '1'
    if (ativo !== undefined) update.ativo = ativo
    if (categoriaId !== undefined) update.categoriaId = categoriaId
    if (imagemUrl !== undefined) {
      update.imagemUrl = imagemUrl
      update.imagemNome = imagemNome
    } else if (removerImagem) {
      update.imagemUrl = null
      update.imagemNome = null
    }

    await db.item.update({ where: { id }, data: update })

    if (postos !== undefined) {
      await db.itemPosto.deleteMany({ where: { itemId: id } })
      if (postos.length > 0) {
        const uniquePostos = Array.from(new Set(postos))
        await db.itemPosto.createMany({
          data: uniquePostos.map((postoId: string) => ({
            itemId: id,
            postoId,
            quantidadeEsperada: 1,
            obrigatorio: true,
          })),
        })
      }
    }

    const final = await db.item.findUnique({
      where: { id },
      include: { categoria: true, postos: { include: { posto: true } } },
    })
    return NextResponse.json(final)
  } catch (err: any) {
    console.error('[PUT /api/itens/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao atualizar item' }, { status: 500 })
  }
}

// DELETE — desativar item
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params
    await db.item.update({ where: { id }, data: { ativo: false } })
    return NextResponse.json({ message: 'Item desativado' })
  } catch (err: any) {
    console.error('[DELETE /api/itens/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao desativar item' }, { status: 500 })
  }
}
