import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import path from 'path'
import { saveUpload } from '@/lib/storage'

// POST /api/entregas — registrar nova entrega com anexo (multipart/form-data)
// Ou application/json (sem anexo)
export async function POST(req: NextRequest) {
  try {
    const contentType = req.headers.get('content-type') || ''

    let colaboradorId: string
    let itemId: string
    let dataEntrega: string
    let quantidade: number = 1
    let observacao: string | null = null
    let anexoUrl: string | null = null
    let anexoNome: string | null = null
    let fotoUrl: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      colaboradorId = String(formData.get('colaboradorId') || '')
      itemId = String(formData.get('itemId') || '')
      dataEntrega = String(formData.get('dataEntrega') || '')
      quantidade = parseInt(String(formData.get('quantidade') || '1'), 10) || 1
      observacao = (formData.get('observacao') as string) || null

      const file = formData.get('anexo') as File | null
      if (file && file.size > 0) {
        // Validar tamanho (máx 10MB)
        if (file.size > 10 * 1024 * 1024) {
          return NextResponse.json({ error: 'Arquivo muito grande. Máximo 10MB.' }, { status: 400 })
        }

        // Validar extensão
        const ext = path.extname(file.name).toLowerCase()
        const extsPermitidas = ['.pdf', '.jpg', '.jpeg', '.png', '.gif', '.webp', '.doc', '.docx']
        if (!extsPermitidas.includes(ext)) {
          return NextResponse.json({ error: `Extensão ${ext} não permitida. Aceitas: ${extsPermitidas.join(', ')}` }, { status: 400 })
        }

        const { url, nome } = await saveUpload(file, 'anexos')
        anexoUrl = url
        anexoNome = nome
      }

      const foto = formData.get('foto') as File | null
      if (foto && foto.size > 0) {
        if (foto.size > 5 * 1024 * 1024) {
          return NextResponse.json({ error: 'Foto muito grande. Máximo 5MB.' }, { status: 400 })
        }
        const ext = path.extname(foto.name).toLowerCase()
        const extsPermitidas = ['.jpg', '.jpeg', '.png', '.webp', '.gif']
        if (!extsPermitidas.includes(ext)) {
          return NextResponse.json({ error: `Extensão ${ext} não permitida para foto. Aceitas: ${extsPermitidas.join(', ')}` }, { status: 400 })
        }
        const { url } = await saveUpload(foto, 'entregas-fotos')
        fotoUrl = url
      }
    } else {
      // JSON sem anexo
      const body = await req.json()
      colaboradorId = body.colaboradorId
      itemId = body.itemId
      dataEntrega = body.dataEntrega
      quantidade = body.quantidade || 1
      observacao = body.observacao || null
    }

    if (!colaboradorId) {
      return NextResponse.json({ error: 'Colaborador é obrigatório' }, { status: 400 })
    }
    if (!itemId) {
      return NextResponse.json({ error: 'Item é obrigatório' }, { status: 400 })
    }
    if (!dataEntrega) {
      return NextResponse.json({ error: 'Data de entrega é obrigatória' }, { status: 400 })
    }

    // Verificar se colaborador está ativo
    const colab = await db.colaborador.findUnique({ where: { id: colaboradorId } })
    if (!colab) return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })
    if (!colab.ativo) {
      return NextResponse.json({ error: 'Não é possível registrar entrega para colaborador desligado. Reative o cadastro antes.' }, { status: 400 })
    }

    const entrega = await db.entrega.create({
      data: {
        colaboradorId,
        itemId,
        dataEntrega: new Date(dataEntrega),
        quantidade,
        observacao,
        anexoUrl,
        anexoNome,
        fotoUrl,
      },
      include: {
        colaborador: { select: { id: true, nomeCompleto: true, cpf: true, posto: true } },
        item: { select: { id: true, descricao: true, categoria: true } },
      },
    })

    return NextResponse.json(entrega, { status: 201 })
  } catch (err: any) {
    console.error('[POST /api/entregas] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao registrar entrega' }, { status: 500 })
  }
}

// GET /api/entregas?colaboradorId=...&itemId=...&postoId=...
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const colaboradorId = searchParams.get('colaboradorId')
  const itemId = searchParams.get('itemId')
  const postoId = searchParams.get('postoId')
  const limit = parseInt(searchParams.get('limit') || '100', 10)

  const where: any = {}
  if (colaboradorId) where.colaboradorId = colaboradorId
  if (itemId) where.itemId = itemId
  if (postoId) where.colaborador = { postoId }

  const entregas = await db.entrega.findMany({
    where,
    take: limit,
    orderBy: { dataEntrega: 'desc' },
    include: {
      colaborador: { select: { id: true, nomeCompleto: true, cpf: true, posto: true } },
      item: { select: { id: true, descricao: true, unidade: true, categoria: true, imagemUrl: true, imagemNome: true } },
    },
  })

  return NextResponse.json(entregas)
}
