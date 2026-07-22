'use client'

import { useEffect, useState, useCallback } from 'react'
import { Card, CardContent } from '@/components/ui/card'
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
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Switch } from '@/components/ui/switch'
import { Skeleton } from '@/components/ui/skeleton'
import { Plus, Search, Users, UserPlus, AlertTriangle } from 'lucide-react'
import { useApp } from '@/components/app/app-context'
import { useCanWrite } from '@/hooks/use-can-write'
import { useToast } from '@/hooks/use-toast'
import { StatusBadge, CorCapaceteBadge } from '@/components/app/shared/badges'
import { formatCPF, formatDate, todayISO } from '@/components/app/shared/format'

interface Posto { id: string; nome: string; corCapacete: string | null }
interface Empresa { id: string; nome: string }
interface ColaboradorListItem {
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
  contrato: { numero: string } | null
  _count: { entregas: number; mudancasPosto: number }
}

export function ColaboradoresView() {
  const { openColaborador } = useApp()
  const { toast } = useToast()
  const canWrite = useCanWrite()
  const [lista, setLista] = useState<ColaboradorListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [incluirDesligados, setIncluirDesligados] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const carregar = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams({
      incluirDesligados: String(incluirDesligados),
    })
    if (busca.trim()) params.set('q', busca.trim())
    fetch(`/api/colaboradores?${params}`)
      .then(r => r.json())
      .then(data => setLista(Array.isArray(data) ? data : []))
      .catch(() => setLista([]))
      .finally(() => setLoading(false))
  }, [busca, incluirDesligados])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Terceirizados</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cadastro centralizado por CPF — substitui a cópia/cola de blocos da planilha
          </p>
        </div>
        {canWrite && (
          <Button onClick={() => setShowForm(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Cadastrar terceirizado
          </Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou CPF..."
                value={busca}
                onChange={e => setBusca(e.target.value)}
                className="pl-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="incl-desc"
                checked={incluirDesligados}
                onCheckedChange={setIncluirDesligados}
              />
              <Label htmlFor="incl-desc" className="text-sm cursor-pointer">
                Mostrar desligados
              </Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-6 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
            </div>
          ) : lista.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-50" />
              <p className="text-sm text-muted-foreground">
                Nenhum terceirizado encontrado. Clique em <b>Cadastrar terceirizado</b> para começar.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF</TableHead>
                  <TableHead>Posto</TableHead>
                  <TableHead>Admissão</TableHead>
                  <TableHead className="text-center">Entregas</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {lista.map(c => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer hover:bg-accent/50"
                    onClick={() => openColaborador(c.id)}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        {c.nomeCompleto}
                        {c._count.mudancasPosto > 0 && (
                          <span title={`${c._count.mudancasPosto} mudança(s) de posto registrada(s)`} className="text-xs px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            {c._count.mudancasPosto}✪
                          </span>
                        )}
                      </div>
                      {c.observacoes && (
                        <div className="text-xs text-muted-foreground mt-0.5 truncate max-w-[280px]">{c.observacoes}</div>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">{formatCPF(c.cpf)}</TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span className="text-sm">{c.posto?.nome || '—'}</span>
                        {c.posto?.corCapacete && <CorCapaceteBadge cor={c.posto.corCapacete} />}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm tabular-nums">{formatDate(c.dataAdmissao)}</TableCell>
                    <TableCell className="text-center tabular-nums">{c._count.entregas}</TableCell>
                    <TableCell><StatusBadge ativo={c.ativo} dataDesligamento={c.dataDesligamento} motivoDesligamento={c.motivoDesligamento} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        Total: <b>{lista.length}</b> {lista.length === 1 ? 'registro' : 'registros'}
        {' · '}
        {lista.filter(c => c.ativo).length} ativos · {lista.filter(c => !c.ativo).length} desligados
      </p>

      {showForm && (
        <NovoColaboradorForm
          onClose={() => setShowForm(false)}
          onCreated={() => {
            setShowForm(false)
            carregar()
            toast({ title: 'Terceirizado cadastrado', description: 'Cadastro criado com sucesso.' })
          }}
        />
      )}
    </div>
  )
}

function NovoColaboradorForm({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { toast } = useToast()
  const [postos, setPostos] = useState<Posto[]>([])
  const [empresas, setEmpresas] = useState<Empresa[]>([])
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    nomeCompleto: '',
    cpf: '',
    postoId: '',
    empresaId: '',
    dataAdmissao: todayISO(),
    observacoes: '',
  })

  useEffect(() => {
    Promise.all([
      fetch('/api/postos').then(r => r.json()),
      fetch('/api/empresas').then(r => r.json()),
    ]).then(([p, e]) => {
      setPostos(Array.isArray(p) ? p : [])
      setEmpresas(Array.isArray(e) ? e : [])
      // defaults
      if (Array.isArray(p) && p.length > 0) setForm(f => ({ ...f, postoId: p[0].id }))
      if (Array.isArray(e) && e.length > 0) setForm(f => ({ ...f, empresaId: e[0].id }))
    })
  }, [])

  const handleCpfChange = (v: string) => {
    // máscara 000.000.000-00
    const d = v.replace(/\D/g, '').slice(0, 11)
    const masked = d
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
    setForm(f => ({ ...f, cpf: masked }))
  }

  const submit = async () => {
    if (!form.nomeCompleto.trim()) {
      toast({ title: 'Nome obrigatório', variant: 'destructive' })
      return
    }
    const cpfDigits = form.cpf.replace(/\D/g, '')
    if (cpfDigits.length !== 11) {
      toast({ title: 'CPF inválido', description: 'O CPF deve ter 11 dígitos.', variant: 'destructive' })
      return
    }
    if (!form.postoId) {
      toast({ title: 'Selecione o posto', variant: 'destructive' })
      return
    }
    // Empresa é sempre ORBIS — buscar ID automaticamente se não estiver setado
    let empresaId = form.empresaId
    if (!empresaId) {
      const orbis = empresas.find(e => e.nome === 'ORBIS')
      if (!orbis) {
        toast({ title: 'Empresa ORBIS não encontrada no cadastro', variant: 'destructive' })
        return
      }
      empresaId = orbis.id
    }
    setSaving(true)
    try {
      const r = await fetch('/api/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          cpf: cpfDigits,
          empresaId,
        }),
      })
      const data = await r.json()
      if (!r.ok) {
        throw new Error(data.error || 'Erro ao salvar')
      }
      onCreated()
    } catch (e: any) {
      toast({ title: 'Erro ao cadastrar', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="md" className="p-0">
        <DialogHeader>
          <DialogTitle>Cadastrar terceirizado</DialogTitle>
          <DialogDescription>
            O CPF é a chave única — não poderá ser alterado depois. O histórico completo será preservado mesmo após desligamento.
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="nome">Nome completo *</Label>
            <Input
              id="nome"
              value={form.nomeCompleto}
              onChange={e => setForm(f => ({ ...f, nomeCompleto: e.target.value }))}
              placeholder="Ex.: João da Silva Santos"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="cpf">CPF *</Label>
            <Input
              id="cpf"
              value={form.cpf}
              onChange={e => handleCpfChange(e.target.value)}
              placeholder="000.000.000-00"
              className="font-mono tabular-nums"
              inputMode="numeric"
            />
            <p className="text-xs text-muted-foreground">
              Usado como chave única. Não há vínculo com matrícula do Estado.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="posto">Posto *</Label>
            <Select value={form.postoId} onValueChange={v => setForm(f => ({ ...f, postoId: v }))}>
              <SelectTrigger id="posto"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {postos.map(p => (
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
          <p className="text-xs text-muted-foreground">
            Empresa: <b>ORBIS</b> (todos os terceirizados deste contrato são vinculados à ORBIS).
          </p>

          <div className="space-y-1.5">
            <Label htmlFor="adm">Data de admissão</Label>
            <Input
              id="adm"
              type="date"
              value={form.dataAdmissao}
              onChange={e => setForm(f => ({ ...f, dataAdmissao: e.target.value }))}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="obs">Observações (opcional)</Label>
            <Textarea
              id="obs"
              value={form.observacoes}
              onChange={e => setForm(f => ({ ...f, observacoes: e.target.value }))}
              placeholder="Qualquer anotação relevante sobre o colaborador"
              rows={2}
            />
          </div>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? 'Salvando...' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
