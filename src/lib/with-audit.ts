import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from './auth'
import { canWrite } from './permissions'

export interface AuditActor {
  userId?: string
  ip?: string
}

function getClientIp(req: NextRequest): string | undefined {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined
}

// Resolve a sessão atual, bloqueia usuários com papel "leitura" (só podem consultar,
// nunca mutar), e passa {userId, ip} explicitamente para o corpo da rota, que deve
// usá-los diretamente nos campos criadoPorId/atualizadoPorId e no logAudit().
export async function withAuditContext<T>(
  req: NextRequest,
  fn: (actor: AuditActor) => Promise<T>
): Promise<T | NextResponse> {
  const session = await auth()
  const role = (session?.user as { role?: string } | undefined)?.role
  if (!canWrite(role)) {
    return NextResponse.json({ error: 'Seu usuário tem acesso somente leitura.' }, { status: 403 })
  }
  const userId = (session?.user as { id?: string } | undefined)?.id
  const ip = getClientIp(req)
  return fn({ userId, ip })
}
