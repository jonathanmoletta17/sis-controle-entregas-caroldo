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
      className={cn('bg-zinc-200 text-zinc-700 hover:bg-zinc-200', className)}
      title={motivoDesligamento ? `Motivo: ${motivoDesligamento}` : undefined}
    >
      Desligado{data ? ` em ${data}` : ''}
    </Badge>
  )
}

export function CategoriaBadge({ categoria, className }: { categoria: string; className?: string }) {
  const colors: Record<string, string> = {
    Materiais: 'bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200',
    EPI: 'bg-rose-100 text-rose-800 hover:bg-rose-100 border-rose-200',
    Uniforme: 'bg-violet-100 text-violet-800 hover:bg-violet-100 border-violet-200',
    Documento: 'bg-sky-100 text-sky-800 hover:bg-sky-100 border-sky-200',
  }
  return (
    <Badge variant="outline" className={cn(colors[categoria] || 'bg-gray-100 text-gray-800', 'font-medium', className)}>
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
    <Badge variant="outline" className={cn('gap-1.5', className)}>
      <span className={cn('h-2.5 w-2.5 rounded-full inline-block', colors[cor] || 'bg-gray-400')} />
      {cor}
    </Badge>
  )
}
