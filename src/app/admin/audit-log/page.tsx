'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, ScrollText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AuditLogItem {
  id: string
  usuarioId: string | null
  acao: string
  tabela: string
  registroId: string
  timestamp: string
  ip: string | null
  valoresAntigos: Record<string, unknown> | null
  valoresNovos: Record<string, unknown> | null
  usuario: { id: string; nome: string; email: string } | null
}

interface UsuarioOption {
  id: string
  nome: string
}

const ACAO_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-800',
  UPDATE: 'bg-amber-100 text-amber-800',
  DELETE: 'bg-rose-100 text-rose-800',
}

const TABELAS = ['Colaborador', 'Item', 'Entrega', 'MudancaPosto', 'Desligamento']

// Campos ruidosos que não ajudam a entender "o que mudou"
const CAMPOS_OCULTOS = new Set(['updatedAt', 'createdAt'])

function formatValor(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [usuarios, setUsuarios] = useState<UsuarioOption[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroTabela, setFiltroTabela] = useState('')
  const [filtroDataInicio, setFiltroDataInicio] = useState('')
  const [filtroDataFim, setFiltroDataFim] = useState('')
  const [detalhe, setDetalhe] = useState<AuditLogItem | null>(null)

  useEffect(() => {
    fetch('/api/admin/usuarios')
      .then(r => r.json())
      .then(d => setUsuarios(Array.isArray(d) ? d : []))
      .catch(() => {})
  }, [])

  const carregar = useCallback(() => {
    setLoading(true)
    const params = new URLSearchParams()
    if (filtroUsuario) params.set('usuarioId', filtroUsuario)
    if (filtroTabela) params.set('tabela', filtroTabela)
    if (filtroDataInicio) params.set('dataInicio', filtroDataInicio)
    if (filtroDataFim) params.set('dataFim', filtroDataFim)

    fetch(`/api/admin/audit-log?${params}`)
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          throw new Error(d.error || 'Erro ao carregar audit log')
        }
        return r.json()
      })
      .then(d => setLogs(Array.isArray(d) ? d : []))
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }, [filtroUsuario, filtroTabela, filtroDataInicio, filtroDataFim])

  useEffect(() => { carregar() }, [carregar])

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
            <ArrowLeft className="h-4 w-4" />
            Voltar ao sistema
          </Link>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <ScrollText className="h-5 w-5" />
            Audit Log
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Histórico de quem criou, editou ou excluiu cada registro — clique numa linha para ver o detalhe
          </p>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Usuário</Label>
                <Select value={filtroUsuario || '_todos'} onValueChange={v => setFiltroUsuario(v === '_todos' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Todos" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_todos">Todos</SelectItem>
                    {usuarios.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Tabela</Label>
                <Select value={filtroTabela || '_todas'} onValueChange={v => setFiltroTabela(v === '_todas' ? '' : v)}>
                  <SelectTrigger><SelectValue placeholder="Todas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_todas">Todas</SelectItem>
                    {TABELAS.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">De</Label>
                <Input type="date" value={filtroDataInicio} onChange={e => setFiltroDataInicio(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Até</Label>
                <Input type="date" value={filtroDataFim} onChange={e => setFiltroDataFim(e.target.value)} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Registros</CardTitle>
            <CardDescription>Mostrando até 100 entradas mais recentes que combinam com o filtro</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : erro ? (
              <div className="p-12 text-center text-sm text-rose-600">{erro}</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">Nenhum registro de auditoria encontrado.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data/Hora</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Ação</TableHead>
                    <TableHead>Tabela</TableHead>
                    <TableHead>Registro</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <TableRow key={log.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setDetalhe(log)}>
                      <TableCell className="text-sm tabular-nums whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleString('pt-BR')}
                      </TableCell>
                      <TableCell className="text-sm">
                        {log.usuario ? (
                          <div>
                            <div className="font-medium">{log.usuario.nome}</div>
                            <div className="text-xs text-muted-foreground">{log.usuario.email}</div>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={ACAO_COLORS[log.acao] || ''}>{log.acao}</Badge>
                      </TableCell>
                      <TableCell className="text-sm">{log.tabela}</TableCell>
                      <TableCell className="text-xs font-mono text-muted-foreground truncate max-w-[160px]">{log.registroId}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <AuditDetalheDialog log={detalhe} onClose={() => setDetalhe(null)} />
    </div>
  )
}

function AuditDetalheDialog({ log, onClose }: { log: AuditLogItem | null; onClose: () => void }) {
  if (!log) return null

  const antigos = log.valoresAntigos || {}
  const novos = log.valoresNovos || {}
  const todasChaves = Array.from(new Set([...Object.keys(antigos), ...Object.keys(novos)]))
    .filter(k => !CAMPOS_OCULTOS.has(k))

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Badge variant="outline" className={ACAO_COLORS[log.acao] || ''}>{log.acao}</Badge>
            {log.tabela}
          </DialogTitle>
          <DialogDescription>
            {new Date(log.timestamp).toLocaleString('pt-BR')}
            {log.usuario && <> · por <b>{log.usuario.nome}</b></>}
            {log.ip && <> · IP {log.ip}</>}
          </DialogDescription>
        </DialogHeader>

        <div className="text-xs text-muted-foreground font-mono">ID do registro: {log.registroId}</div>

        {todasChaves.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Sem detalhes de campos para este registro.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-32">Campo</TableHead>
                {log.acao !== 'CREATE' && <TableHead>Antes</TableHead>}
                {log.acao !== 'DELETE' && <TableHead>Depois</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {todasChaves.map(campo => {
                const valorAntigo = antigos[campo]
                const valorNovo = novos[campo]
                const mudou = log.acao === 'UPDATE' && JSON.stringify(valorAntigo) !== JSON.stringify(valorNovo)
                return (
                  <TableRow key={campo} className={cn(mudou && 'bg-amber-50')}>
                    <TableCell className="text-xs font-medium align-top">{campo}</TableCell>
                    {log.acao !== 'CREATE' && (
                      <TableCell className="text-xs align-top break-all">{formatValor(valorAntigo)}</TableCell>
                    )}
                    {log.acao !== 'DELETE' && (
                      <TableCell className={cn('text-xs align-top break-all', mudou && 'font-medium')}>
                        {formatValor(valorNovo)}
                      </TableCell>
                    )}
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </DialogContent>
    </Dialog>
  )
}
