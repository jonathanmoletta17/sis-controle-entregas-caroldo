'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface StatusBadgeProps {
  ativo: boolean
  dataDesligamento?: Date | string | null
  motivoDesligamento?: string | null
  className?: string
}

export function StatusBadge({ ativo, dataDesligamento, motivoDesligamento, className }: StatusBadgeProps) {
  if (ativo) {
    return (
      <Badge variant="default" className={cn('bg-emerald-600 hover:bg-emerald-600 text-white', className)}>
        Ativo
      </Badge>
    )
  }
  const data = dataDesligamento
    ? typeof dataDesligamento === 'string'
      ? new Date(dataDesligamento).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
      : dataDesligamento.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : null
  return (
    <Badge
      variant="secondary"
      className={cn('bg-zinc-200 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-800', className)}
      title={motivoDesligamento ? `Motivo: ${motivoDesligamento}` : undefined}
    >
      Desligado{data ? ` em ${data}` : ''}
    </Badge>
  )
}

export function CategoriaBadge({ categoria, className }: { categoria: string; className?: string }) {
  const colors: Record<string, string> = {
    Materiais: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950/50 dark:border-amber-900',
    EPI: 'bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200 dark:bg-rose-950/50 dark:text-rose-300 dark:hover:bg-rose-950/50 dark:border-rose-900',
    Uniforme: 'bg-violet-100 text-violet-800 hover:bg-violet-100 border-violet-200 dark:bg-violet-950/50 dark:text-violet-300 dark:hover:bg-violet-950/50 dark:border-violet-900',
    Documento: 'bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200 dark:bg-sky-950/50 dark:text-sky-300 dark:hover:bg-sky-950/50 dark:border-sky-900',
  }
  return (
    <Badge variant="outline" className={cn(colors[categoria] || 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300', 'font-medium', className)}>
      {categoria}
    </Badge>
  )
}

export function CorCapaceteBadge({ cor, className }: { cor?: string | null; className?: string }) {
  if (!cor) return null
  const colors: Record<string, string> = {
    Amarelo: 'bg-yellow-400',
    Azul: 'bg-blue-500',
    Laranja: 'bg-orange-500',
    Verde: 'bg-green-500',
    Vermelho: 'bg-red-500',
  }
  return (
    <span
      title={`Capacete ${cor}`}
      className={cn('h-2.5 w-2.5 rounded-full inline-block shrink-0', colors[cor] || 'bg-gray-400', className)}
    />
  )
}
