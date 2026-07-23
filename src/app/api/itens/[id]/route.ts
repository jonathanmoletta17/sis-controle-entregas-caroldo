import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { saveUpload, rejeitarSeGrandeDemais } from '@/lib/storage'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'
import { normalizarPostos, type PostoConfig } from '@/lib/item-postos'
import { normalizarUnidade } from '@/lib/unidades'
import { cleanupUploads, deleteUpload, validateUploadReference } from '@/lib/upload-server'
import {
  UploadValidationError,
  type UploadReference,
  uploadErrorResponse,
  validateFileMetadata,
} from '@/lib/uploads'

const MAX_LEGACY_REQUEST_BYTES = 4 * 1024 * 1024

async function saveImage(file: File, userId: string): Promise<{ url?: string; nome?: string; error?: string }> {
  try {
    validateFileMetadata(file, 'item-image')
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Imagem inválida.' }
  }
  const { url, nome } = await saveUpload(file, 'itens', userId)
  return { url, nome }
}

// PUT /api/itens/[id] — editar item (multipart com imagem OU JSON)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuditContext(req, async ({ userId, ip }) => {
  const requestId = crypto.randomUUID()
  let novaImagem: UploadReference | null = null
  try {
    if (!userId) return NextResponse.json({ error: 'Usuário não identificado.', code: 'USER_REQUIRED', requestId }, { status: 403 })
    const { id } = await ctx.params
    const antes = await db.item.findUnique({ where: { id }, include: { categoria: true, postos: { include: { posto: true } } } })
    if (!antes) return NextResponse.json({ error: 'Item não encontrado.', code: 'ITEM_NOT_FOUND', requestId }, { status: 404 })
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const rejeitado = rejeitarSeGrandeDemais(req, MAX_LEGACY_REQUEST_BYTES)
      if (rejeitado) return rejeitado
    }

    let descricao: string | undefined
    let unidade: string | undefined
    let ativo: boolean | undefined
    let categoriaId: string | undefined
    let postos: PostoConfig[] | undefined
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
      postos = postosStr ? normalizarPostos(JSON.parse(postosStr)) : undefined
      if (formData.has('removerImagem')) removerImagem = formData.get('removerImagem') === 'true'

      const file = formData.get('imagem') as File | null
      if (file && file.size > 0) {
        const result = await saveImage(file, userId)
        if (result.error) return NextResponse.json({ error: result.error }, { status: 400 })
        imagemUrl = result.url
        imagemNome = result.nome
        novaImagem = { url: result.url!, nome: result.nome! }
      }
    } else {
      const body = await req.json()
      if (body.descricao !== undefined) descricao = String(body.descricao).trim()
      if (body.unidade !== undefined) unidade = String(body.unidade)
      if (body.ativo !== undefined) ativo = !!body.ativo
      if (body.categoriaId !== undefined) categoriaId = body.categoriaId
      if (Array.isArray(body.postos)) postos = normalizarPostos(body.postos)
      if (body.removerImagem) removerImagem = true
      novaImagem = body.imagem || null
    }

    const update: any = {}
    if (descricao !== undefined) {
      if (descricao.length < 3) {
        await cleanupUploads([novaImagem])
        novaImagem = null
        return NextResponse.json({ error: 'Descrição deve ter ao menos 3 caracteres' }, { status: 400 })
      }
      update.descricao = descricao
    }
    if (unidade !== undefined) update.unidade = normalizarUnidade(unidade)
    if (ativo !== undefined) update.ativo = ativo
    if (categoriaId !== undefined) update.categoriaId = categoriaId
    if (novaImagem) {
      await validateUploadReference(novaImagem, 'item-image', userId)
      imagemUrl = novaImagem.url
      imagemNome = novaImagem.nome
    }
    if (imagemUrl !== undefined) {
      update.imagemUrl = imagemUrl
      update.imagemNome = imagemNome
    } else if (removerImagem) {
      update.imagemUrl = null
      update.imagemNome = null
    }

    update.atualizadoPorId = userId
    const final = await db.$transaction(async tx => {
      await tx.item.update({ where: { id }, data: update })
      if (postos !== undefined) {
        await tx.itemPosto.deleteMany({ where: { itemId: id } })
        if (postos.length > 0) {
          await tx.itemPosto.createMany({
            data: postos.map(p => ({
              itemId: id,
              postoId: p.postoId,
              quantidadeEsperada: p.quantidadeEsperada,
              obrigatorio: p.obrigatorio,
            })),
          })
        }
      }
      return tx.item.findUnique({
        where: { id },
        include: {
          categoria: true,
          postos: { include: { posto: true } },
          criadoPor: { select: { nome: true } },
          atualizadoPor: { select: { nome: true } },
        },
      })
    })
    await logAudit({ userId, ip, acao: 'UPDATE', tabela: 'Item', registroId: id, valoresAntigos: antes, valoresNovos: final })
    if ((novaImagem || removerImagem) && antes.imagemUrl && antes.imagemUrl !== novaImagem?.url) {
      await deleteUpload(antes.imagemUrl)
    }
    return NextResponse.json(final)
  } catch (err: any) {
    await cleanupUploads([novaImagem])
    console.error('[PUT /api/itens/[id]] error:', { requestId, code: err?.code, error: err })
    if (err instanceof UploadValidationError) {
      const response = uploadErrorResponse(err, requestId)
      return NextResponse.json(response.body, { status: response.status })
    }
    return NextResponse.json(
      { error: 'Erro ao atualizar item. Tente novamente.', code: 'ITEM_UPDATE_FAILED', requestId },
      { status: 500 },
    )
  }
  })
}

