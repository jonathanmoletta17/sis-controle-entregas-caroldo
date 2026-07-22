'use client'

import { useEffect, useState, useMemo, Fragment } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ArrowLeft, Save, Grid3x3, Search, Copy, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useApp } from '@/components/app/app-context'
import { useCanWrite } from '@/hooks/use-can-write'
import { cn } from '@/lib/utils'

interface Posto { id: string; nome: string; corCapacete: string | null }
interface Vinculo { quantidadeEsperada: number; obrigatorio: boolean }
interface ItemGrade {
  id: string
  descricao: string
  unidade: string
  categoria: { id: string; nome: string }
  vinculos: Record<string, Vinculo>
}
interface Cell { q: string; obrigatorio: boolean }

const chave = (itemId: string, postoId: string) => `${itemId}__${postoId}`

const corHelmet = (cor: string | null) =>
  cor === 'Amarelo' ? 'bg-yellow-400' :
  cor === 'Azul' ? 'bg-blue-500' :
  cor === 'Laranja' ? 'bg-orange-500' :
  cor === 'Verde' ? 'bg-green-500' : 'bg-gray-400'

export function MatrizMetasView() {
  const { toast } = useToast()
  const { setView } = useApp()
  const canWrite = useCanWrite()
  const [postos, setPostos] = useState<Posto[]>([])
  const [itens, setItens] = useState<ItemGrade[]>([])
  const [cells, setCells] = useState<Record<string, Cell>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [copiaOrigem, setCopiaOrigem] = useState('')
  const [copiaDestino, setCopiaDestino] = useState('')

  useEffect(() => {
    fetch('/api/itens/matriz')
      .then(r => r.json())
      .then((d) => {
        setPostos(Array.isArray(d.postos) ? d.postos : [])
        const list: ItemGrade[] = Array.isArray(d.itens) ? d.itens : []
        setItens(list)
        const c: Record<string, Cell> = {}
        for (const it of list) {
          for (const [postoId, v] of Object.entries(it.vinculos)) {
            c[chave(it.id, postoId)] = { q: String(v.quantidadeEsperada), obrigatorio: v.obrigatorio }
          }
        }
        setCells(c)
        // começa filtrado pela primeira categoria (mantém a tela leve)
        const cats = Array.from(new Set(list.map(i => i.categoria?.nome).filter(Boolean)))
        setCategoriaFiltro(cats[0] || 'todas')
      })
      .catch(() => toast({ title: 'Erro ao carregar matriz', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [toast])

  const categorias = useMemo(
    () => Array.from(new Set(itens.map(i => i.categoria?.nome).filter(Boolean))) as string[],
    [itens]
  )

  const setQuantidade = (itemId: string, postoId: string, valor: string) => {
    const digits = valor.replace(/\D/g, '')
    setCells(prev => {
      const k = chave(itemId, postoId)
      const next = { ...prev }
      if (digits === '' || digits === '0') delete next[k]
      else next[k] = { q: digits, obrigatorio: prev[k]?.obrigatorio ?? true }
      return next
    })
    setDirty(true)
  }

  const setObrigatorioCell = (itemId: string, postoId: string, obrigatorio: boolean) => {
    setCells(prev => {
      const k = chave(itemId, postoId)
      if (!prev[k]) return prev
      return { ...prev, [k]: { ...prev[k], obrigatorio } }
    })
    setDirty(true)
  }

  const removerCell = (itemId: string, postoId: string) => {
    setCells(prev => {
      const k = chave(itemId, postoId)
      if (!prev[k]) return prev
      const next = { ...prev }
      delete next[k]
      return next
    })
    setDirty(true)
  }

  const copiarColuna = () => {
    if (!copiaOrigem || !copiaDestino || copiaOrigem === copiaDestino) return
    setCells(prev => {
      const next = { ...prev }
      for (const it of itens) {
        const origem = prev[chave(it.id, copiaOrigem)]
        const destKey = chave(it.id, copiaDestino)
        if (origem) next[destKey] = { ...origem }
        else delete next[destKey]
      }
      return next
    })
    setDirty(true)
    const nomeOrigem = postos.find(p => p.id === copiaOrigem)?.nome
    const nomeDestino = postos.find(p => p.id === copiaDestino)?.nome
    toast({ title: 'Coluna copiada', description: `${nomeOrigem} → ${nomeDestino}. Revise e salve.` })
    setCopiaOrigem(''); setCopiaDestino('')
  }

  const itensFiltrados = useMemo(() => {
    const termo = busca.trim().toLowerCase()
    return itens.filter(it => {
      if (categoriaFiltro && categoriaFiltro !== 'todas' && it.categoria?.nome !== categoriaFiltro) return false
      if (termo && !it.descricao.toLowerCase().includes(termo)) return false
      return true
    })
  }, [itens, categoriaFiltro, busca])

  const grupos = useMemo(() => {
    const map: Record<string, ItemGrade[]> = {}
    for (const it of itensFiltrados) {
      const cat = it.categoria?.nome || 'Sem categoria'
      if (!map[cat]) map[cat] = []
      map[cat].push(it)
    }
    return Object.entries(map)
  }, [itensFiltrados])

  const totalVinculos = Object.keys(cells).length

  const salvar = async () => {
    setSaving(true)
    try {
      const vinculos = Object.entries(cells).map(([k, cell]) => {
        const [itemId, postoId] = k.split('__')
        return { itemId, postoId, quantidadeEsperada: parseInt(cell.q, 10) || 1, obrigatorio: cell.obrigatorio }
      })
      const r = await fetch('/api/itens/matriz', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ itemIds: itens.map(i => i.id), vinculos }),
      })
      if (!r.ok) {
        const d = await r.json().catch(() => ({}))
        throw new Error(d.error || 'Erro ao salvar')
      }
      setDirty(false)
      toast({ title: 'Metas salvas', description: `${vinculos.length} vínculos gravados.` })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" onClick={() => setView('itens')} title="Voltar para Itens">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-2xl font-bold tracking-tight">Configurar metas por posto</h1>
          </div>
          <p className="text-muted-foreground text-sm mt-1 ml-10">
            Cada célula é a quantidade que o posto recebe do item. Clique na célula para editar quantidade,
            marcar obrigatório/opcional ou remover. Célula vazia = não recebe.
          </p>
        </div>
        {canWrite && (
          <Button onClick={salvar} disabled={saving || !dirty}>
            <Save className="h-4 w-4 mr-1.5" /> {saving ? 'Salvando...' : 'Salvar metas'}
          </Button>
        )}
      </div>

      {/* Barra de ferramentas: busca + categorias + copiar coluna */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Buscar item por descrição..." value={busca} onChange={e => setBusca(e.target.value)} className="pl-9" />
            </div>
            {canWrite && postos.length > 1 && (
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Copy className="h-3.5 w-3.5 mr-1.5" /> Copiar coluna
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-72" align="end">
                  <div className="space-y-3">
                    <p className="text-sm font-medium">Copiar kit de um posto para outro</p>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">De (origem)</label>
                      <Select value={copiaOrigem} onValueChange={setCopiaOrigem}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Posto de origem" /></SelectTrigger>
                        <SelectContent>
                          {postos.map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">Para (destino — será substituído)</label>
                      <Select value={copiaDestino} onValueChange={setCopiaDestino}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Posto de destino" /></SelectTrigger>
                        <SelectContent>
                          {postos.filter(p => p.id !== copiaOrigem).map(p => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button
                      size="sm"
                      className="w-full"
                      disabled={!copiaOrigem || !copiaDestino || copiaOrigem === copiaDestino}
                      onClick={copiarColuna}
                    >
                      Copiar
                    </Button>
                    <p className="text-xs text-muted-foreground">Substitui todo o kit do destino pelo da origem. Revise antes de salvar.</p>
                  </div>
                </PopoverContent>
              </Popover>
            )}
          </div>
          {categorias.length > 0 && (
            <Tabs value={categoriaFiltro} onValueChange={setCategoriaFiltro}>
              <TabsList className="flex-wrap h-auto">
                <TabsTrigger value="todas">Todas</TabsTrigger>
                {categorias.map(c => <TabsTrigger key={c} value={c}>{c}</TabsTrigger>)}
              </TabsList>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : itens.length === 0 || postos.length === 0 ? (
            <div className="p-12 text-center">
              <Grid3x3 className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                {postos.length === 0 ? 'Nenhum posto cadastrado.' : 'Nenhum item ativo para configurar.'}
              </p>
            </div>
          ) : itensFiltrados.length === 0 ? (
            <div className="p-12 text-center">
              <Search className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">Nenhum item encontrado com este filtro.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="sticky left-0 z-10 bg-card text-left font-medium p-3 min-w-[260px]">Item</th>
                    {postos.map(p => (
                      <th key={p.id} className="p-2 text-center font-medium min-w-[84px] align-bottom">
                        <div className="flex flex-col items-center gap-1">
                          {p.corCapacete && <span className={cn('h-2 w-2 rounded-full inline-block', corHelmet(p.corCapacete))} />}
                          <span className="text-xs leading-tight">{p.nome}</span>
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {grupos.map(([cat, lista]) => (
                    <Fragment key={`cat-${cat}`}>
                      <tr className="bg-muted/40">
                        <td colSpan={postos.length + 1} className="px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {cat}
                        </td>
                      </tr>
                      {lista.map(it => (
                        <tr key={it.id} className="border-b hover:bg-accent/30">
                          <td className="sticky left-0 z-10 bg-card p-3 align-top">
                            <div className="line-clamp-2 leading-snug" title={it.descricao}>{it.descricao}</div>
                          </td>
                          {postos.map(p => {
                            const cell = cells[chave(it.id, p.id)]
                            return (
                              <td key={p.id} className="p-1.5 text-center">
                                <CellEditor
                                  item={it}
                                  posto={p}
                                  cell={cell}
                                  canWrite={canWrite}
                                  onQuantidade={(v) => setQuantidade(it.id, p.id, v)}
                                  onObrigatorio={(v) => setObrigatorioCell(it.id, p.id, v)}
                                  onRemover={() => removerCell(it.id, p.id)}
                                />
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap text-xs text-muted-foreground">
        <span>
          {itensFiltrados.length} de {itens.length} itens · {postos.length} postos · {totalVinculos} vínculos configurados
          {dirty && ' · alterações não salvas'}
        </span>
        <span className="flex items-center gap-3">
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded border bg-card inline-block" /> obrigatório</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-3 w-6 rounded border border-amber-300 bg-amber-100 dark:border-amber-800 dark:bg-amber-950/50 inline-block" /> opcional</span>
        </span>
      </div>
    </div>
  )
}

function CellEditor({ item, posto, cell, canWrite, onQuantidade, onObrigatorio, onRemover }: {
  item: ItemGrade
  posto: Posto
  cell: Cell | undefined
  canWrite: boolean
  onQuantidade: (v: string) => void
  onObrigatorio: (v: boolean) => void
  onRemover: () => void
}) {
  const preenchida = !!cell
  const opcional = preenchida && !cell!.obrigatorio

  const botao = (
    <button
      type="button"
      disabled={!canWrite}
      className={cn(
        'h-8 w-14 mx-auto rounded-md border text-sm font-semibold tabular-nums transition-colors',
        !preenchida && 'border-dashed text-muted-foreground hover:border-solid hover:bg-accent',
        preenchida && !opcional && 'border-border bg-card hover:bg-accent',
        opcional && 'border-amber-300 bg-amber-100 text-amber-800 hover:bg-amber-200 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300 dark:hover:bg-amber-950/70',
        canWrite ? 'cursor-pointer' : 'cursor-default opacity-70'
      )}
      title={preenchida ? `${cell!.q} ${opcional ? '(opcional)' : '(obrigatório)'}` : 'Não recebe — clique para vincular'}
    >
      {preenchida ? cell!.q : '—'}
    </button>
  )

  if (!canWrite) return botao

  return (
    <Popover>
      <PopoverTrigger asChild>{botao}</PopoverTrigger>
      <PopoverContent className="w-56" align="center">
        <div className="space-y-3">
          <div className="text-xs">
            <div className="font-medium line-clamp-2 leading-snug">{item.descricao}</div>
            <div className="text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full inline-block', corHelmet(posto.corCapacete))} />
              {posto.nome}
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm">Quantidade</span>
            <Input
              type="text"
              inputMode="numeric"
              className="h-8 w-20 text-center tabular-nums"
              placeholder="—"
              value={cell?.q ?? ''}
              onChange={e => onQuantidade(e.target.value)}
              autoFocus
            />
          </div>
          {preenchida && (
            <>
              <div className="flex items-center justify-between">
                <span className="text-sm">Tipo</span>
                <div className="inline-flex rounded-full border overflow-hidden text-xs font-semibold">
                  <button
                    type="button"
                    className={cn('px-3 py-1', !opcional ? 'bg-primary text-primary-foreground' : 'text-muted-foreground')}
                    onClick={() => onObrigatorio(true)}
                  >
                    Obrig.
                  </button>
                  <button
                    type="button"
                    className={cn('px-3 py-1', opcional ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300' : 'text-muted-foreground')}
                    onClick={() => onObrigatorio(false)}
                  >
                    Opc.
                  </button>
                </div>
              </div>
              <button
                type="button"
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive"
                onClick={onRemover}
              >
                <Trash2 className="h-3.5 w-3.5" /> Remover vínculo
              </button>
            </>
          )}
          <p className="text-[11px] text-muted-foreground">Opcional não pesa no percentual de conformidade.</p>
        </div>
      </PopoverContent>
    </Popover>
  )
}
