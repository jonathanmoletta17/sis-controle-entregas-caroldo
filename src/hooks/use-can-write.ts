'use client'

import { useSession } from 'next-auth/react'
import { canWrite } from '@/lib/permissions'

// Hook para esconder/desabilitar ações de escrita (criar, editar, excluir) na UI
// para usuários com papel "leitura". A checagem que realmente importa é a do
// servidor (src/lib/with-audit.ts) — isso aqui é só para não mostrar botões mortos.
export function useCanWrite(): boolean {
  const { data: session } = useSession()
  return canWrite((session?.user as { role?: string } | undefined)?.role)
}
