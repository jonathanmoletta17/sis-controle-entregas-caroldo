import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

// GET /api/checklist?colaboradorId=... — itens esperados vs entregues para um colaborador
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const colaboradorId = searchParams.get('colaboradorId')
  if (!colaboradorId) {
    return NextResponse.json({ error: 'colaboradorId é obrigatório' }, { status: 400 })
  }

  const colab = await db.colaborador.findUnique({
    where: { id: colaboradorId },
    include: { posto: true },
  })
  if (!colab) {
    return NextResponse.json({ error: 'Colaborador não encontrado' }, { status: 404 })
  }

  // Itens esperados para o posto atual
  const itensPosto = await db.itemPosto.findMany({
    where: { postoId: colab.postoId },
    include: {
      item: {
        include: {
          categoria: true,
          entregas: {
            where: { colaboradorId },
            orderBy: { dataEntrega: 'desc' },
          },
        },
      },
    },
    orderBy: { item: { descricao: 'asc' } },
  })

  // Agrupar por categoria — cálculo por quantidade (soma das entregas vs. meta do posto).
  // O percentual e os contadores de conformidade consideram APENAS itens obrigatórios;
  // os opcionais aparecem e são rastreados, mas não pesam na nota.
  const porCategoria: Record<string, any[]> = {}
  let unidadesEsperadas = 0
  let unidadesEntregues = 0 // limitado à meta (sem excedente) para o percentual
  let itensCompletos = 0
  let itensParciais = 0
  let itensPendentes = 0
  let itensOpcionais = 0
  let opcionaisCompletos = 0

  for (const ip of itensPosto) {
    const cat = ip.item.categoria.nome
    if (!porCategoria[cat]) porCategoria[cat] = []

    const esperada = ip.quantidadeEsperada || 1
    const entregueQtd = ip.item.entregas.reduce((s, e) => s + (e.quantidade || 0), 0)
    const status = entregueQtd <= 0 ? 'pendente' : entregueQtd >= esperada ? 'completo' : 'parcial'
    const saldo = Math.max(0, esperada - entregueQtd)

    if (ip.obrigatorio) {
      unidadesEsperadas += esperada
      unidadesEntregues += Math.min(entregueQtd, esperada)
      if (status === 'completo') itensCompletos++
      else if (status === 'parcial') itensParciais++
      else itensPendentes++
    } else {
      itensOpcionais++
      if (status === 'completo') opcionaisCompletos++
    }

    porCategoria[cat].push({
      itemId: ip.item.id,
      descricao: ip.item.descricao,
      unidade: ip.item.unidade,
      imagemUrl: ip.item.imagemUrl,
      imagemNome: ip.item.imagemNome,
      quantidadeEsperada: esperada,
      obrigatorio: ip.obrigatorio,
      entregas: ip.item.entregas,
      entregueQtd,
      saldo,
      status,
      entregue: status === 'completo',
      ultimaEntrega: ip.item.entregas[0]?.dataEntrega || null,
    })
  }

  // Estatísticas — percentual ponderado por quantidade, só obrigatórios
  const totalItens = itensPosto.length
  const percentual = unidadesEsperadas > 0 ? Math.round((unidadesEntregues / unidadesEsperadas) * 100) : 0

  return NextResponse.json({
    colaborador: {
      id: colab.id,
      nomeCompleto: colab.nomeCompleto,
      cpf: colab.cpf,
      posto: colab.posto,
      ativo: colab.ativo,
    },
    porCategoria,
    estatisticas: {
      totalItens,
      itensCompletos,
      itensParciais,
      itensPendentes,
      itensOpcionais,
      opcionaisCompletos,
      unidadesEsperadas,
      unidadesEntregues,
      percentual,
      // compat: telas antigas
      totalEntregues: itensCompletos,
      totalPendentes: itensPendentes + itensParciais,
    },
  })
}
