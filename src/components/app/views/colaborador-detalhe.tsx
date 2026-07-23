'use client'

import { useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Dialog, DialogContent, DialogBody, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import {
  ArrowLeft, Pencil, UserX, UserCheck, History, ClipboardList, FileText,
  AlertTriangle, Truck, Paperclip, Trash2, X, Camera,
} from 'lucide-react'
import { useApp } from '@/components/app/app-context'
import { useToast } from '@/hooks/use-toast'
import { StatusBadge, CorCapaceteBadge } from '@/components/app/shared/badges'
import { formatCPF, formatDate, formatDateTime, todayISO } from '@/components/app/shared/format'
import { ItemVisualizacaoModal, ItemVisualizacao } from '@/components/app/shared/item-visualizacao-modal'
import { useCanWrite } from '@/hooks/use-can-write'
import { cleanupUserUploads, uploadUserFile } from '@/lib/upload-client'
import { useObjectUrl } from '@/hooks/use-object-url'
import { validateFileMetadata, type UploadReference } from '@/lib/uploads'

interface Posto { id: string; nome: string; corCapacete: string | null }
interface ColaboradorDetalhe {
  id: string
  cpf: string
  nomeCompleto: string
  ativo: boolean
  dataAdmissao: string
  dataDesligamento: string | null
  motivoDesligamento: string | null
  observacoes: string | null
  posto: Posto | null
  empresa: { id: string; nome: string } | null
  contrato: { id: string; numero: string; objeto: string } | null
  criadoPor?: { nome: string } | null
  atualizadoPor?: { nome: string } | null
  entregas: Array<{
    id: string
    dataEntrega: string
    quantidade: number
    observacao: string | null
    anexoUrl: string | null
    anexoNome: string | null
    fotoUrl: string | null
    item: { id: string; descricao: string; categoria: { nome: string } }
  }>
  mudancasPosto: Array<{
    id: string
    dataMudanca: string
    motivo: string | null
    postoAnterior: Posto | null
    postoNovo: Posto | null
  }>
  desligamentos: Array<{
    id: string
    dataDesligamento: string
    dataReativacao: string | null
    motivo: string | null
  }>
  _count: { entregas: number; mudancasPosto: number }
}

export function ColaboradorDetalheView() {
  const { selectedColaboradorId, setView } = useApp()
  const canWrite = useCanWrite()
  const { toast } = useToast()
  const [colab, setColab] = useState<ColaboradorDetalhe | null>(null)
  const [loading, setLoading] = useState(true)
  const [showEdit, setShowEdit] = useState(false)
  const [showDesligar, setShowDesligar] = useState(false)
  const [showMudancaPosto, setShowMudancaPosto] = useState(false)
  const [showNovaEntrega, setShowNovaEntrega] = useState(false)
  const [visualizandoItem, setVisualizandoItem] = useState<{ id: string; descricao: string; unidade?: string; categoria: { nome: string }; imagemUrl?: string | null; imagemNome?: string | null } | null>(null)

  const carregar = () => {
    if (!selectedColaboradorId) return
    setLoading(true)
    fetch(`/api/colaboradores/${selectedColaboradorId}`)
      .then(r => r.json())
      .then(d => setColab(d))
      .catch(() => setColab(null))
      .finally(() => setLoading(false))
  }

  useEffect(() => { carregar() }, [selectedColaboradorId])

  if (loading) {
    return <Card><CardContent className="p-6">Carregando...</CardContent></Card>
  }
  if (!colab) {
    return (
      <Card>
        <CardContent className="p-6">
          <p className="text-sm text-muted-foreground">Colaborador não encontrado.</p>
          <Button variant="outline" onClick={() => setView('colaboradores')} className="mt-3">
            <ArrowLeft className="h-4 w-4 mr-1.5" /> Voltar à lista
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <Button variant="ghost" size="icon" onClick={() => setView('colaboradores')} className="-ml-2 shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="min-w-0">
            <h1 className="text-2xl font-bold tracking-tight truncate">{colab.nomeCompleto}</h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap text-sm text-muted-foreground">
              <span className="font-mono tabular-nums">{formatCPF(colab.cpf)}</span>
              {colab.posto && <CorCapaceteBadge cor={colab.posto.corCapacete} />}
              <span>·</span>
              <span>Contrato {colab.contrato?.numero}</span>
              <span>·</span>
              <StatusBadge ativo={colab.ativo} dataDesligamento={colab.dataDesligamento} motivoDesligamento={colab.motivoDesligamento} />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.open(`/relatorio/${colab.id}`, '_blank')
              }
            }}
            title="Abrir relatório deste terceirizado em nova aba para impressão"
          >
            <FileText className="h-4 w-4 mr-1.5" />
            Gerar relatório
          </Button>
          {canWrite && (
            <Button variant="outline" size="sm" onClick={() => setShowMudancaPosto(true)} disabled={!colab.ativo}>
              <History className="h-4 w-4 mr-1.5" />
              Mudar posto
            </Button>
          )}
          {canWrite && (colab.ativo ? (
            <Button variant="outline" size="sm" onClick={() => setShowDesligar(true)} className="text-rose-600 hover:text-rose-700">
              <UserX className="h-4 w-4 mr-1.5" />
              Desligar
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={async () => {
              await fetch(`/api/colaboradores/${colab.id}/reativar`, { method: 'PUT' })
              toast({ title: 'Colaborador reativado' })
              carregar()
            }}>
              <UserCheck className="h-4 w-4 mr-1.5" />
              Reativar
            </Button>
          ))}
          {canWrite && (
            <Button variant="default" size="sm" onClick={() => setShowEdit(true)}>
              <Pencil className="h-4 w-4 mr-1.5" />
              Editar
            </Button>
          )}
        </div>
      </div>

      {/* Banner de desligamento */}
      {!colab.ativo && (
        <Card className="border-rose-200 bg-rose-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-rose-900">
                Desligado em {formatDate(colab.dataDesligamento)}
              </p>
              <p className="text-rose-800 mt-0.5">
                Motivo: {colab.motivoDesligamento || 'não informado'}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumo cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Posto atual</div>
            <div className="text-sm font-medium mt-1">{colab.posto?.nome || '—'}</div>
            {colab.posto?.corCapacete && (
              <div className="mt-2"><CorCapaceteBadge cor={colab.posto.corCapacete} /></div>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Data de admissão</div>
            <div className="text-sm font-medium mt-1">{formatDate(colab.dataAdmissao)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Total de entregas</div>
            <div className="text-sm font-medium mt-1 tabular-nums">{colab._count.entregas}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs text-muted-foreground">Mudanças de posto</div>
            <div className="text-sm font-medium mt-1 tabular-nums">{colab._count.mudancasPosto}</div>
          </CardContent>
        </Card>
      </div>

      {(colab.criadoPor || colab.atualizadoPor) && (
        <p className="text-xs text-muted-foreground">
          {colab.criadoPor && <>Cadastrado por <b className="text-foreground">{colab.criadoPor.nome}</b></>}
          {colab.criadoPor && colab.atualizadoPor && ' · '}
          {colab.atualizadoPor && <>Última edição por <b className="text-foreground">{colab.atualizadoPor.nome}</b></>}
        </p>
      )}

      {/* Observações */}
      {colab.observacoes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <FileText className="h-4 w-4" /> Observações
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm whitespace-pre-line">{colab.observacoes}</p>
          </CardContent>
        </Card>
      )}

      {/* Histórico de mudanças de posto */}
      {colab.mudancasPosto.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <History className="h-4 w-4" />
              Histórico de mudanças de posto
            </CardTitle>
            <CardDescription>
              Mudanças preservadas mesmo após desligamento. É possível excluir um registro registrado por engano — se for o mais recente, o posto atual do colaborador será revertido automaticamente.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Posto anterior</TableHead>
                  <TableHead>→</TableHead>
                  <TableHead>Novo posto</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead className="w-12"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colab.mudancasPosto.map(m => (
                  <TableRow key={m.id}>
                    <TableCell className="tabular-nums">{formatDate(m.dataMudanca)}</TableCell>
                    <TableCell>{m.postoAnterior?.nome || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">→</TableCell>
                    <TableCell className="font-medium">{m.postoNovo?.nome || '—'}</TableCell>
                    <TableCell className="text-muted-foreground">{m.motivo || '—'}</TableCell>
                    <TableCell>
                      {canWrite && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          title="Excluir esta mudança de posto"
                          onClick={async () => {
                            if (!confirm('Excluir este registro de mudança de posto?\n\nSe for o registro mais recente, o posto atual do colaborador será revertido para o anterior.')) return
                            try {
                              const r = await fetch(`/api/mudancas-posto/${m.id}`, { method: 'DELETE' })
                              if (!r.ok) {
                                const d = await r.json().catch(() => ({}))
                                throw new Error(d.error || 'Erro ao excluir')
                              }
                              toast({ title: 'Mudança de posto excluída' })
                              carregar()
                            } catch (e: any) {
                              toast({ title: 'Erro', description: e.message, variant: 'destructive' })
                            }
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Histórico de desligamentos */}
      {colab.desligamentos.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm flex items-center gap-2">
              <UserX className="h-4 w-4" />
              Histórico de desligamentos
            </CardTitle>
            <CardDescription>
              Preservado permanentemente, mesmo após reativações.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Desligado em</TableHead>
                  <TableHead>Reativado em</TableHead>
                  <TableHead>Motivo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {colab.desligamentos.map(d => (
                  <TableRow key={d.id}>
                    <TableCell className="tabular-nums">{formatDate(d.dataDesligamento)}</TableCell>
                    <TableCell className="tabular-nums">
                      {d.dataReativacao ? formatDate(d.dataReativacao) : <span className="text-muted-foreground">ainda desligado</span>}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{d.motivo || '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Histórico de entregas */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="text-sm flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Histórico de entregas
              </CardTitle>
              <CardDescription className="mt-1">
                Todas as entregas registradas para este terceirizado, da mais recente à mais antiga
              </CardDescription>
            </div>
            {canWrite && (
              <Button size="sm" onClick={() => setShowNovaEntrega(true)} disabled={!colab.ativo}>
                <Truck className="h-4 w-4 mr-1.5" />
                Registrar entrega
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {colab.entregas.length === 0 ? (
            <div className="p-12 text-center">
              <Truck className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                Nenhuma entrega registrada ainda. Clique em <b>Registrar entrega</b> para começar.
              </p>
            </div>
          ) : (
            <>
              {/* Mobile: cards empilhados */}
              <div className="md:hidden divide-y">
                {colab.entregas.map(e => (
                  <div key={e.id} className="p-3 space-y-2">
                    <div className="text-xs text-muted-foreground">{formatDate(e.dataEntrega)}</div>
                    <button
                      onClick={() => setVisualizandoItem(e.item)}
                      className="w-full text-left hover:underline"
                      title="Clique para ver a imagem do item"
                    >
                      <span className={`text-xs px-1.5 py-0.5 rounded inline-block mb-1 ${
                        e.item.categoria.nome === 'Materiais' ? 'bg-amber-100 text-amber-800' :
                        e.item.categoria.nome === 'EPI' ? 'bg-rose-100 text-rose-800' :
                        e.item.categoria.nome === 'Uniforme' ? 'bg-violet-100 text-violet-800' :
                        'bg-sky-100 text-sky-800'
                      }`}>
                        {e.item.categoria.nome}
                      </span>
                      <div className="text-sm leading-snug">{e.item.descricao}</div>
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
                      <TableHead className="w-[9%]">Data</TableHead>
                      <TableHead className="w-[9%]">Categoria</TableHead>
                      <TableHead className="w-[38%]">Item</TableHead>
                      <TableHead className="w-[5%] text-center">Qtd</TableHead>
                      <TableHead className="w-[15%]">Observação</TableHead>
                      <TableHead className="w-[12%]" title="Foto do item registrada pelo técnico no momento do recebimento, antes de repassar ao terceirizado">Foto</TableHead>
                      <TableHead className="w-[8%]" title="Documento anexado pelo terceirizado (ex.: ASO, carteira de vacinação) — só para itens da categoria Documento">Anexo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {colab.entregas.map(e => (
                      <TableRow key={e.id}>
                        <TableCell className="tabular-nums whitespace-nowrap align-top text-sm">{formatDate(e.dataEntrega)}</TableCell>
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
                        <TableCell className="align-top">
                          <button
                            onClick={() => setVisualizandoItem(e.item)}
                            className="hover:underline text-left block w-full"
                            title="Clique para ver a imagem do item"
                          >
                            <div className="line-clamp-3 text-sm leading-snug">{e.item.descricao}</div>
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
                              <span className="truncate max-w-[60px]">{e.anexoNome || 'anexo'}</span>
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
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

      {/* Modais */}
      {showEdit && (
        <EditarColaboradorForm colab={colab} onClose={() => setShowEdit(false)} onSaved={() => { setShowEdit(false); carregar() }} />
      )}
      {showDesligar && (
        <DesligarColaboradorForm colab={colab} onClose={() => setShowDesligar(false)} onDone={() => { setShowDesligar(false); carregar() }} />
      )}
      {showMudancaPosto && (
        <MudancaPostoForm colab={colab} onClose={() => setShowMudancaPosto(false)} onDone={() => { setShowMudancaPosto(false); carregar() }} />
      )}
      {showNovaEntrega && (
        <NovaEntregaForm colab={colab} onClose={() => setShowNovaEntrega(false)} onDone={() => { setShowNovaEntrega(false); carregar() }} />
      )}

      <ItemVisualizacaoModal
        item={visualizandoItem as ItemVisualizacao | null}
        open={!!visualizandoItem}
        onOpenChange={(o) => !o && setVisualizandoItem(null)}
      />
    </div>
  )
}

function EditarColaboradorForm({ colab, onClose, onSaved }: {
  colab: ColaboradorDetalhe; onClose: () => void; onSaved: () => void
}) {
  const { toast } = useToast()
  const [form, setForm] = useState({
    nomeCompleto: colab.nomeCompleto,
    observacoes: colab.observacoes || '',
    dataAdmissao: colab.dataAdmissao.slice(0, 10),
  })
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const r = await fetch(`/api/colaboradores/${colab.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.error || 'Erro ao salvar')
      }
      toast({ title: 'Alterações salvas' })
      onSaved()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar terceirizado</DialogTitle>
          <DialogDescription>CPF e empresa não podem ser alterados (empresa é sempre ORBIS neste contrato).</DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>CPF</Label>
            <Input value={formatCPF(colab.cpf)} disabled className="font-mono bg-muted" />
          </div>
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={form.nomeCompleto} onChange={e => setForm(f => ({ ...f, nomeCompleto: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Empresa</Label>
              <Input value="ORBIS" disabled className="bg-muted" />
            </div>
            <div className="space-y-1.5">
              <Label>Admissão</Label>
              <Input type="date" value={form.dataAdmissao} onChange={e => setForm(f => ({ ...f, dataAdmissao: e.target.value }))} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Observações</Label>
            <Textarea rows={3} value={form.observacoes} onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DesligarColaboradorForm({ colab, onClose, onDone }: {
  colab: ColaboradorDetalhe; onClose: () => void; onDone: () => void
}) {
  const { toast } = useToast()
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const r = await fetch(`/api/colaboradores/${colab.id}?motivo=${encodeURIComponent(motivo || 'Desligamento registrado')}`, {
        method: 'DELETE',
      })
      if (!r.ok) throw new Error('Erro ao desligar')
      toast({ title: 'Colaborador desligado', description: 'Histórico preservado no sistema.' })
      onDone()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Desligar terceirizado
          </DialogTitle>
          <DialogDescription>
            O terceirizado será marcado como desligado, mas <b>todo o histórico de entregas e mudanças de posto será preservado</b>. Esta ação pode ser revertida depois.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 py-2">
          <div className="text-sm">
            <b>{colab.nomeCompleto}</b> ({formatCPF(colab.cpf)})
          </div>
          <div className="space-y-1.5">
            <Label>Motivo do desligamento</Label>
            <Textarea
              rows={2}
              placeholder="Ex.: fim do contrato, transferência para outra obra, demissão..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button variant="destructive" onClick={submit} disabled={saving}>
            {saving ? 'Desligando...' : 'Confirmar desligamento'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function MudancaPostoForm({ colab, onClose, onDone }: {
  colab: ColaboradorDetalhe; onClose: () => void; onDone: () => void
}) {
  const { toast } = useToast()
  const [postos, setPostos] = useState<Posto[]>([])
  const [novoPostoId, setNovoPostoId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/postos').then(r => r.json()).then(p => setPostos(Array.isArray(p) ? p : []))
  }, [])

  const submit = async () => {
    if (!novoPostoId) {
      toast({ title: 'Selecione o novo posto', variant: 'destructive' })
      return
    }
    if (novoPostoId === colab.posto?.id) {
      toast({ title: 'Selecione um posto diferente do atual', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const r = await fetch(`/api/colaboradores/${colab.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postoId: novoPostoId,
          motivoMudancaPosto: motivo || 'Mudança de posto registrada manualmente',
        }),
      })
      if (!r.ok) throw new Error('Erro ao registrar mudança')
      toast({ title: 'Mudança de posto registrada', description: 'Histórico atualizado.' })
      onDone()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <History className="h-5 w-5" />
            Mudança de posto
          </DialogTitle>
          <DialogDescription>
            O posto anterior será registrado no histórico do colaborador.
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 py-2">
          <div className="text-sm">
            <b>{colab.nomeCompleto}</b>
            <div className="text-muted-foreground mt-1">
              Posto atual: <b>{colab.posto?.nome || '—'}</b>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Novo posto</Label>
            <Select value={novoPostoId} onValueChange={setNovoPostoId}>
              <SelectTrigger><SelectValue placeholder="Selecione o novo posto..." /></SelectTrigger>
              <SelectContent>
                {postos.filter(p => p.id !== colab.posto?.id).map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <span className="flex items-center gap-2">
                      {p.corCapacete && (
                        <span className={`h-2 w-2 rounded-full inline-block ${
                          p.corCapacete === 'Amarelo' ? 'bg-yellow-400' :
                          p.corCapacete === 'Azul' ? 'bg-blue-500' :
                          p.corCapacete === 'Laranja' ? 'bg-orange-500' :
                          p.corCapacete === 'Verde' ? 'bg-green-500' : 'bg-gray-400'
                        }`} />
                      )}
                      {p.nome}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Motivo (opcional)</Label>
            <Textarea
              rows={2}
              placeholder="Ex.: transferência interna, mudança de função..."
              value={motivo}
              onChange={e => setMotivo(e.target.value)}
            />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Registrar mudança'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function NovaEntregaForm({ colab, onClose, onDone }: {
  colab: ColaboradorDetalhe; onClose: () => void; onDone: () => void
}) {
  const { toast } = useToast()
  const [itens, setItens] = useState<Array<{ id: string; descricao: string; categoria: { nome: string } }>>([])
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('')
  const [form, setForm] = useState({
    itemId: '',
    dataEntrega: todayISO(),
    quantidade: 1,
    observacao: '',
  })
  const [anexo, setAnexo] = useState<File | null>(null)
  const [foto, setFoto] = useState<File | null>(null)
  const fotoPreviewUrl = useObjectUrl(foto)
  const [saving, setSaving] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<number | null>(null)
  const idempotencyKey = useRef(crypto.randomUUID())

  const selecionarFoto = (f: File) => {
    try {
      validateFileMetadata(f, 'delivery-photo')
      setFoto(f)
    } catch (error) {
      toast({ title: 'Foto inválida', description: error instanceof Error ? error.message : 'Selecione outro arquivo.', variant: 'destructive' })
    }
  }

  const selecionarAnexo = (f: File) => {
    try {
      validateFileMetadata(f, 'delivery-attachment')
      setAnexo(f)
    } catch (error) {
      toast({ title: 'Anexo inválido', description: error instanceof Error ? error.message : 'Selecione outro arquivo.', variant: 'destructive' })
    }
  }

  useEffect(() => {
    // Carregar itens do posto atual do colaborador
    fetch(`/api/itens?postoId=${colab.posto?.id || ''}`)
      .then(r => r.json())
      .then(d => setItens(Array.isArray(d) ? d : []))
  }, [colab.posto?.id])

  const itensFiltrados = categoriaFiltro
    ? itens.filter(i => i.categoria.nome === categoriaFiltro)
    : itens

  const itemSelecionado = itens.find(i => i.id === form.itemId)
  const isDocumento = itemSelecionado?.categoria.nome === 'Documento'

  const submit = async () => {
    if (!form.itemId) {
      toast({ title: 'Selecione um item', variant: 'destructive' })
      return
    }
    setSaving(true)
    const enviados: Array<{ reference: UploadReference; purpose: 'delivery-photo' | 'delivery-attachment' }> = []
    try {
      let fotoEnviada: UploadReference | null = null
      let anexoEnviado: UploadReference | null = null
      if (foto) {
        setUploadProgress(0)
        fotoEnviada = await uploadUserFile(foto, 'delivery-photo', setUploadProgress)
        enviados.push({ reference: fotoEnviada, purpose: 'delivery-photo' })
      }
      if (anexo) {
        setUploadProgress(0)
        anexoEnviado = await uploadUserFile(anexo, 'delivery-attachment', setUploadProgress)
        enviados.push({ reference: anexoEnviado, purpose: 'delivery-attachment' })
      }
      const r = await fetch('/api/entregas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          colaboradorId: colab.id,
          foto: fotoEnviada,
          anexo: anexoEnviado,
          idempotencyKey: idempotencyKey.current,
        }),
      })
      if (!r.ok) {
        let msg = 'Erro ao registrar'
        try {
          const d = await r.json()
          msg = d.error || msg
          if (d.requestId) msg += ` (protocolo ${d.requestId})`
        } catch {
          msg = `${r.status} ${r.statusText || '— erro de servidor'}`
        }
        throw new Error(msg)
      }
      toast({ title: 'Entrega registrada' })
      onDone()
    } catch (e: any) {
      await cleanupUserUploads(enviados)
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
      setUploadProgress(null)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="xl" className="p-0">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Registrar entrega
          </DialogTitle>
          <DialogDescription>
            Para <b>{colab.nomeCompleto}</b> ({colab.posto?.nome})
          </DialogDescription>
        </DialogHeader>
        <DialogBody className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Categoria</Label>
            <Select value={categoriaFiltro || '_todas'} onValueChange={v => setCategoriaFiltro(v === '_todas' ? '' : v)}>
              <SelectTrigger><SelectValue placeholder="Todas as categorias" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_todas">Todas</SelectItem>
                <SelectItem value="Materiais">Materiais</SelectItem>
                <SelectItem value="EPI">EPI</SelectItem>
                <SelectItem value="Uniforme">Uniforme</SelectItem>
                <SelectItem value="Documento">Documento</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Item *</Label>
            <Select value={form.itemId} onValueChange={v => setForm(f => ({ ...f, itemId: v }))}>
              <SelectTrigger><SelectValue placeholder="Selecione o item entregue..." /></SelectTrigger>
              <SelectContent className="max-h-80">
                {itensFiltrados.map(i => (
                  <SelectItem key={i.id} value={i.id} className="max-w-full">
                    <span className="text-xs px-1.5 py-0.5 rounded bg-muted shrink-0">
                      {i.categoria.nome}
                    </span>
                    <span className="truncate">{i.descricao}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Lista de itens esperados para o posto <b>{colab.posto?.nome}</b>.
            </p>
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
            <Textarea rows={2} placeholder="Ex.: item com defeito visual, entrega parcial..." value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} />
          </div>
          <div className="space-y-1.5">
            <Label>Foto do item recebido (opcional)</Label>
            <p className="text-xs text-muted-foreground">
              Registre uma foto do item no momento do recebimento da ORBIS, antes de repassar ao terceirizado.
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
                    if (f) selecionarFoto(f)
                  }}
                />
              </label>
            ) : (
              <div className="flex items-center gap-2 border rounded-md p-3 bg-accent/30">
                {fotoPreviewUrl && <img src={fotoPreviewUrl} alt="" className="h-10 w-10 object-cover rounded border shrink-0" />}
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
                      if (f) selecionarAnexo(f)
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
        </DialogBody>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? (uploadProgress === null ? 'Salvando...' : `Enviando... ${uploadProgress}%`) : 'Registrar entrega'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
