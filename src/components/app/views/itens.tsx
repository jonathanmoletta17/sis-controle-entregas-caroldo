'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Package, Pencil, ImagePlus, X, ImageOff } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { CategoriaBadge } from '@/components/app/shared/badges'
import { ItemVisualizacaoModal, ItemVisualizacao } from '@/components/app/shared/item-visualizacao-modal'
import { useCanWrite } from '@/hooks/use-can-write'

interface Categoria { id: string; nome: string; descricao: string | null }
interface Posto { id: string; nome: string; corCapacete: string | null }
interface Item {
  id: string
  descricao: string
  unidade: string
  imagemUrl: string | null
  imagemNome: string | null
  ativo: boolean
  categoriaId: string
  categoria: Categoria
  postos?: Array<{ posto: Posto }>
  _count?: { entregas: number }
}

export function ItensView() {
  const { toast } = useToast()
  const canWrite = useCanWrite()
  const [itens, setItens] = useState<Item[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [postos, setPostos] = useState<Posto[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [showForm, setShowForm] = useState(false)
  const [editItem, setEditItem] = useState<Item | null>(null)
  const [visualizando, setVisualizando] = useState<Item | null>(null)

  const carregar = useCallback(() => {
    setLoading(true)
    fetch('/api/itens')
      .then(r => r.json())
      .then(d => setItens(Array.isArray(d) ? d : []))
      .catch(() => setItens([]))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    Promise.all([
      fetch('/api/itens').then(r => r.json()),
      fetch('/api/postos').then(r => r.json()),
    ]).then(([i, p]) => {
      setItens(Array.isArray(i) ? i : [])
      const cats = Array.isArray(i) ? Array.from(new Set(i.map((x: Item) => x.categoria.id)))
        .map(id => i.find((x: Item) => x.categoria.id === id)!.categoria) : []
      setCategorias(cats)
      setPostos(Array.isArray(p) ? p : [])
      setLoading(false)
    })
  }, [])

  useEffect(() => { carregar() }, [carregar])

  const filtrados = itens.filter(i => {
    if (categoriaFiltro !== 'todas' && i.categoria.nome !== categoriaFiltro) return false
    if (busca.trim() && !i.descricao.toLowerCase().includes(busca.toLowerCase())) return false
    return true
  })

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Itens</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Catálogo central de materiais, EPIs, uniformes e documentos — clique em um item para ver a imagem
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setShowForm(true)}>
            <Plus className="h-4 w-4 mr-1.5" /> Novo item
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar item por descrição..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
            </div>
            <Tabs value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <TabsList>
                <TabsTrigger value="todas">Todas</TabsTrigger>
                {categorias.map(c => (
                  <TabsTrigger key={c.id} value={c.nome}>{c.nome}</TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : filtrados.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhum item encontrado com este filtro.</p>
            </div>
          ) : (
            <>
              {/* Mobile: cards empilhados */}
              <div className="md:hidden divide-y">
                {filtrados.slice(0, 200).map(i => (
                  <div key={i.id} className="p-3 flex gap-3 items-start cursor-pointer hover:bg-accent/50" onClick={() => setVisualizando(i)}>
                    {i.imagemUrl ? (
                      <img
                        src={i.imagemUrl}
                        alt=""
                        className="h-12 w-12 object-cover rounded border bg-muted shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
                      />
                    ) : (
                      <div className="h-12 w-12 rounded border bg-muted flex items-center justify-center shrink-0">
                        <ImageOff className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <CategoriaBadge categoria={i.categoria.nome} />
                        {i.ativo ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </div>
                      <div className="text-sm leading-snug line-clamp-2">{i.descricao}</div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {(i.postos || []).slice(0, 3).map(p => (
                          <Badge key={p.posto.id} variant="outline" className="text-xs">{p.posto.nome}</Badge>
                        ))}
                        {(i.postos || []).length > 3 && (
                          <Badge variant="outline" className="text-xs">+{(i.postos || []).length - 3}</Badge>
                        )}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{i._count?.entregas || 0} entregas</div>
                    </div>
                    {canWrite && (
                      <Button variant="ghost" size="icon" className="shrink-0" onClick={(e) => { e.stopPropagation(); setEditItem(i) }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop/tablet: tabela */}
              <div className="hidden md:block">
                <Table className="table-fixed">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[5%]"></TableHead>
                      <TableHead className="w-[40%]">Descrição</TableHead>
                      <TableHead className="w-[10%]">Categoria</TableHead>
                      <TableHead className="w-[24%]">Postos vinculados</TableHead>
                      <TableHead className="w-[7%] text-center">Entregas</TableHead>
                      <TableHead className="w-[9%]">Status</TableHead>
                      <TableHead className="w-[5%]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtrados.slice(0, 200).map(i => (
                      <TableRow
                        key={i.id}
                        className="cursor-pointer hover:bg-accent/50"
                        onClick={() => setVisualizando(i)}
                      >
                        <TableCell className="align-top">
                          {i.imagemUrl ? (
                            <img
                              src={i.imagemUrl}
                              alt=""
                              className="h-10 w-10 object-cover rounded border bg-muted"
                              onError={(e) => {
                                (e.target as HTMLImageElement).style.display = 'none'
                              }}
                            />
                          ) : (
                            <div className="h-10 w-10 rounded border bg-muted flex items-center justify-center">
                              <ImageOff className="h-3.5 w-3.5 text-muted-foreground opacity-50" />
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="align-top">
                          <div className="line-clamp-3 text-sm leading-snug whitespace-normal break-words" title={i.descricao}>
                            {i.descricao}
                          </div>
                        </TableCell>
                        <TableCell className="align-top"><CategoriaBadge categoria={i.categoria.nome} /></TableCell>
                        <TableCell className="align-top">
                          <div className="flex flex-wrap gap-1">
                            {(i.postos || []).slice(0, 3).map(p => (
                              <Badge key={p.posto.id} variant="outline" className="text-xs">
                                {p.posto.nome}
                              </Badge>
                            ))}
                            {(i.postos || []).length > 3 && (
                              <Badge variant="outline" className="text-xs">+{(i.postos || []).length - 3}</Badge>
                            )}
                            {(i.postos || []).length === 0 && <span className="text-xs text-muted-foreground">—</span>}
                          </div>
                        </TableCell>
                        <TableCell className="text-center tabular-nums align-top">{i._count?.entregas || 0}</TableCell>
                        <TableCell className="align-top">
                          {i.ativo ? (
                            <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="align-top" onClick={(e) => e.stopPropagation()}>
                          {canWrite && (
                            <Button variant="ghost" size="icon" onClick={() => setEditItem(i)}>
                              <Pencil className="h-3.5 w-3.5" />
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
        Exibindo {filtrados.length > 200 ? '200 de ' : ''}{filtrados.length} {filtrados.length === 1 ? 'item' : 'itens'}
        {filtrados.length > 200 && ' (limite de exibição: 200)'} · clique na linha para ver a imagem do item
      </p>

      {showForm && (
        <ItemForm
          categorias={categorias}
          postos={postos}
          onClose={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            carregar()
            toast({ title: 'Item criado' })
          }}
        />
      )}
      {editItem && (
        <ItemForm
          categorias={categorias}
          postos={postos}
          item={editItem}
          onClose={() => setEditItem(null)}
          onSaved={() => {
            setEditItem(null)
            carregar()
            toast({ title: 'Item atualizado' })
          }}
        />
      )}

      <ItemVisualizacaoModal
        item={visualizando as ItemVisualizacao | null}
        open={!!visualizando}
        onOpenChange={(o) => !o && setVisualizando(null)}
      />
    </div>
  )
}

function ItemForm({ categorias, postos, item, onClose, onSaved }: {
  categorias: Categoria[]
  postos: Posto[]
  item?: Item | null
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    descricao: item?.descricao || '',
    unidade: item?.unidade || '1',
    categoriaId: item?.categoriaId || categorias[0]?.id || '',
    ativo: item?.ativo !== false,
  })
  const [postosSelecionados, setPostosSelecionados] = useState<string[]>(
    item?.postos?.map(p => p.posto.id) || []
  )
  const [imagem, setImagem] = useState<File | null>(null)
  const [imagemAtualRemovida, setImagemAtualRemovida] = useState(false)
  const [saving, setSaving] = useState(false)

  const togglePosto = (id: string) => {
    setPostosSelecionados(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id])
  }

  const submit = async () => {
    if (!form.descricao.trim() || form.descricao.length < 3) {
      toast({ title: 'Descrição obrigatória (mín 3 caracteres)', variant: 'destructive' })
      return
    }
    if (!form.categoriaId) {
      toast({ title: 'Categoria obrigatória', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const url = item ? `/api/itens/${item.id}` : '/api/itens'
      const method = item ? 'PUT' : 'POST'
      let r: Response
      if (imagem || imagemAtualRemovida) {
        const fd = new FormData()
        fd.append('descricao', form.descricao)
        fd.append('unidade', form.unidade)
        fd.append('categoriaId', form.categoriaId)
        fd.append('ativo', String(form.ativo))
        fd.append('postos', JSON.stringify(postosSelecionados))
        if (imagem) fd.append('imagem', imagem)
        if (imagemAtualRemovida) fd.append('removerImagem', 'true')
        r = await fetch(url, { method, body: fd })
      } else {
        r = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...form, postos: postosSelecionados }),
        })
      }
      if (!r.ok) {
        let msg = 'Erro ao salvar'
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
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{item ? 'Editar item' : 'Novo item'}</DialogTitle>
          <DialogDescription>
            Item do catálogo. Vincule a um ou mais postos para que apareça no checklist.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Descrição *</Label>
            <Textarea rows={3} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: Plaina elétrica profissional 82mm, 700W, 220v..." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Categoria *</Label>
              <Select value={form.categoriaId} onValueChange={v => setForm(f => ({ ...f, categoriaId: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {categorias.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Unidade</Label>
              <Input
                type="number"
                min="1"
                step="1"
                inputMode="numeric"
                pattern="[0-9]*"
                value={form.unidade}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '')
                  setForm(f => ({ ...f, unidade: v || '1' }))
                }}
                placeholder="1"
              />
              <p className="text-xs text-muted-foreground">Apenas números inteiros positivos.</p>
            </div>
          </div>

          {/* Imagem do item */}
          <div className="space-y-1.5">
            <Label>Imagem ilustrativa (opcional)</Label>
            {item?.imagemUrl && !imagemAtualRemovida && !imagem ? (
              <div className="space-y-2">
                <div className="flex items-center gap-3 border rounded-md p-3 bg-accent/30">
                  <img src={item.imagemUrl} alt="" className="h-16 w-16 object-cover rounded border" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">Imagem atual</div>
                    <div className="text-xs text-muted-foreground">{item.imagemNome || 'sem nome'}</div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                    onClick={() => setImagemAtualRemovida(true)}
                    title="Remover imagem atual"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <Button variant="outline" size="sm" onClick={() => {
                  const input = document.createElement('input')
                  input.type = 'file'
                  input.accept = '.jpg,.jpeg,.png,.webp,.gif'
                  input.onchange = (e) => {
                    const f = (e.target as HTMLInputElement).files?.[0]
                    if (f) setImagem(f)
                  }
                  input.click()
                }}>
                  <ImagePlus className="h-3.5 w-3.5 mr-1.5" /> Trocar imagem
                </Button>
              </div>
            ) : !imagem ? (
              <label className="flex flex-col items-center justify-center gap-1.5 border-2 border-dashed border-border rounded-md p-6 cursor-pointer hover:bg-accent/50 transition-colors">
                <ImagePlus className="h-6 w-6 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Clique para anexar uma imagem</span>
                <span className="text-xs text-muted-foreground">JPG, PNG, WEBP — máx 5MB</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".jpg,.jpeg,.png,.webp,.gif"
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) setImagem(f)
                  }}
                />
              </label>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-3 border rounded-md p-3 bg-accent/30">
                  <img src={URL.createObjectURL(imagem)} alt="" className="h-16 w-16 object-cover rounded border" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{imagem.name}</div>
                    <div className="text-xs text-muted-foreground">{(imagem.size / 1024).toFixed(1)} KB</div>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => setImagem(null)} title="Remover imagem">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
            {imagemAtualRemovida && !imagem && (
              <p className="text-xs text-amber-600">Imagem atual será removida ao salvar.</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label>Postos vinculados</Label>
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              {postos.map(p => (
                <label key={p.id} className="flex items-center gap-2 cursor-pointer hover:bg-accent/50 -mx-1 px-1 py-0.5 rounded">
                  <Checkbox
                    checked={postosSelecionados.includes(p.id)}
                    onCheckedChange={() => togglePosto(p.id)}
                  />
                  <span className="text-sm flex-1">{p.nome}</span>
                  {p.corCapacete && (
                    <span className={`h-2 w-2 rounded-full inline-block ${
                      p.corCapacete === 'Amarelo' ? 'bg-yellow-400' :
                      p.corCapacete === 'Azul' ? 'bg-blue-500' :
                      p.corCapacete === 'Laranja' ? 'bg-orange-500' :
                      p.corCapacete === 'Verde' ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  )}
                </label>
              ))}
              {postos.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhum posto cadastrado.</p>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              {postosSelecionados.length} {postosSelecionados.length === 1 ? 'posto selecionado' : 'postos selecionados'}
            </p>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={form.ativo} onCheckedChange={(v) => setForm(f => ({ ...f, ativo: !!v }))} />
            <span className="text-sm">Ativo</span>
          </label>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
