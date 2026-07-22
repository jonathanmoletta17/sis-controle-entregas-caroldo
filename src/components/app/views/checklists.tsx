'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Skeleton } from '@/components/ui/skeleton'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ClipboardList, CheckCircle2, Circle, CircleDashed, Truck, ChevronRight, Paperclip, X, FileText, Camera } from 'lucide-react'
import { useApp } from '@/components/app/app-context'
import { CategoriaBadge } from '@/components/app/shared/badges'
import { formatDate, todayISO } from '@/components/app/shared/format'
import { useToast } from '@/hooks/use-toast'
import { ItemVisualizacaoModal, ItemVisualizacao } from '@/components/app/shared/item-visualizacao-modal'
import { RegistrarEntregaDialog } from '@/components/app/shared/registrar-entrega-dialog'
import { useCanWrite } from '@/hooks/use-can-write'

interface ColaboradorListItem {
  id: string
  cpf: string
  nomeCompleto: string
  ativo: boolean
  posto: { id: string; nome: string; corCapacete: string | null } | null
  empresa: { nome: string } | null
}

interface ChecklistItem {
  itemId: string
  descricao: string
  unidade: string
  quantidadeEsperada: number
  obrigatorio: boolean
  entregas: Array<{ id: string; dataEntrega: string; observacao: string | null; quantidade?: number }>
  entregueQtd: number
  saldo: number
  status: 'pendente' | 'parcial' | 'completo'
  entregue: boolean
  ultimaEntrega: string | null
  imagemUrl?: string | null
  imagemNome?: string | null
}

interface ChecklistData {
  colaborador: {
    id: string
    nomeCompleto: string
    cpf: string
    posto: { id: string; nome: string; corCapacete: string | null } | null
    ativo: boolean
  }
  porCategoria: Record<string, ChecklistItem[]>
  estatisticas: {
    totalItens: number
    totalEntregues: number
    totalPendentes: number
    percentual: number
    itensCompletos?: number
    itensParciais?: number
    itensPendentes?: number
    itensOpcionais?: number
    opcionaisCompletos?: number
    unidadesEsperadas?: number
    unidadesEntregues?: number
  }
}