// DELETE /api/itens/[id] — exclui de verdade (com proteção) ou desativa
//   ?modo=desativar        → soft-delete (marca ativo=false), preserva histórico
//   (padrão, exclusão real)→ apaga se não houver entregas; se houver, retorna 409
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuditContext(req, async ({ userId, ip }) => {
  try {
    const { id } = await ctx.params
    const { searchParams } = new URL(req.url)
    const modo = searchParams.get('modo')

    const antes = await db.item.findUnique({
      where: { id },
      include: { _count: { select: { entregas: true } } },
    })
    if (!antes) {
      return NextResponse.json({ error: 'Item não encontrado' }, { status: 404 })
    }

    // Desativar explicitamente (fallback quando não pode excluir)
    if (modo === 'desativar') {
      const item = await db.item.update({ where: { id }, data: { ativo: false, atualizadoPorId: userId } })
      await logAudit({ userId, ip, acao: 'UPDATE', tabela: 'Item', registroId: item.id, valoresAntigos: antes, valoresNovos: item })
      return NextResponse.json({ message: 'Item desativado' })
    }

    // Exclusão real — bloquear se houver entregas registradas
    const totalEntregas = antes._count.entregas
    if (totalEntregas > 0) {
      return NextResponse.json(
        {
          error: `Este item possui ${totalEntregas} ${totalEntregas === 1 ? 'entrega registrada' : 'entregas registradas'} e não pode ser excluído. Você pode desativá-lo para preservar o histórico.`,
          code: 'HAS_ENTREGAS',
          totalEntregas,
        },
        { status: 409 }
      )
    }

    // Sem entregas — remover vínculos de posto e apagar o item
    await db.$transaction([
      db.itemPosto.deleteMany({ where: { itemId: id } }),
      db.item.delete({ where: { id } }),
    ])
    await logAudit({ userId, ip, acao: 'DELETE', tabela: 'Item', registroId: id, valoresAntigos: antes })
    await deleteUpload(antes.imagemUrl)
    return NextResponse.json({ message: 'Item excluído' })
  } catch (err: any) {
    console.error('[DELETE /api/itens/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao excluir item' }, { status: 500 })
  }
  })
}
