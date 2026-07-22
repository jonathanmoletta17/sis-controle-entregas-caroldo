'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Users, UserCheck, UserX, Package, Truck, AlertCircle, TrendingUp } from 'lucide-react'
import { useApp } from '@/components/app/app-context'
import { CorCapaceteBadge } from '@/components/app/shared/badges'
import { formatDate } from '@/components/app/shared/format'
import { CategoriaBadge } from '@/components/app/shared/badges'

interface DashboardData {
  kpis: {
    totalColabs: number
    ativos: number
    desligados: number
    totalEntregas: number
    totalItens: number
    totalPostos: number
  }
  pendenciasPorPosto: Array<{
    postoId: string
    postoNome: string
    corCapacete: string | null
    colaboradoresAtivos: number
    itensEsperados: number
    totalEsperado: number
    totalEntregue: number
    pendentes: number
    percentual: number
  }>
  entregasRecentes: Array<{
    id: string
    dataEntrega: string
    observacao: string | null
    colaborador: { id: string; nomeCompleto: string; cpf: string; posto: { nome: string } | null }
    item: { id: string; descricao: string; categoria: { nome: string } }
  }>
}

export function DashboardView() {
  const { openColaborador } = useApp()
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch('/api/dashboard')
      .then(r => r.json())
      .then(d => {
        if (!cancelled) {
          setData(d)
          setError(null)
        }
      })
      .catch(e => !cancelled && setError(e.message))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [])

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-72" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  if (error) {
    return <Card><CardContent className="p-6 text-destructive">Erro: {error}</CardContent></Card>
  }

  if (!data) return null

  const kpiCards = [
    { label: 'Total de terceirizados', value: data.kpis.totalColabs, icon: Users, color: 'text-sky-600 bg-sky-50' },
    { label: 'Ativos', value: data.kpis.ativos, icon: UserCheck, color: 'text-emerald-600 bg-emerald-50' },
    { label: 'Desligados', value: data.kpis.desligados, icon: UserX, color: 'text-zinc-600 bg-zinc-100' },
    { label: 'Itens catalogados', value: data.kpis.totalItens, icon: Package, color: 'text-amber-600 bg-amber-50' },
    { label: 'Entregas registradas', value: data.kpis.totalEntregas, icon: Truck, color: 'text-violet-600 bg-violet-50' },
    { label: 'Postos', value: data.kpis.totalPostos, icon: AlertCircle, color: 'text-rose-600 bg-rose-50' },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Visão geral do contrato 004/2026 — Manutenção Predial
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => {
          const Icon = kpi.icon
          return (
            <Card key={kpi.label}>
              <CardContent className="p-4">
                <div className={`inline-flex h-8 w-8 items-center justify-center rounded-md ${kpi.color} mb-3`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold">{kpi.value}</div>
                <div className="text-xs text-muted-foreground mt-1 leading-tight">{kpi.label}</div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Pendências por posto */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Pendências por posto</CardTitle>
          <CardDescription>
            Unidades esperadas (soma das metas de cada colaborador do posto) vs. unidades efetivamente entregues
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data.pendenciasPorPosto.map(p => (
              <div key={p.postoId} className="space-y-1.5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-medium text-sm truncate">{p.postoNome}</span>
                    <CorCapaceteBadge cor={p.corCapacete} />
                    <span className="text-xs text-muted-foreground">
                      {p.colaboradoresAtivos} {p.colaboradoresAtivos === 1 ? 'colaborador' : 'colaboradores'} · {p.itensEsperados} itens
                    </span>
                  </div>
                  <div className="text-sm tabular-nums">
                    <span className="font-semibold text-emerald-600">{p.totalEntregue}</span>
                    <span className="text-muted-foreground"> / {p.totalEsperado} unidades</span>
                    {p.pendentes > 0 && (
                      <span className="text-rose-600 ml-2">({p.pendentes} pend.)</span>
                    )}
                  </div>
                </div>
                <Progress value={p.percentual} className="h-2" />
              </div>
            ))}
            {data.pendenciasPorPosto.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhum posto cadastrado ainda.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Entregas recentes */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Entregas recentes
          </CardTitle>
          <CardDescription>Últimas 10 entregas registradas no sistema</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {data.entregasRecentes.map(e => (
              <button
                key={e.id}
                onClick={() => openColaborador(e.colaborador.id)}
                className="w-full text-left flex items-start gap-3 p-3 rounded-md hover:bg-accent transition-colors border border-transparent hover:border-border"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-medium text-sm truncate">{e.colaborador.nomeCompleto}</span>
                    <CategoriaBadge categoria={e.item.categoria.nome} />
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {e.item.descricao.length > 80 ? e.item.descricao.slice(0, 77) + '...' : e.item.descricao}
                  </div>
                  {e.observacao && (
                    <div className="text-xs italic text-muted-foreground mt-1">"{e.observacao}"</div>
                  )}
                </div>
                <div className="text-right text-xs text-muted-foreground shrink-0">
                  <div className="font-medium text-foreground">{formatDate(e.dataEntrega)}</div>
                  <div className="mt-1">{e.colaborador.posto?.nome || '—'}</div>
                </div>
              </button>
            ))}
            {data.entregasRecentes.length === 0 && (
              <p className="text-sm text-muted-foreground py-6 text-center">
                Nenhuma entrega registrada ainda. Use a aba <b>Entregas</b> para registrar a primeira.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
