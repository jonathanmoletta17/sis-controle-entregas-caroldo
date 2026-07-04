'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Truck, Trash2, Paperclip, X, Camera } from 'lucide-react'
import { useApp } from '@/components/app/app-context'
import { useToast } from '@/hooks/use-toast'
import { formatDate, todayISO } from '@/components/app/shared/format'
import { ItemVisualizacaoModal, ItemVisualizacao } from '@/components/app/shared/item-visualizacao-modal'
import { useCanWrite } from '@/hooks/use-can-write'

interface ColaboradorListItem {
  id: string
  cpf: string
  nomeCompleto: string
  ativo: boolean
  posto: { id: string; nome: string; corCapacete: string | null } | null
}
interface ItemOption {
  id: string
  descricao: string
  unidade: string
  categoria: { nome: string }
}
interface EntregaListItem {
  id: string
  dataEntrega: string
  quantidade: number
  observacao: string | null
  anexoUrl: string | null
  anexoNome: string | null
  fotoUrl: string | null
  colaborador: { id: string; nomeCompleto: string; cpf: string; posto: { nome: string } | null }
  item: {
    id: string
    descricao: string
    categoria: { nome: string }
    imagemUrl?: string | null
    imagemNome?: string | null
    unidade?: string
  }
}

export function EntregasView() {
  const { openColaborador } = useApp()
  const canWrite = useCanWrite()
  const { toast } = useToast()
  const [entregas, setEntregas] = useState<EntregaListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filtroColab, setFiltroColab] = useState<string>('')
  const [filtroPosto, setFiltroPosto] = useState<string>('')
  const [colaboradores, setColaboradores] = useState<ColaboradorListItem[]>([])
  const [postos, setPostos] = useState<Array<{ id: string; nome: string }>>([])
  const [showForm, setShowForm] = useState(false)
  const [visualizandoItem, setVisualizandoItem] = useState<EntregaListItem['item'] | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroColab) params.set('colaboradorId', filtroColab)
    else if (filtroPosto) params.set('postoId', filtroPosto)
    params.set('limit', '200')
    fetch(`/api/entregas?${params}`)
      .then(r => r.json())
      .then(d => setEntregas(Array.isArray(d) ? d : []))
      .catch(() => setEntregas([]))
      .finally(() => setLoading(false))
  }, [filtroColab, filtroPosto])

  useEffect(() => {
    fetch('/api/colaboradores?incluirDesligados=true')
      .then(r => r.json())
      .then(d => setColaboradores(Array.isArray(d) ? d : []))
    fetch('/api/postos')
      .then(r => r.json())
      .then(d => setPostos(Array.isArray(d) ? d : []))
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const excluir = async (id: string) => {
    if (!confirm('Confirma a exclusão deste registro de entrega? Esta ação não pode ser desfeita.')) return
    try {
      await fetch(`/api/entregas/${id}`, { method: 'DELETE' })
      toast({ title: 'Entrega removida' })
      carregar()
    } catch {
      toast({ title: 'Erro ao excluir', variant: 'destructive' })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Entregas</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Registro histórico de todas as entregas — materiais, EPIs, uniformes e documentos
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" />
            Registrar entrega
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <Select
                value={filtroPosto || '_todos'}
                onValueChange={v => { setFiltroPosto(v === '_todos' ? '' : v); setFiltroColab('') }}
              >
                <SelectTrigger><SelectValue placeholder="Todos os postos" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="_todos">Todos os postos</SelectItem>
                  {postos.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1 min-w-[240px]">
              <Select
                value={filtroColab || '_todos'}
                onValueChange={v => { setFiltroColab(v === '_todos' ? '' : v); setFiltroPosto('') }}
              >
                <SelectTrigger><SelectValue placeholder="Todos os terceirizados" /></SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="_todos">Todos os terceirizados</SelectItem>
                  {colaboradores.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nomeCompleto} {!c.ativo && '(desligado)'} — {c.posto?.nome || 'sem posto'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Filtre por posto para comparar as entregas de todos os colaboradores do mesmo cargo, ou por terceirizado para ver o histórico de uma pessoa.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : entregas.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                Nenhuma entrega registrada ainda. Use o botão <b>Registrar entrega</b> para começar.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: cards empilhados */}
              <div className="md:hidden divide-y">
                {entregas.map(e => (
                  <div key={e.id} className="p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => openColaborador(e.colaborador.id)} className="text-left min-w-0">
                        <div className="font-medium text-sm hover:underline truncate">{e.colaborador.nomeCompleto}</div>
                        <div className="text-xs text-muted-foreground">
                          {e.colaborador.posto?.nome || 'sem posto'} · {formatDate(e.dataEntrega)}
                        </div>
                      </button>
                      {canWrite && (
                        <Button variant="ghost" size="icon" onClick={() => excluir(e.id)} className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                    <button
                      onClick={() => setVisualizandoItem(e.item)}
                      className="flex gap-2 items-start w-full text-left hover:underline"
                      title="Clique para ver a imagem do item"
                    >
                      {e.item.imagemUrl && (
                        <img
                          src={e.item.imagemUrl}
                          alt=""
                          className="h-10 w-10 object-cover rounded border shrink-0"
                          onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none' }}
                        />
                      )}
                      <div className="min-w-0 flex-1">
                        <span className={`text-xs px-1.5 py-0.5 rounded inline-block mb-1 ${
                          e.item.categoria.nome === 'Materiais' ? 'bg-amber-100 text-amber-800' :
                          e.item.categoria.nome === 'EPI' ? 'bg-rose-100 text-rose-800' :
                          e.item.categoria.nome === 'Uniforme' ? 'bg-violet-100 text-violet-800' :
                          'bg-sky-100 text-sky-800'
                        }`}>
                          {e.item.categoria.nome}
                        </span>
                        <div className="text-sm leading-snug">{e.item.descricao}</div>
                      </div>
                    </button>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                      <span>Qtd: <b className="text-foreground">{e.quantidade}</b></span>
                      {e.observacao && <span className="italic">"{e.observacao}"</span>}
                    </div>
                    {(e.fotoUrl || e.anexoUrl) && (
                      <div className="flex items-center gap-3">
                        {e.fotoUrl && (
                          <a href={e.fotoUrl} target="_blank" rel="noopener noreferrer" title="Ver foto do recebimento">
                            <img src={e.fotoUrl} alt="Foto do recebimento" className="h-10 w-10 object-cover rounded border" />
                          </a>
                        )}
                        {e.anexoUrl && (
                          <a
                            href={e.anexoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
                            title={e.anexoNome || 'Abrir anexo'}
                          >
                            <Paperclip className="h-3.5 w-3.5" />
                            <span className="truncate max-w-[160px]">{e.anexoNome || 'anexo'}</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop/tablet: tabela */}
              <div className="hidden md:block">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[8%]">Data</TableHead>
                      <TableHead className="w-[15%]">Terceirizado</TableHead>
                      <TableHead className="w-[9%]">Posto</TableHead>
                      <TableHead className="w-[8%]">Categoria</TableHead>
                      <TableHead className="w-[22%]">Item</TableHead>
                      <TableHead className="w-[4%] text-center">Qtd</TableHead>
                      <TableHead className="w-[12%]">Observação</TableHead>
                      <TableHead className="w-[10%]">Foto</TableHead>
                      <TableHead className="w-[7%]">Anexo</TableHead>
                      <TableHead className="w-[3%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {entregas.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="tabular-nums whitespace-nowrap align-top text-sm">{formatDate(e.dataEntrega)}</TableCell>
                        <TableCell className="align-top">
                          <button onClick={() => openColaborador(e.colaborador.id)} className="font-medium hover:underline text-left block w-full">
                            <div className="line-clamp-2 text-sm leading-snug">{e.colaborador.nomeCompleto}</div>
                          </button>
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="line-clamp-2 text-sm leading-snug">{e.colaborador.posto?.nome || '—'}</div>
                        </TableCell>
                        <TableCell className="align-top">
                          <span className={`text-xs px-2 py-0.5 rounded inline-block ${
                            e.item.categoria.nome === 'Materiais' ? 'bg-amber-100 text-amber-800' :
                            e.item.categoria.nome === 'EPI' ? 'bg-rose-100 text-rose-800' :
                            e.item.categoria.nome === 'Uniforme' ? 'bg-violet-100 text-violet-800' :
                            'bg-sky-100 text-sky-800'
                          }`}>
                            {e.item.categoria.nome}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm align-top">
                          <button
                            onClick={() => setVisualizandoItem(e.item)}
                            className="hover:underline text-left flex gap-2 items-start w-full"
                            title="Clique para ver a imagem do item"
                          >
                            {e.item.imagemUrl && (
                              <img
                                src={e.item.imagemUrl}
                                alt=""
                                className="h-8 w-8 object-cover rounded border shrink-0"
                                onError={(ev) => { (ev.target as HTMLImageElement).style.display = 'none' }}
                              />
                            )}
                            <div className="line-clamp-3 leading-snug flex-1 min-w-0">{e.item.descricao}</div>
                          </button>
                        </TableCell>
                        <TableCell className="text-center tabular-nums align-top">{e.quantidade}</TableCell>
                        <TableCell className="text-xs text-muted-foreground align-top">
                          <div className="line-clamp-2 leading-snug" title={e.observacao || ''}>
                            {e.observacao || '—'}
                          </div>
                        </TableCell>
                        <TableCell className="align-top">
                          {e.fotoUrl ? (
                            <a href={e.fotoUrl} target="_blank" rel="noopener noreferrer" title="Ver foto do recebimento">
                              <img src={e.fotoUrl} alt="Foto do recebimento" className="h-10 w-10 object-cover rounded border" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          {e.anexoUrl ? (
                            <a
                              href={e.anexoUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-sky-700 hover:underline"
                              title={e.anexoNome || 'Abrir anexo'}
                            >
                              <Paperclip className="h-3.5 w-3.5" />
                              <span className="truncate max-w-[80px]">{e.anexoNome || 'anexo'}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          {canWrite && (
                            <Button variant="ghost" size="icon" onClick={() => excluir(e.id)} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Total: <b>{entregas.length}</b> {entregas.length === 1 ? 'registro' : 'registros'}
      </p>

      {showForm && (
        <NovaEntregaForm
          colaboradorIdInicial={filtroColab}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            carregar()
            toast({ title: 'Entrega registrada com sucesso' })
          }}
        />
      )}

      <ItemVisualizacaoModal
        item={visualizandoItem as ItemVisualizacao | null}
        open={!!visualizandoItem}
        onOpenChange={(o) => !o && setVisualizandoItem(null)}
      />
    </div>
  )
}

function NovaEntregaForm({ colaboradorIdInicial, onClose, onSaved }: { colaboradorIdInicial?: string; onClose: () => void; onSaved: () => void }) {
  const { toast } = useToast()
  const [colaboradores, setColaboradores] = useState<ColaboradorListItem[]>([])
  const [itens, setItens] = useState<ItemOption[]>([])
  const [form, setForm] = useState({
    colaboradorId: colaboradorIdInicial || '',
    itemId: '',
    dataEntrega: todayISO(),
    quantidade: 1,
    observacao: '',
  })
  const [anexo, setAnexo] = useState<File | null>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/colaboradores?incluirDesligados=false')
      .then(r => r.json())
      .then(d => setColaboradores(Array.isArray(d) ? d : []))
  }, [])

  // Quando colaborador muda, carrega itens do posto dele
  useEffect(() => {
    if (!form.colaboradorId) {
      setItens([])
      return
    }
    const colab = colaboradores.find(c => c.id === form.colaboradorId)
    if (!colab?.posto?.id) {
      setItens([])
      return
    }
    fetch(`/api/itens?postoId=${colab.posto.id}`)
      .then(r => r.json())
      .then(d => setItens(Array.isArray(d) ? d : []))
  }, [form.colaboradorId, colaboradores])

  // Item selecionado (para detectar categoria Documento)
  const itemSelecionado = itens.find(i => i.id === form.itemId)
  const isDocumento = itemSelecionado?.categoria.nome === 'Documento'

  const submit = async () => {
    if (!form.colaboradorId) {
      toast({ title: 'Selecione o terceirizado', variant: 'destructive' })
      return
    }
    if (!form.itemId) {
      toast({ title: 'Selecione o item', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      // Se tem anexo, usa multipart/form-data; senão, JSON
      let r: Response
      if (anexo || foto) {
        const fd = new FormData()
        fd.append('colaboradorId', form.colaboradorId)
        fd.append('itemId', form.itemId)
        fd.append('dataEntrega', form.dataEntrega)
        fd.append('quantidade', String(form.quantidade))
        if (form.observacao) fd.append('observacao', form.observacao)
        if (anexo) fd.append('anexo', anexo)
        if (foto) fd.append('foto', foto)
        r = await fetch('/api/entregas', { method: 'POST', body: fd })
      } else {
        r = await fetch('/api/entregas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
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
      onSaved()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Registrar entrega
          </DialogTitle>
          <DialogDescription>
            A lista de itens disponíveis é filtrada pelo posto do terceirizado selecionado. Para documentos, é obrigatório anexar o arquivo.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Terceirizado *</Label>
            <Select value={form.colaboradorId} onValueChange={v => setForm(f => ({ ...f, colaboradorId: v, itemId: '' }))}>
              <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent className="max-h-72">
                {colaboradores.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nomeCompleto} — {c.posto?.nome || 'sem posto'}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Item *</Label>
            <Select value={form.itemId} onValueChange={v => setForm(f => ({ ...f, itemId: v }))} disabled={!form.colaboradorId}>
              <SelectTrigger><SelectValue placeholder={form.colaboradorId ? 'Selecione o item...' : 'Selecione um terceirizado primeiro'} /></SelectTrigger>
              <SelectContent className="max-h-80">
                {itens.map(i => (
                  <SelectItem key={i.id} value={i.id}>
                    <span className="text-xs px-1.5 py-0.5 rounded mr-1.5 bg-muted">{i.categoria.nome}</span>
                    {i.descricao.length > 60 ? i.descricao.slice(0, 57) + '...' : i.descricao}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.colaboradorId && itens.length === 0 && (
              <p className="text-xs text-amber-600 mt-1">
                Nenhum item vinculado ao posto deste terceirizado. Vincule itens ao posto na aba <b>Itens</b>.
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Data *</Label>
              <Input type="date" value={form.dataEntrega} onChange={e => setForm(f => ({ ...f, dataEntrega: e.target.value }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Quantidade</Label>
              <Input type="number" min="1" value={form.quantidade} onChange={e => setForm(f => ({ ...f, quantidade: parseInt(e.target.value) || 1 }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observação</Label>
            <Textarea rows={2} placeholder="Opcional" value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
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
          {isDocumento && (
            <div className="space-y-1.5">
              <Label>Anexo do documento (opcional)</Label>
              <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded p-2">
                <Paperclip className="h-3.5 w-3.5 inline mr-1" />
                Para itens da categoria <b>Documento</b>, você pode anexar o arquivo digitalizado (PDF, imagem, etc).
              </p>
              {!anexo ? (
                <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-md p-4 cursor-pointer hover:bg-accent/50 transition-colors">
                  <Paperclip className="h-5 w-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">Clique para anexar um arquivo</span>
                  <span className="text-xs text-muted-foreground">PDF, JPG, PNG, DOC — máx 10MB</span>
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
                    <div className="text-xs text-muted-foreground">{(anexo.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setAnexo(null)} title="Remover anexo">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
