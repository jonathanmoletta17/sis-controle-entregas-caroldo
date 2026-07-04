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
import { ClipboardList, CheckCircle2, Circle, Truck, ChevronRight, Paperclip, X, FileText, Camera } from 'lucide-react'
import { useApp } from '@/components/app/app-context'
import { CategoriaBadge } from '@/components/app/shared/badges'
import { formatDate, todayISO } from '@/components/app/shared/format'
import { useToast } from '@/hooks/use-toast'
import { ItemVisualizacaoModal, ItemVisualizacao } from '@/components/app/shared/item-visualizacao-modal'
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
  entregas: Array<{ id: string; dataEntrega: string; observacao: string | null }>
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
  const [showEntrega, setShowEntrega] = useState<{ itemId: string; descricao: string; categoriaNome: string } | null>(null)
  const [entregaForm, setEntregaForm] = useState({
    dataEntrega: todayISO(),
    quantidade: 1,
    observacao: '',
  })
  const [anexo, setAnexo] = useState<File | null>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const [savingEntrega, setSavingEntrega] = useState(false)
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

  const registrarEntrega = async () => {
    if (!showEntrega || !selectedId) return
    setSavingEntrega(true)
    try {
      let r: Response
      if (anexo || foto) {
        const fd = new FormData()
        fd.append('colaboradorId', selectedId)
        fd.append('itemId', showEntrega.itemId)
        fd.append('dataEntrega', entregaForm.dataEntrega)
        fd.append('quantidade', String(entregaForm.quantidade))
        if (entregaForm.observacao) fd.append('observacao', entregaForm.observacao)
        if (anexo) fd.append('anexo', anexo)
        if (foto) fd.append('foto', foto)
        r = await fetch('/api/entregas', { method: 'POST', body: fd })
      } else {
        r = await fetch('/api/entregas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            colaboradorId: selectedId,
            itemId: showEntrega.itemId,
            ...entregaForm,
          }),
        })
      }
      if (!r.ok) {
        let msg = 'Erro ao registrar'
        try {
          const d = await r.json()
          msg = d.error || msg
        } catch {
          msg = `${r.status} ${r.statusText || '— erro de servidor'}`
        }
        throw new Error(msg)
      }
      toast({ title: 'Entrega registrada', description: showEntrega.descricao.slice(0, 60) })
      setShowEntrega(null)
      setEntregaForm({ dataEntrega: todayISO(), quantidade: 1, observacao: '' })
      setAnexo(null)
      setFoto(null)
      // recarregar checklist
      setLoadingChecklist(true)
      fetch(`/api/checklist?colaboradorId=${selectedId}`)
        .then(r => r.json())
        .then(d => setChecklist(d))
        .finally(() => setLoadingChecklist(false))
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSavingEntrega(false)
    }
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
            <SelectTrigger><SelectValue placeholder="Selecione um terceirizado..." /></SelectTrigger>
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
              <div className="flex items-center gap-4 text-sm">
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  <b>{checklist.estatisticas.totalEntregues}</b> entregues
                </span>
                <span className="flex items-center gap-1.5">
                  <Circle className="h-4 w-4 text-muted-foreground" />
                  <b>{checklist.estatisticas.totalPendentes}</b> pendentes
                </span>
                <span className="text-muted-foreground">de {checklist.estatisticas.totalItens} itens esperados</span>
              </div>
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
                        {item.entregue ? (
                          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
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
                          <div className={`text-sm ${item.entregue ? 'text-muted-foreground line-through' : 'font-medium'}`}>
                            {item.descricao}
                          </div>
                        </button>
                        {item.entregue && (
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
                          onClick={() => {
                            setShowEntrega({ itemId: item.itemId, descricao: item.descricao, categoriaNome: categoria })
                            setEntregaForm({ dataEntrega: todayISO(), quantidade: 1, observacao: '' })
                            setAnexo(null)
                            setFoto(null)
                          }}
                        >
                          <Truck className="h-3.5 w-3.5 mr-1" />
                          {item.entregue ? 'Nova entrega' : 'Entregar'}
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

      {/* Modal de registro rápido de entrega */}
      {showEntrega && (
        <Dialog open onOpenChange={(o) => !o && setShowEntrega(null)}>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Registrar entrega
              </DialogTitle>
              <DialogDescription className="line-clamp-2">
                {showEntrega.descricao}
              </DialogDescription>
            </DialogHeader>
            {showEntrega.categoriaNome === 'Documento' && (
              <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded p-2">
                <Paperclip className="h-3.5 w-3.5 inline mr-1" />
                Item da categoria <b>Documento</b> — anexar o arquivo é <b>obrigatório</b>.
              </p>
            )}
            <div className="space-y-3 py-2">
              <div className="space-y-1.5">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={entregaForm.dataEntrega}
                  onChange={e => setEntregaForm(f => ({ ...f, dataEntrega: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  value={entregaForm.quantidade}
                  onChange={e => setEntregaForm(f => ({ ...f, quantidade: parseInt(e.target.value) || 1 }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Observação</Label>
                <Textarea
                  rows={2}
                  placeholder="Opcional"
                  value={entregaForm.observacao}
                  onChange={e => setEntregaForm(f => ({ ...f, observacao: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Foto do item recebido (opcional)</Label>
                <p className="text-xs text-muted-foreground">
                  Registre uma foto do item no momento do recebimento da CAROLDO, antes de repassar ao terceirizado.
                </p>
                {!foto ? (
                  <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-md p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                    <Camera className="h-5 w-5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">Clique para tirar/anexar uma foto</span>
                    <span className="text-xs text-muted-foreground">JPG, PNG, WEBP — máx 5MB</span>
                    <input
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.gif,.webp"
                      capture="environment"
                      onChange={e => {
                        const f = e.target.files?.[0]
                        if (f) setFoto(f)
                      }}
                    />
                  </label>
                ) : (
                  <div className="flex items-center gap-2 border rounded-md p-3 bg-accent/30">
                    <img src={URL.createObjectURL(foto)} alt="" className="h-10 w-10 object-cover rounded border shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{foto.name}</div>
                      <div className="text-xs text-muted-foreground">{(foto.size / 1024).toFixed(1)} KB</div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setFoto(null)} title="Remover foto">
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
              {showEntrega.categoriaNome === 'Documento' && (
                <div className="space-y-1.5">
                  <Label>Anexo do documento (opcional)</Label>
                  <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded p-2">
                    <Paperclip className="h-3.5 w-3.5 inline mr-1" />
                    Para itens da categoria <b>Documento</b>, você pode anexar o arquivo digitalizado.
                  </p>
                  {!anexo ? (
                    <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-md p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                      <Paperclip className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        Clique para anexar um arquivo
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PDF, JPG, PNG, DOC — máx 10MB
                      </span>
                      <input
                        type="file"
                        className="hidden"
                        accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                        onChange={e => {
                          const f = e.target.files?.[0]
                          if (f) setAnexo(f)
                        }}
                      />
                    </label>
                  ) : (
                    <div className="flex items-center gap-2 border rounded-md p-3 bg-accent/30">
                      <Paperclip className="h-4 w-4 text-sky-700 shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{anexo.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {(anexo.size / 1024).toFixed(1)} KB
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => setAnexo(null)}
                        title="Remover anexo"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowEntrega(null)}>Cancelar</Button>
              <Button onClick={registrarEntrega} disabled={savingEntrega}>
                {savingEntrega ? 'Salvando...' : 'Confirmar entrega'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      <ItemVisualizacaoModal
        item={visualizandoItem as ItemVisualizacao | null}
        open={!!visualizandoItem}
        onOpenChange={(o) => !o && setVisualizandoItem(null)}
      />
    </div>
  )
}
