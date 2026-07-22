import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import path from 'path'
import { saveUpload, rejeitarSeGrandeDemais } from '@/lib/storage'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'
import { normalizarPostos, type PostoConfig } from '@/lib/item-postos'
import { normalizarUnidade } from '@/lib/unidades'

const MAX_REQUEST_BYTES = 8 * 1024 * 1024 // 5MB de imagem + folga para overhead do multipart

async function saveImage(file: File): Promise<{ url?: string; nome?: string; error?: string }> {
  if (file.size > 5 * 1024 * 1024) {
    return { error: 'Imagem muito grande. Máximo 5MB.' }
  }
  const ext = path.extname(file.name).toLowerCase()
  const extsPermitidas = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
  if (!extsPermitidas.includes(ext)) {
    return { error: `Extensão ${ext} não permitida. Aceitas: ${extsPermitidas.join(', ')}` }
  }
  const { url, nome } = await saveUpload(file, 'itens')
  return { url, nome }
}

// PUT /api/itens/[id] — editar item (multipart com imagem OU JSON)
export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuditContext(req, async ({ userId, ip }) => {
  try {
    const { id } = await ctx.params
    const antes = await db.item.findUnique({ where: { id }, include: { categoria: true, postos: { include: { posto: true } } } })
    const contentType = req.headers.get('content-type') || ''
    if (contentType.includes('multipart/form-data')) {
      const rejeitado = rejeitarSeGrandeDemais(req, MAX_REQUEST_BYTES)
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
      if (Array.isArray(body.postos)) postos = normalizarPostos(body.postos)
      if (body.removerImagem) removerImagem = true
    }

    const update: any = {}
    if (descricao !== undefined) {
      if (descricao.length < 3) {
        return NextResponse.json({ error: 'Descrição deve ter ao menos 3 caracteres' }, { status: 400 })
      }
      update.descricao = descricao
    }
    if (unidade !== undefined) update.unidade = normalizarUnidade(unidade)
    if (ativo !== undefined) update.ativo = ativo
    if (categoriaId !== undefined) update.categoriaId = categoriaId
    if (imagemUrl !== undefined) {
      update.imagemUrl = imagemUrl
      update.imagemNome = imagemNome
    } else if (removerImagem) {
      update.imagemUrl = null
      update.imagemNome = null
    }

    update.atualizadoPorId = userId
    await db.item.update({ where: { id }, data: update })

    if (postos !== undefined) {
      await db.itemPosto.deleteMany({ where: { itemId: id } })
      if (postos.length > 0) {
        await db.itemPosto.createMany({
          data: postos.map(p => ({
            itemId: id,
            postoId: p.postoId,
            quantidadeEsperada: p.quantidadeEsperada,
            obrigatorio: p.obrigatorio,
          })),
        })
      }
    }

    const final = await db.item.findUnique({
      where: { id },
      include: {
        categoria: true,
        postos: { include: { posto: true } },
        criadoPor: { select: { nome: true } },
        atualizadoPor: { select: { nome: true } },
      },
    })
    await logAudit({ userId, ip, acao: 'UPDATE', tabela: 'Item', registroId: id, valoresAntigos: antes, valoresNovos: final })
    return NextResponse.json(final)
  } catch (err: any) {
    console.error('[PUT /api/itens/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao atualizar item' }, { status: 500 })
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
    return NextResponse.json({ message: 'Item excluído' })
  } catch (err: any) {
    console.error('[DELETE /api/itens/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao excluir item' }, { status: 500 })
  }
  })
}
