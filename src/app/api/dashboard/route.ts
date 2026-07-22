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

    // Pendências por posto — ponderado por quantidade (meta por posto vs. soma entregue)
    const postos = await db.posto.findMany({
      include: {
        colaboradores: { where: { ativo: true }, select: { id: true } },
        itensPosto: { select: { itemId: true, quantidadeEsperada: true, obrigatorio: true } },
      },
    })

    // Soma das quantidades entregues por colaborador+item (colaboradores ativos)
    const colabAtivosIds = postos.flatMap(p => p.colaboradores.map(c => c.id))
    const entregasAgrupadas = colabAtivosIds.length
      ? await db.entrega.groupBy({
          by: ['colaboradorId', 'itemId'],
          where: { colaboradorId: { in: colabAtivosIds } },
          _sum: { quantidade: true },
        })
      : []
    const entregueQtdMap = new Map<string, number>()
    for (const e of entregasAgrupadas) {
      entregueQtdMap.set(`${e.colaboradorId}__${e.itemId}`, e._sum.quantidade || 0)
    }

    const pendenciasPorPosto = postos.map((p) => {
      const colaboradoresAtivos = p.colaboradores.length
      const itensEsperados = p.itensPosto.length
      // Percentual/unidades consideram só itens obrigatórios (opcionais não pesam)
      const obrigatorios = p.itensPosto.filter(ip => ip.obrigatorio)
      const esperadoPorColab = obrigatorios.reduce((s, ip) => s + (ip.quantidadeEsperada || 1), 0)
      const totalEsperado = colaboradoresAtivos * esperadoPorColab
      let totalEntregue = 0
      for (const c of p.colaboradores) {
        for (const ip of obrigatorios) {
          const esperada = ip.quantidadeEsperada || 1
          const entregue = entregueQtdMap.get(`${c.id}__${ip.itemId}`) || 0
          totalEntregue += Math.min(entregue, esperada)
        }
      }
      const pendentes = Math.max(0, totalEsperado - totalEntregue)
      return {
        postoId: p.id,
        postoNome: p.nome,
        corCapacete: p.corCapacete,
        colaboradoresAtivos,
        itensEsperados,
        totalEsperado,
        totalEntregue,
        pendentes,
        percentual: totalEsperado > 0 ? Math.round((totalEntregue / totalEsperado) * 100) : 0,
      }
    })

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
