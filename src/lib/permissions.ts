// Papéis do sistema:
// - admin: tudo (inclusive gestão de usuários e audit log)
// - tecnico: cria/edita/exclui dados do dia a dia (colaboradores, itens, entregas...)
// - leitura: só visualiza, não pode alterar nada
export type Role = 'admin' | 'tecnico' | 'leitura'

export function canWrite(role?: string | null): boolean {
  return role === 'admin' || role === 'tecnico'
}

export function isAdmin(role?: string | null): boolean {
  return role === 'admin'
}

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrador',
  tecnico: 'Técnico',
  leitura: 'Leitura',
}
