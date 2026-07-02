'use client'

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { CategoriaBadge } from '@/components/app/shared/badges'
import { Package, ImageOff } from 'lucide-react'

export interface ItemVisualizacao {
  id: string
  descricao: string
  unidade: string
  categoria: { nome: string }
  imagemUrl?: string | null
  imagemNome?: string | null
  postos?: Array<{ posto: { id: string; nome: string; corCapacete: string | null } }>
  _count?: { entregas: number }
  quantidadeEsperada?: number
  obrigatorio?: boolean
  // extras opcionais (entregas, etc.)
  entregue?: boolean
  ultimaEntrega?: string | null
}

interface Props {
  item: ItemVisualizacao | null
  open: boolean
  onOpenChange: (o: boolean) => void
}

export function ItemVisualizacaoModal({ item, open, onOpenChange }: Props) {
  if (!item) return null

  // Defensivo: garantir campos obrigatórios
  const categoriaNome = item.categoria?.nome || '—'
  const unidade = item.unidade || '1'
  const postos = item.postos || []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <CategoriaBadge categoria={categoriaNome} />
            <span className="text-muted-foreground font-normal text-sm">Unidade: {unidade}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">Detalhes do item</DialogDescription>
        </DialogHeader>

        {/* Imagem do item */}
        <div className="flex justify-center items-center bg-muted/40 rounded-md p-4 min-h-[200px]">
          {item.imagemUrl ? (
            <img
              src={item.imagemUrl}
              alt={item.descricao}
              className="max-h-[400px] max-w-full object-contain rounded"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-12">
              <ImageOff className="h-10 w-10 opacity-40" />
              <p className="text-sm">Sem imagem cadastrada para este item</p>
            </div>
          )}
        </div>

        {/* Descrição */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-1">Descrição</h3>
          <p className="text-sm leading-relaxed">{item.descricao}</p>
        </div>

        {/* Postos vinculados */}
        {postos.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground mb-2">Postos vinculados ({postos.length})</h3>
            <div className="flex flex-wrap gap-1.5">
              {postos.map(p => (
                <Badge key={p.posto.id} variant="outline" className="text-xs gap-1.5">
                  {p.posto.corCapacete && (
                    <span className={`h-2 w-2 rounded-full inline-block ${
                      p.posto.corCapacete === 'Amarelo' ? 'bg-yellow-400' :
                      p.posto.corCapacete === 'Azul' ? 'bg-blue-500' :
                      p.posto.corCapacete === 'Laranja' ? 'bg-orange-500' :
                      p.posto.corCapacete === 'Verde' ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  )}
                  {p.posto.nome}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Estatísticas */}
        {(item._count?.entregas !== undefined || item.entregue !== undefined) && (
          <div className="grid grid-cols-2 gap-3 pt-2 border-t">
            {item._count?.entregas !== undefined && (
              <div>
                <div className="text-xs text-muted-foreground">Total de entregas registradas</div>
                <div className="text-lg font-semibold tabular-nums">{item._count.entregas}</div>
              </div>
            )}
            {item.entregue !== undefined && (
              <div>
                <div className="text-xs text-muted-foreground">Status no checklist</div>
                <div className="text-lg font-semibold">
                  {item.entregue ? (
                    <span className="text-emerald-600">✓ Entregue</span>
                  ) : (
                    <span className="text-muted-foreground">○ Pendente</span>
                  )}
                </div>
                {item.ultimaEntrega && (
                  <div className="text-xs text-muted-foreground">
                    Última: {new Date(item.ultimaEntrega).toLocaleDateString('pt-BR')}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
