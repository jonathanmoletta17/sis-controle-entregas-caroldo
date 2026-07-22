'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { AlertCircle, CheckCircle2, ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CategoriaBadge, CorCapaceteBadge } from '@/components/app/shared/badges'
import { ItemVisualizacaoModal, ItemVisualizacao } from '@/components/app/shared/item-visualizacao-modal'

interface PostoResumo {
  postoId: string
  postoNome: string
  corCapacete: string | null
  colaboradoresAtivos: number
  itensEsperados: number
  totalPares: number
  paresEntregues: number
  pendentes: number
  percentual: number
}

interface MatrizItem {
  itemId: string
  descricao: string
  imagemUrl: string | null
  quantidadeEsperada: number
  entregasPorColaborador: Record<string, { entregue: number; esperada: number; completo: boolean }>
}

interface MatrizData {
  posto: { id: string; nome: string; corCapacete: string | null }
  colaboradores: Array<{ id: string; nomeCompleto: string; percentual: number }>
  porCategoria: Record<string, MatrizItem[]>
  totalItens: number
}

export function PendenciasView() {
  const [resumo, setResumo] = useState<PostoResumo[]>([])
  const [loadingResumo, setLoadingResumo] = useState(true)
  const [postoSelecionado, setPostoSelecionado] = useState<string>('')
  const [matriz, setMatriz] = useState<MatrizData | null>(null)
  const [loadingMatriz, setLoadingMatriz] = useState(false)
  const [visualizandoItem, setVisualizandoItem] = useState<ItemVisualizacao | null>(null)

  useEffect(() => {
    fetch('/api/pendencias')
      .then(r => r.json())
      .then(d => setResumo(Array.isArray(d.postos) ? d.postos : []))
      .finally(() => setLoadingResumo(false))
  }, [])

  useEffect(() => {
    if (!postoSelecionado) {
      setMatriz(null)
      return
    }
    setLoadingMatriz(true)
    fetch(`/api/pendencias?postoId=${postoSelecionado}`)
      .then(r => r.json())
      .then(d => setMatriz(d))
      .catch(() => setMatriz(null))
      .finally(() => setLoadingMatriz(false))
  }, [postoSelecionado])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pendências</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Compare o que cada colaborador do mesmo posto já recebeu, item a item
        </p>
      </div>

      {postoSelecionado && (
        <button
          onClick={() => setPostoSelecionado('')}
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar para todos os postos
        </button>
      )}

      {!postoSelecionado && (
        loadingResumo ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
          </div>
        ) : resumo.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center">
              <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhum posto cadastrado ainda.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {resumo.map(p => (
              <button
                key={p.postoId}
                onClick={() => setPostoSelecionado(p.postoId)}
                disabled={p.colaboradoresAtivos === 0}
                className={cn(
                  'text-left rounded-lg border p-4 space-y-2 transition-colors',
                  p.colaboradoresAtivos === 0
                    ? 'opacity-50 cursor-not-allowed'
                    : 'hover:border-primary hover:bg-accent/30 cursor-pointer'
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-sm">{p.postoNome}</span>
                  <CorCapaceteBadge cor={p.corCapacete} />
                </div>
                <Progress value={p.percentual} className="h-2" />
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{p.colaboradoresAtivos} {p.colaboradoresAtivos === 1 ? 'colaborador' : 'colaboradores'}</span>
                  <span className="font-medium text-foreground">{p.percentual}%</span>
                </div>
                {p.pendentes > 0 && (
                  <div className="text-xs text-rose-600">{p.pendentes} {p.pendentes === 1 ? 'unidade pendente' : 'unidades pendentes'}</div>
                )}
              </button>
            ))}
          </div>
        )
      )}

      {postoSelecionado && loadingMatriz && (
        <Card><CardContent className="p-6"><Skeleton className="h-96" /></CardContent></Card>
      )}

      {postoSelecionado && !loadingMatriz && matriz && (
        <>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-lg">{matriz.posto.nome}</span>
                  <CorCapaceteBadge cor={matriz.posto.corCapacete} />
                </div>
                <div className="flex items-center gap-3 text-sm flex-wrap">
                  {matriz.colaboradores.map(c => (
                    <span key={c.id} className="text-muted-foreground">
                      {c.nomeCompleto.split(' ')[0]} <b className="text-foreground">{c.percentual}%</b>
                    </span>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>

          {matriz.colaboradores.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <AlertCircle className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">Nenhum colaborador ativo neste posto.</p>
              </CardContent>
            </Card>
          ) : (
            Object.entries(matriz.porCategoria).map(([categoria, itens]) => (
              <Card key={categoria}>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CategoriaBadge categoria={categoria} />
                    {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px] sticky left-0 bg-card z-10">Item</TableHead>
                        {matriz.colaboradores.map(c => (
                          <TableHead key={c.id} className="w-16 text-center" title={c.nomeCompleto}>
                            {c.nomeCompleto.split(' ')[0]}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {itens.map(item => (
                        <TableRow key={item.itemId}>
                          <TableCell className="sticky left-0 bg-card z-10">
                            <button
                              onClick={() => setVisualizandoItem({
                                id: item.itemId,
                                descricao: item.descricao,
                                unidade: '1',
                                categoria: { nome: categoria },
                                imagemUrl: item.imagemUrl,
                              })}
                              className="hover:underline text-left block w-full"
                              title="Clique para ver a imagem do item"
                            >
                              <div className="line-clamp-2 text-sm leading-snug">{item.descricao}</div>
                            </button>
                          </TableCell>
                          {matriz.colaboradores.map(c => {
                            const cel = item.entregasPorColaborador[c.id]
                            const entregue = cel?.entregue ?? 0
                            const esperada = cel?.esperada ?? item.quantidadeEsperada
                            const completo = cel?.completo ?? false
                            const parcial = entregue > 0 && !completo
                            return (
                              <TableCell key={c.id} className="text-center">
                                <span
                                  className={cn(
                                    'inline-flex items-center justify-center min-w-[2.5rem] rounded px-1.5 py-0.5 text-xs font-medium tabular-nums',
                                    completo ? 'bg-emerald-100 text-emerald-800' :
                                    parcial ? 'bg-amber-100 text-amber-800' :
                                    'text-muted-foreground'
                                  )}
                                  title={`${entregue} de ${esperada}`}
                                >
                                  {completo ? (
                                    <CheckCircle2 className="h-4 w-4" />
                                  ) : (
                                    `${entregue}/${esperada}`
                                  )}
                                </span>
                              </TableCell>
                            )
                          })}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ))
          )}
        </>
      )}

      <ItemVisualizacaoModal
        item={visualizandoItem}
        open={!!visualizandoItem}
        onOpenChange={(o) => !o && setVisualizandoItem(null)}
      />
    </div>
  )
}
