'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog, DialogContent, DialogBody, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Truck, X, Camera, Paperclip } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { todayISO } from '@/components/app/shared/format'

interface ColaboradorOpt {
  id: string
  nomeCompleto: string
  posto: { id: string; nome: string } | null
}
interface ItemOpt {
  id: string
  descricao: string
  categoria: { nome: string }
}
interface MetaInfo {
  quantidadeEsperada: number
  entregueQtd: number
  saldo: number
}

export interface RegistrarEntregaDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: () => void
  /** Colaborador conhecido. Com travarColaborador, fica fixo; senão só pré-seleciona. */
  colaboradorId?: string
  colaboradorNome?: string
  colaboradorPostoId?: string
  travarColaborador?: boolean
  /** Item conhecido. Com travarItem, fica fixo; senão só pré-seleciona. */
  itemId?: string
  itemDescricao?: string
  itemCategoria?: string
  travarItem?: boolean
  /** Meta já conhecida (checklist). Ausente = busca sozinho quando colab+item definidos. */
  quantidadeEsperada?: number
  entregueQtd?: number
}

export function RegistrarEntregaDialog(props: RegistrarEntregaDialogProps) {
  const { open, onOpenChange, onSaved } = props
  const { toast } = useToast()

  const colabTravado = !!props.travarColaborador
  const itemTravado = !!props.travarItem

  const [colaboradores, setColaboradores] = useState<ColaboradorOpt[]>([])
  const [itens, setItens] = useState<ItemOpt[]>([])
  const [colaboradorId, setColaboradorId] = useState(props.colaboradorId || '')
  const [itemId, setItemId] = useState(props.itemId || '')
  const [dataEntrega, setDataEntrega] = useState(todayISO())
  const [quantidade, setQuantidade] = useState<number>(1)
  const [qtdEditada, setQtdEditada] = useState(false)
  const [observacao, setObservacao] = useState('')
  const [foto, setFoto] = useState<File | null>(null)
  const [anexo, setAnexo] = useState<File | null>(null)
  const [meta, setMeta] = useState<MetaInfo | null>(null)
  const [saving, setSaving] = useState(false)

  // Reset ao abrir
  useEffect(() => {
    if (!open) return
    setColaboradorId(props.colaboradorId || '')
    setItemId(props.itemId || '')
    setDataEntrega(todayISO())
    setQuantidade(1)
    setQtdEditada(false)
    setObservacao('')
    setFoto(null)
    setAnexo(null)
    setMeta(
      props.quantidadeEsperada !== undefined
        ? {
            quantidadeEsperada: props.quantidadeEsperada,
            entregueQtd: props.entregueQtd ?? 0,
            saldo: Math.max(0, props.quantidadeEsperada - (props.entregueQtd ?? 0)),
          }
        : null
    )
  }, [open])

  // Carrega colaboradores quando o seletor é necessário
  useEffect(() => {
    if (!open || colabTravado) return
    fetch('/api/colaboradores?incluirDesligados=false')
      .then(r => r.json())
      .then(d => setColaboradores(Array.isArray(d) ? d : []))
      .catch(() => setColaboradores([]))
  }, [open, colabTravado])

  // Posto do colaborador escolhido (para filtrar itens quando o item não é travado)
  const postoId = colabTravado
    ? props.colaboradorPostoId
    : colaboradores.find(c => c.id === colaboradorId)?.posto?.id

  useEffect(() => {
    if (!open || itemTravado || !postoId) {
      if (!itemTravado) setItens([])
      return
    }
    fetch(`/api/itens?postoId=${postoId}`)
      .then(r => r.json())
      .then(d => setItens(Array.isArray(d) ? d : []))
      .catch(() => setItens([]))
  }, [open, itemTravado, postoId])

  // Busca a meta (saldo) quando colab+item definidos e ela não veio por prop
  useEffect(() => {
    if (!open) return
    if (props.quantidadeEsperada !== undefined) return // já veio pronta
    if (!colaboradorId || !itemId) { setMeta(null); return }
    let cancelado = false
    fetch(`/api/checklist?colaboradorId=${colaboradorId}`)
      .then(r => r.json())
      .then(d => {
        if (cancelado) return
        const todos = Object.values(d.porCategoria || {}).flat() as any[]
        const it = todos.find(i => i.itemId === itemId)
        setMeta(it ? { quantidadeEsperada: it.quantidadeEsperada, entregueQtd: it.entregueQtd, saldo: it.saldo } : null)
      })
      .catch(() => { if (!cancelado) setMeta(null) })
    return () => { cancelado = true }
  }, [open, colaboradorId, itemId, props.quantidadeEsperada])

  // Pré-preenche a quantidade com o saldo (enquanto o usuário não editou)
  useEffect(() => {
    if (!meta || qtdEditada) return
    setQuantidade(Math.max(1, meta.saldo))
  }, [meta, qtdEditada])

  const categoriaItem = itemTravado
    ? props.itemCategoria
    : itens.find(i => i.id === itemId)?.categoria.nome
  const isDocumento = categoriaItem === 'Documento'

  const selecionarFoto = (f: File) => {
    if (f.size > 5 * 1024 * 1024) { toast({ title: 'Foto muito grande', description: 'Máximo 5MB.', variant: 'destructive' }); return }
    setFoto(f)
  }
  const selecionarAnexo = (f: File) => {
    if (f.size > 10 * 1024 * 1024) { toast({ title: 'Anexo muito grande', description: 'Máximo 10MB.', variant: 'destructive' }); return }
    setAnexo(f)
  }

  const submit = async () => {
    if (!colaboradorId) { toast({ title: 'Selecione o terceirizado', variant: 'destructive' }); return }
    if (!itemId) { toast({ title: 'Selecione o item', variant: 'destructive' }); return }
    setSaving(true)
    try {
      let r: Response
      if (anexo || foto) {
        const fd = new FormData()
        fd.append('colaboradorId', colaboradorId)
        fd.append('itemId', itemId)
        fd.append('dataEntrega', dataEntrega)
        fd.append('quantidade', String(quantidade))
        if (observacao) fd.append('observacao', observacao)
        if (anexo) fd.append('anexo', anexo)
        if (foto) fd.append('foto', foto)
        r = await fetch('/api/entregas', { method: 'POST', body: fd })
      } else {
        r = await fetch('/api/entregas', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colaboradorId, itemId, dataEntrega, quantidade, observacao }),
        })
      }
      if (!r.ok) {
        let msg = 'Erro ao registrar'
        try { const d = await r.json(); msg = d.error || msg } catch { msg = `${r.status} ${r.statusText || '— erro de servidor'}` }
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
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="xl" className="p-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Registrar entrega
          </DialogTitle>
          <DialogDescription>
            {itemTravado
              ? 'Confirme a quantidade entregue. Para documentos, você pode anexar o arquivo.'
              : 'A lista de itens é filtrada pelo posto do terceirizado. Para documentos, você pode anexar o arquivo.'}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4">
            {/* Terceirizado */}
            {colabTravado ? (
              <div className="space-y-1.5 min-w-0">
                <Label>Terceirizado</Label>
                <div className="text-sm font-medium rounded-md border bg-muted/40 px-3 py-2 break-words">{props.colaboradorNome || '—'}</div>
              </div>
            ) : (
              <div className="space-y-1.5 min-w-0">
                <Label>Terceirizado *</Label>
                <Select value={colaboradorId} onValueChange={v => { setColaboradorId(v); setItemId(''); setQtdEditada(false) }}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Selecione..." /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    {colaboradores.map(c => (
                      <SelectItem key={c.id} value={c.id} className="max-w-full">
                        <span className="truncate">{c.nomeCompleto} — {c.posto?.nome || 'sem posto'}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Item */}
            {itemTravado ? (
              <div className="space-y-1.5 min-w-0">
                <Label>Item</Label>
                <div className="text-sm rounded-md border bg-muted/40 px-3 py-2 flex items-start gap-2 min-w-0">
                  {props.itemCategoria && <span className="text-xs px-1.5 py-0.5 rounded bg-muted shrink-0">{props.itemCategoria}</span>}
                  <span className="font-medium min-w-0 line-clamp-3" title={props.itemDescricao}>{props.itemDescricao}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 min-w-0">
                <Label>Item *</Label>
                <Select value={itemId} onValueChange={v => { setItemId(v); setQtdEditada(false) }} disabled={!colaboradorId}>
                  <SelectTrigger className="w-full"><SelectValue placeholder={colaboradorId ? 'Selecione o item...' : 'Selecione um terceirizado primeiro'} /></SelectTrigger>
                  <SelectContent className="max-h-80">
                    {itens.map(i => (
                      <SelectItem key={i.id} value={i.id} className="max-w-full">
                        <span className="text-xs px-1.5 py-0.5 rounded bg-muted shrink-0">{i.categoria.nome}</span>
                        <span className="truncate">{i.descricao}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {colaboradorId && itens.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    Nenhum item vinculado ao posto deste terceirizado. Vincule itens ao posto na aba <b>Itens</b>.
                  </p>
                )}
              </div>
            )}

            {/* Meta / saldo — "faltam X" */}
            {meta && (
              <div className="rounded-md border bg-muted/40 px-3 py-2 text-sm flex items-center gap-2 flex-wrap tabular-nums">
                <span>Meta <b>{meta.quantidadeEsperada}</b></span>
                <span className="text-muted-foreground">·</span>
                <span>já entregue <b>{meta.entregueQtd}</b></span>
                <span className="text-muted-foreground">·</span>
                {meta.saldo > 0
                  ? <span className="text-amber-700 dark:text-amber-500">faltam <b>{meta.saldo}</b></span>
                  : <span className="text-emerald-700 dark:text-emerald-500 font-medium">meta já atingida</span>}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5 min-w-0">
                <Label>Data *</Label>
                <Input type="date" className="w-full" value={dataEntrega} onChange={e => setDataEntrega(e.target.value)} />
              </div>
              <div className="space-y-1.5 min-w-0">
                <Label>Quantidade</Label>
                <Input
                  type="number"
                  min="1"
                  className="w-full"
                  value={quantidade}
                  onChange={e => { setQtdEditada(true); setQuantidade(parseInt(e.target.value) || 1) }}
                />
                {meta && !qtdEditada && meta.saldo > 0 && (
                  <p className="text-xs text-muted-foreground">Sugerido: o que falta ({meta.saldo}).</p>
                )}
              </div>
            </div>

            <div className="space-y-1.5 min-w-0">
              <Label>Observação</Label>
              <Textarea rows={2} placeholder="Opcional" value={observacao} onChange={e => setObservacao(e.target.value)} />
            </div>

            {/* Foto do item */}
            <div className="space-y-1.5 min-w-0">
              <Label>Foto do item recebido (opcional)</Label>
              <p className="text-xs text-muted-foreground">
                Registre uma foto do item no recebimento da ORBIS, antes de repassar ao terceirizado.
              </p>
              {!foto ? (
                <label className="flex items-center gap-3 border-2 border-dashed border-border rounded-md p-3 cursor-pointer hover:bg-accent/50 transition-colors min-w-0">
                  <Camera className="h-4 w-4 text-muted-foreground shrink-0" />
                  <span className="text-xs text-muted-foreground">
                    Clique para tirar/anexar uma foto <span className="text-muted-foreground/70">— JPG, PNG, WEBP, máx 5MB</span>
                  </span>
                  <input type="file" className="hidden" accept=".jpg,.jpeg,.png,.gif,.webp" capture="environment"
                    onChange={e => { const f = e.target.files?.[0]; if (f) selecionarFoto(f) }} />
                </label>
              ) : (
                <div className="flex items-center gap-2 border rounded-md p-3 bg-accent/30 min-w-0">
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

            {/* Anexo (Documento) */}
            {isDocumento && (
              <div className="space-y-1.5 min-w-0">
                <Label>Anexo do documento (opcional)</Label>
                <p className="text-xs text-sky-700 bg-sky-50 border border-sky-200 rounded p-2 dark:bg-sky-950/40 dark:border-sky-900 dark:text-sky-300">
                  <Paperclip className="h-3.5 w-3.5 inline mr-1" />
                  Para <b>Documento</b>, você pode anexar o arquivo digitalizado (PDF, imagem, etc).
                </p>
                {!anexo ? (
                  <label className="flex items-center gap-3 border-2 border-dashed border-border rounded-md p-3 cursor-pointer hover:bg-accent/50 transition-colors min-w-0">
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground">
                      Clique para anexar um arquivo <span className="text-muted-foreground/70">— PDF, JPG, PNG, DOC, máx 10MB</span>
                    </span>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.gif,.webp,.doc,.docx"
                      onChange={e => { const f = e.target.files?.[0]; if (f) selecionarAnexo(f) }} />
                  </label>
                ) : (
                  <div className="flex items-center gap-2 border rounded-md p-3 bg-accent/30 min-w-0">
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
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Registrar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