export function ChecklistsView() {
  const { openColaborador } = useApp()
  const canWrite = useCanWrite()
  const { toast } = useToast()
  const [colaboradores, setColaboradores] = useState<ColaboradorListItem[]>([])
  const [selectedId, setSelectedId] = useState<string>('')
  const [checklist, setChecklist] = useState<ChecklistData | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingChecklist, setLoadingChecklist] = useState(false)
  const [showEntrega, setShowEntrega] = useState<{ itemId: string; descricao: string; categoriaNome: string; quantidadeEsperada: number; entregueQtd: number } | null>(null)
  const [visualizandoItem, setVisualizandoItem] = useState<ChecklistItem | null>(null)

  useEffect(() => {
    fetch('/api/colaboradores?incluirDesligados=false')
      .then(r => r.json())
      .then(d => {
        const arr = Array.isArray(d) ? d : []
        setColaboradores(arr)
        if (arr.length > 0 && !selectedId) {
          setSelectedId(arr[0].id)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedId) {
      setChecklist(null)
      return
    }
    setLoadingChecklist(true)
    fetch(`/api/checklist?colaboradorId=${selectedId}`)
      .then(r => r.json())
      .then(d => setChecklist(d))
      .catch(() => setChecklist(null))
      .finally(() => setLoadingChecklist(false))
  }, [selectedId])

  const reloadChecklist = () => {
    if (!selectedId) return
    setLoadingChecklist(true)
    fetch(`/api/checklist?colaboradorId=${selectedId}`)
      .then(r => r.json())
      .then(d => setChecklist(d))
      .catch(() => {})
      .finally(() => setLoadingChecklist(false))
  }

  if (loading) {
    return <Card><CardContent className="p-6"><Skeleton className="h-96" /></CardContent></Card>
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Checklists</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Selecione um terceirizado para ver o checklist de itens esperados vs entregues
        </p>
      </div>

      <Card>
        <CardContent className="p-4">
          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full"><SelectValue placeholder="Selecione um terceirizado..." /></SelectTrigger>
            <SelectContent className="max-h-80">
              {colaboradores.map(c => (
                <SelectItem key={c.id} value={c.id}>
                  {c.nomeCompleto} — {c.posto?.nome || 'sem posto'}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {colaboradores.length === 0 && (
            <p className="text-xs text-muted-foreground mt-2">
              Nenhum terceirizado ativo. Cadastre um terceirizado antes.
            </p>
          )}
        </CardContent>
      </Card>

      {loadingChecklist && (
        <Card><CardContent className="p-6 space-y-2">
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-2 w-full" />
          <Skeleton className="h-96 w-full" />
        </CardContent></Card>
      )}

      {checklist && !loadingChecklist && (
        <>
          {/* Resumo */}
          <Card>
            <CardContent className="p-5 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <button
                    onClick={() => openColaborador(checklist.colaborador.id)}
                    className="font-semibold text-lg hover:underline flex items-center gap-1"
                  >
                    {checklist.colaborador.nomeCompleto}
                    <ChevronRight className="h-4 w-4" />
                  </button>
                  <div className="text-sm text-muted-foreground mt-0.5">
                    {checklist.colaborador.posto?.nome} · {checklist.colaborador.posto?.corCapacete}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        window.open(`/relatorio/${checklist.colaborador.id}`, '_blank')
                      }
                    }}
                  >
                    <FileText className="h-4 w-4 mr-1.5" />
                    Gerar relatório
                  </Button>
                  <div className="text-right">
                    <div className="text-3xl font-bold tabular-nums">{checklist.estatisticas.percentual}%</div>
                    <div className="text-xs text-muted-foreground">concluído</div>
                  </div>
                </div>
              </div>
              <Progress value={checklist.estatisticas.percentual} className="h-2" />
              <div className="flex items-center gap-4 text-sm flex-wrap">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <b>{checklist.estatisticas.itensCompletos ?? checklist.estatisticas.totalEntregues}</b> completos
                </span>
                <span className="flex items-center gap-1.5">
                  <CircleDashed className="h-4 w-4 text-amber-500" />
                  <b>{checklist.estatisticas.itensParciais ?? 0}</b> parciais
                </span>
                <span className="flex items-center gap-1.5">
                  <Circle className="h-4 w-4 text-muted-foreground" />
                  <b>{checklist.estatisticas.itensPendentes ?? checklist.estatisticas.totalPendentes}</b> pendentes
                </span>
                <span className="text-muted-foreground">obrigatórios</span>
                {checklist.estatisticas.unidadesEsperadas !== undefined && (
                  <span className="text-muted-foreground tabular-nums">
                    · {checklist.estatisticas.unidadesEntregues}/{checklist.estatisticas.unidadesEsperadas} unidades obrigatórias
                  </span>
                )}
                {!!checklist.estatisticas.itensOpcionais && (
                  <span className="text-muted-foreground">
                    · {checklist.estatisticas.opcionaisCompletos ?? 0}/{checklist.estatisticas.itensOpcionais} opcionais entregues
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                O percentual considera apenas itens obrigatórios. Opcionais são rastreados, mas não afetam a nota.
              </p>
            </CardContent>
          </Card>

          {/* Por categoria */}
          {Object.entries(checklist.porCategoria).map(([categoria, itens]) => (
            <Card key={categoria}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <CategoriaBadge categoria={categoria} />
                    {itens.length} {itens.length === 1 ? 'item' : 'itens'}
                  </CardTitle>
                  <div className="text-xs text-muted-foreground">
                    {itens.filter(i => i.entregue).length}/{itens.length} entregues
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y">
                  {itens.map(item => (
                    <div key={item.itemId} className="flex items-start gap-3 p-3 hover:bg-accent/30">
                      <div className="shrink-0 mt-0.5">
                        {item.status === 'completo' ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                        ) : item.status === 'parcial' ? (
                          <CircleDashed className="h-5 w-5 text-amber-500" />
                        ) : (
                          <Circle className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => setVisualizandoItem({
                            id: item.itemId,
                            descricao: item.descricao,
                            unidade: item.unidade,
                            categoria: { nome: categoria },
                            imagemUrl: item.imagemUrl,
                            imagemNome: item.imagemNome,
                            entregue: item.entregue,
                            ultimaEntrega: item.ultimaEntrega,
                          })}
                          className="text-left hover:underline"
                          title="Clique para ver a imagem do item"
                        >
                          <div className={`text-sm ${item.status === 'completo' ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                            {item.descricao}
                          </div>
                        </button>
                        <div className="flex items-center gap-2 mt-1 flex-wrap">
                          <Badge
                            variant="outline"
                            className={`text-xs tabular-nums ${
                              item.status === 'completo' ? 'border-emerald-300 text-emerald-700' :
                              item.status === 'parcial' ? 'border-amber-300 text-amber-700' :
                              'text-muted-foreground'
                            }`}
                          >
                            {item.entregueQtd} de {item.quantidadeEsperada}
                            {item.saldo > 0 && ` · faltam ${item.saldo}`}
                          </Badge>
                          {!item.obrigatorio && (
                            <Badge variant="secondary" className="text-xs">Opcional</Badge>
                          )}
                        </div>
                        {item.entregueQtd > 0 && (
                          <div className="text-xs text-muted-foreground mt-0.5">
                            Última entrega: {formatDate(item.ultimaEntrega)}
                            {item.entregas.length > 1 && ` · ${item.entregas.length} entregas registradas`}
                          </div>
                        )}
                      </div>
                      {checklist.colaborador.ativo && canWrite && (
                        <Button
                          size="sm"
                          variant={item.entregue ? 'outline' : 'default'}
                          onClick={() => setShowEntrega({
                            itemId: item.itemId,
                            descricao: item.descricao,
                            categoriaNome: categoria,
                            quantidadeEsperada: item.quantidadeEsperada,
                            entregueQtd: item.entregueQtd,
                          })}
                        >
                          <Truck className="h-3.5 w-3.5 mr-1" />
                          {item.status === 'completo' ? 'Nova entrega' : item.status === 'parcial' ? 'Registrar mais' : 'Entregar'}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}

          {checklist.estatisticas.totalItens === 0 && (
            <Card>
              <CardContent className="p-12 text-center">
                <ClipboardList className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
                <p className="text-sm text-muted-foreground">
                  Nenhum item vinculado ao posto <b>{checklist.colaborador.posto?.nome}</b>. Vincule itens ao posto na aba <b>Itens</b>.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Registro de entrega — componente compartilhado (com meta/saldo e pré-preenchimento) */}
      <RegistrarEntregaDialog
        open={!!showEntrega}
        onOpenChange={(o) => { if (!o) setShowEntrega(null) }}
        colaboradorId={selectedId}
        colaboradorNome={checklist?.colaborador?.nomeCompleto}
        travarColaborador
        itemId={showEntrega?.itemId}
        itemDescricao={showEntrega?.descricao}
        itemCategoria={showEntrega?.categoriaNome}
        travarItem
        quantidadeEsperada={showEntrega?.quantidadeEsperada}
        entregueQtd={showEntrega?.entregueQtd}
        onSaved={() => {
          toast({ title: 'Entrega registrada', description: showEntrega?.descricao.slice(0, 60) })
          setShowEntrega(null)
          reloadChecklist()
        }}
      />

      <ItemVisualizacaoModal
        item={visualizandoItem as ItemVisualizacao | null}
        open={!!visualizandoItem}
        onOpenChange={(o) => !o && setVisualizandoItem(null)}
      />
    </div>
  )
}
