import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { withAuditContext } from '@/lib/with-audit'
import { logAudit } from '@/lib/audit'

// DELETE /api/mudancas-posto/[id] — excluir registro de mudança de posto
// Usado quando a mudança foi registrada por engano. Se a mudança era a mais recente,
// o colaborador volta para o posto anterior automaticamente.
export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return withAuditContext(req, async ({ userId, ip }) => {
  try {
    const { id } = await ctx.params

    const mudanca = await db.mudancaPosto.findUnique({ where: { id } })
    if (!mudanca) {
      return NextResponse.json({ error: 'Registro de mudança não encontrado' }, { status: 404 })
    }

    // Verificar se é a mudança MAIS RECENTE do colaborador — se for, reverter posto atual
    const mudancasColab = await db.mudancaPosto.findMany({
      where: { colaboradorId: mudanca.colaboradorId },
      orderBy: { dataMudanca: 'desc' },
    })

    const ehMaisRecente = mudancasColab[0]?.id === id

    // Deletar a mudança
    await db.mudancaPosto.delete({ where: { id } })
    await logAudit({ userId, ip, acao: 'DELETE', tabela: 'MudancaPosto', registroId: id, valoresAntigos: mudanca })

    // Se era a mais recente, reverter o posto do colaborador para o anterior
    if (ehMaisRecente) {
      const proximaMaisRecente = mudancasColab[1] // a anterior à que foi apagada
      if (proximaMaisRecente) {
        // Voltar para o posto que era o "novo" da mudança anterior
        const revertido = await db.colaborador.update({
          where: { id: mudanca.colaboradorId },
          data: { postoId: proximaMaisRecente.postoNovoId, atualizadoPorId: userId },
        })
        await logAudit({ userId, ip, acao: 'UPDATE', tabela: 'Colaborador', registroId: revertido.id, valoresNovos: revertido })
      } else {
        // Não há mudança anterior — voltar para o posto que era o "anterior" da mudança apagada
        const revertido = await db.colaborador.update({
          where: { id: mudanca.colaboradorId },
          data: { postoId: mudanca.postoAnteriorId, atualizadoPorId: userId },
        })
        await logAudit({ userId, ip, acao: 'UPDATE', tabela: 'Colaborador', registroId: revertido.id, valoresNovos: revertido })
      }
    }

    return NextResponse.json({
      message: 'Registro de mudança excluído' + (ehMaisRecente ? '. Posto do colaborador revertido.' : ''),
    })
  } catch (err: any) {
    console.error('[DELETE /api/mudancas-posto/[id]] error:', err)
    return NextResponse.json({ error: err.message || 'Erro ao excluir mudança' }, { status: 500 })
  }
  })
}
