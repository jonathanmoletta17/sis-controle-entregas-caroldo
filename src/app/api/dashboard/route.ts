import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/dashboard — KPIs principais
export async function GET(_req: NextRequest) {
  try {
    const [totalColabs, ativos, desligados, totalEntregas, totalItens, totalPostos, entregasRecentes] = await Promise.all([
      db.colaborador.count(),
      db.colaborador.count({ where: { ativo: true } }),
      db.colaborador.count({ where: { ativo: false } }),
      db.entrega.count(),
      db.item.count(),
      db.posto.count(),
      db.entrega.findMany({
        take: 10,
        orderBy: { dataEntrega: 'desc' },
        include: {
          colaborador: { select: { id: true, nomeCompleto: true, cpf: true, posto: { select: { nome: true } } } },
          item: { select: { id: true, descricao: true, categoria: { select: { nome: true } } } },
        },
      }),
    ])

    // Pendências por posto: para cada posto, contar itens esperados (itemPosto) e verificar
    // quais colaboradores daquele posto NÃO receberam cada item
    const postos = await db.posto.findMany({
      include: {
        colaboradores: { where: { ativo: true }, select: { id: true } },
        itensPosto: { include: { item: { select: { id: true, descricao: true } } } },
      },
    })

    const pendenciasPorPosto = await Promise.all(
      postos.map(async (p) => {
        const colaboradoresAtivos = p.colaboradores.length
        const itensEsperados = p.itensPosto.length
        // total esperado = itens × colaboradores ativos
        const totalEsperado = itensEsperados * colaboradoresAtivos

        // total entregue: contar Entregas onde item pertence a este posto (via ItemPosto)
        // e colaborador está neste posto
        // Para simplicidade no MVP, contar entregas para colaboradores deste posto
        const entregasParaColaboradoresDoPosto = await db.entrega.count({
          where: { colaborador: { postoId: p.id, ativo: true } },
        })

        const pendentes = Math.max(0, totalEsperado - entregasParaColaboradoresDoPosto)
        return {
          postoId: p.id,
          postoNome: p.nome,
          corCapacete: p.corCapacete,
          colaboradoresAtivos,
          itensEsperados,
          totalEsperado,
          totalEntregue: entregasParaColaboradoresDoPosto,
          pendentes,
          percentual: totalEsperado > 0 ? Math.round((entregasParaColaboradoresDoPosto / totalEsperado) * 100) : 0,
        }
      })
    )

    return NextResponse.json({
      kpis: {
        totalColabs,
        ativos,
        desligados,
        totalEntregas,
        totalItens,
        totalPostos,
      },
      pendenciasPorPosto,
      entregasRecentes,
    })
  } catch (err: any) {
    console.error('[GET /api/dashboard] error:', err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
