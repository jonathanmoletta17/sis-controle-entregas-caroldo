import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'

// GET /api/itens/matriz — grade de configuração item × posto (metas por posto)
export async function GET() {
  const [postos, itens] = await Promise.all([
    db.posto.findMany({
      select: { id: true, nome: true, corCapacete: true },
      orderBy: { nome: 'asc' },
    }),
    db.item.findMany({
      where: { ativo: true },
      select: {
        id: true,
        descricao: true,
        unidade: true,
        categoria: { select: { id: true, nome: true } },
        postos: { select: { postoId: true, quantidadeEsperada: true, obrigatorio: true } },
      },
      orderBy: [{ categoria: { nome: 'asc' } }, { descricao: 'asc' }],
    }),
  ])

  const itensGrade = itens.map(i => {
    const vinculos: Record<string, { quantidadeEsperada: number; obrigatorio: boolean }> = {}
    for (const ip of i.postos) {
      vinculos[ip.postoId] = { quantidadeEsperada: ip.quantidadeEsperada, obrigatorio: ip.obrigatorio }
    }
    return {
      id: i.id,
      descricao: i.descricao,
      unidade: i.unidade,
      categoria: i.categoria,
      vinculos,
    }
  })

  return NextResponse.json({ postos, itens: itensGrade })
}

// PUT /api/itens/matriz — grava em massa as metas por posto
// Body: { itemIds: string[], vinculos: [{ itemId, postoId, quantidadeEsperada, obrigatorio }] }
// Substitui integralmente os vínculos dos itemIds informados (célula vazia = sem vínculo).
export async function PUT(req: NextRequest) {
  return withAuditContext(req, async ({ userId, ip }) => {
    try {
      const body = await req.json()
      const itemIds: string[] = Array.isArray(body.itemIds) ? body.itemIds.filter((x: unknown) => typeof x === 'string') : []
      const vinculosRaw: unknown[] = Array.isArray(body.vinculos) ? body.vinculos : []

      if (itemIds.length === 0) {
        return NextResponse.json({ error: 'Nenhum item informado' }, { status: 400 })
      }

      const itemIdSet = new Set(itemIds)
      const vinculos = vinculosRaw
        .map((v) => {
          const o = v as Record<string, unknown>
          const itemId = typeof o.itemId === 'string' ? o.itemId : undefined
          const postoId = typeof o.postoId === 'string' ? o.postoId : undefined
          const q = Number(o.quantidadeEsperada)
          const quantidadeEsperada = Number.isFinite(q) && q >= 1 ? Math.floor(q) : 1
          const obrigatorio = o.obrigatorio !== undefined ? !!o.obrigatorio : true
          return { itemId, postoId, quantidadeEsperada, obrigatorio }
        })
        .filter((v): v is { itemId: string; postoId: string; quantidadeEsperada: number; obrigatorio: boolean } =>
          !!v.itemId && !!v.postoId && itemIdSet.has(v.itemId)
        )

      await db.$transaction([
        db.itemPosto.deleteMany({ where: { itemId: { in: itemIds } } }),
        ...(vinculos.length > 0
          ? [db.itemPosto.createMany({ data: vinculos })]
          : []),
      ])

      await logAudit({
        userId,
        ip,
        acao: 'UPDATE',
        tabela: 'ItemPosto',
        registroId: 'matriz',
        valoresNovos: { itemIds, vinculos },
      })

      return NextResponse.json({ message: 'Metas atualizadas', total: vinculos.length })
    } catch (err: any) {
      console.error('[PUT /api/itens/matriz] error:', err)
      return NextResponse.json({ error: err.message || 'Erro ao salvar metas' }, { status: 500 })
    }
  })
}
