import type { NextRequest } from 'next/server'
import { auth } from './auth'

export interface AuditActor {
  userId?: string
  ip?: string
}

function getClientIp(req: NextRequest): string | undefined {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
}

// Resolve a sessão atual e passa {userId, ip} explicitamente para o corpo da rota,
// que deve usá-los diretamente nos campos criadoPorId/atualizadoPorId e no logAudit().
export async function withAuditContext<T>(req: NextRequest, fn: (actor: AuditActor) => Promise<T>): Promise<T> {
  const session = await auth()
  const userId = (session?.user as { id?: string } | undefined)?.id
  const ip = getClientIp(req)
  return fn({ userId, ip })
}
