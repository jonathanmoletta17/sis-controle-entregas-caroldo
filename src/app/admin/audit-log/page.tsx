'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { ArrowLeft, ScrollText } from 'lucide-react'

interface AuditLogItem {
  id: string
  usuarioId: string | null
  acao: string
  tabela: string
  registroId: string
  timestamp: string
  usuario: { id: string; nome: string; email: string } | null
}

const ACAO_COLORS: Record<string, string> = {
  CREATE: 'bg-emerald-100 text-emerald-800',
  UPDATE: 'bg-amber-100 text-amber-800',
  DELETE: 'bg-rose-100 text-rose-800',
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')

  useEffect(() => {
    fetch('/api/admin/audit-log')
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
  }, [])

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
            Histórico de quem criou, editou ou excluiu cada registro
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Últimos registros</CardTitle>
            <CardDescription>Mostrando até 100 entradas mais recentes</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : erro ? (
              <div className="p-12 text-center text-sm text-rose-600">{erro}</div>
            ) : logs.length === 0 ? (
              <div className="p-12 text-center text-sm text-muted-foreground">Nenhum registro de auditoria ainda.</div>
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
                    <TableRow key={log.id}>
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
    </div>
  )
}
