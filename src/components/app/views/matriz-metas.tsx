'use client'

import { useEffect, useState, useMemo, Fragment } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Save, Grid3x3 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useApp } from '@/components/app/app-context'
import { useCanWrite } from '@/hooks/use-can-write'

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
      })
      .catch(() => toast({ title: 'Erro ao carregar matriz', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [toast])

  const setQuantidade = (itemId: string, postoId: string, valor: string) => {
    const digits = valor.replace(/\D/g, '')
    setCells(prev => {
      const k = chave(itemId, postoId)
      const next = { ...prev }
      if (digits === '' || digits === '0') {
        delete next[k]
      } else {
        next[k] = { q: digits, obrigatorio: prev[k]?.obrigatorio ?? true }
      }
      return next
    })
    setDirty(true)
  }

  const grupos = useMemo(() => {
    const map: Record<string, ItemGrade[]> = {}
    for (const it of itens) {
      const cat = it.categoria?.nome || 'Sem categoria'
      if (!map[cat]) map[cat] = []
      map[cat].push(it)
    }
    return Object.entries(map)
  }, [itens])

  const totalVinculos = Object.keys(cells).length

  const salvar = async () => {
    setSaving(true)
    try {
      const vinculos = Object.entries(cells).map(([k, cell]) => {
        const [itemId, postoId] = k.split('__')
        return {
          itemId,
          postoId,
          quantidadeEsperada: parseInt(cell.q, 10) || 1,
          obrigatorio: cell.obrigatorio,
        }
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
            Defina quantos de cada item cada posto deve receber. Deixe em branco para não vincular.
            Marcar obrigatório/opcional é feito no formulário do item.
          </p>
        </div>
        {canWrite && (
          <Button onClick={salvar} disabled={saving || !dirty}>
            <Save className="h-4 w-4 mr-1.5" /> {saving ? 'Salvando...' : 'Salvar metas'}
          </Button>
        )}
      </div>

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
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="sticky left-0 z-10 bg-card text-left font-medium p-3 min-w-[260px]">Item</th>
                    {postos.map(p => (
                      <th key={p.id} className="p-2 text-center font-medium min-w-[84px] align-bottom">
                        <div className="flex flex-col items-center gap-1">
                          {p.corCapacete && (
                            <span className={`h-2 w-2 rounded-full inline-block ${
                              p.corCapacete === 'Amarelo' ? 'bg-yellow-400' :
                              p.corCapacete === 'Azul' ? 'bg-blue-500' :
                              p.corCapacete === 'Laranja' ? 'bg-orange-500' :
                              p.corCapacete === 'Verde' ? 'bg-green-500' : 'bg-gray-400'
                            }`} />
                          )}
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
                                <Input
                                  type="text"
                                  inputMode="numeric"
                                  disabled={!canWrite}
                                  className="h-8 w-16 mx-auto text-center tabular-nums"
                                  placeholder="—"
                                  value={cell?.q ?? ''}
                                  onChange={e => setQuantidade(it.id, p.id, e.target.value)}
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

      <p className="text-xs text-muted-foreground">
        {itens.length} itens × {postos.length} postos · {totalVinculos} vínculos configurados
        {dirty && ' · alterações não salvas'}
      </p>
    </div>
  )
}
