import { db } from './db'

interface LogAuditParams {
  userId?: string
  acao: 'CREATE' | 'UPDATE' | 'DELETE'
  tabela: string
  registroId: string
  valoresAntigos?: unknown
  valoresNovos?: unknown
  ip?: string
}

// Registra uma entrada de audit log. Silenciosamente ignora se não há usuário
// (ex.: operações de seed) — o objetivo é rastrear ações humanas via a aplicação.
export async function logAudit(params: LogAuditParams) {
  if (!params.userId) return
  try {
    await db.auditLog.create({
      data: {
        usuarioId: params.userId,
        acao: params.acao,
        tabela: params.tabela,
        registroId: params.registroId,
        valoresAntigos: params.valoresAntigos ? JSON.parse(JSON.stringify(params.valoresAntigos)) : undefined,
        valoresNovos: params.valoresNovos ? JSON.parse(JSON.stringify(params.valoresNovos)) : undefined,
        ip: params.ip,
      },
    })
  } catch (e) {
    console.error('[audit] falha ao gravar log:', e)
  }
}
