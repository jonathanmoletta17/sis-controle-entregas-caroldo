'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { ArrowLeft, Users, UserPlus, Copy, Check, KeyRound, Pencil, Trash2 } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ROLE_LABELS } from '@/lib/permissions'

interface Usuario {
  id: string
  email: string
  nome: string
  role: string
  ativo: boolean
  createdAt: string
}

export default function UsuariosPage() {
  const { toast } = useToast()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [erro, setErro] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [senhaGerada, setSenhaGerada] = useState<{ email: string; senha: string } | null>(null)

  const carregar = () => {
    setLoading(true)
    fetch('/api/admin/usuarios')
      .then(async r => {
        if (!r.ok) {
          const d = await r.json().catch(() => ({}))
          throw new Error(d.error || 'Erro ao carregar usuários')
        }
        return r.json()
      })
      .then(d => setUsuarios(Array.isArray(d) ? d : []))
      .catch(e => setErro(e.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { carregar() }, [])

  const toggleAtivo = async (u: Usuario) => {
    try {
      const r = await fetch(`/api/admin/usuarios/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ativo: !u.ativo }),
      })
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.error || 'Erro ao atualizar')
      }
      toast({ title: u.ativo ? 'Usuário desativado' : 'Usuário reativado' })
      carregar()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const alterarRole = async (u: Usuario, novoRole: string) => {
    try {
      const r = await fetch(`/api/admin/usuarios/${u.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: novoRole }),
      })
      if (!r.ok) {
        const d = await r.json()
        throw new Error(d.error || 'Erro ao atualizar')
      }
      toast({ title: 'Papel atualizado' })
      carregar()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  const excluir = async (u: Usuario) => {
    if (!confirm(`Excluir o usuário ${u.nome} (${u.email}) definitivamente? Isso não pode ser desfeito.`)) return
    try {
      const r = await fetch(`/api/admin/usuarios/${u.id}`, { method: 'DELETE' })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(d.error || 'Erro ao excluir usuário')
      toast({ title: 'Usuário excluído' })
      carregar()
    } catch (e: any) {
      toast({ title: 'Não foi possível excluir', description: e.message, variant: 'destructive' })
    }
  }

  const resetarSenha = async (u: Usuario) => {
    if (!confirm(`Gerar uma nova senha temporária para ${u.nome}? A senha atual deixará de funcionar.`)) return
    try {
      const r = await fetch(`/api/admin/usuarios/${u.id}/resetar-senha`, { method: 'POST' })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erro ao redefinir senha')
      setSenhaGerada({ email: u.email, senha: d.senhaTemporaria })
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    }
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-6xl mx-auto space-y-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-3">
              <ArrowLeft className="h-4 w-4" />
              Voltar ao sistema
            </Link>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5" />
              Usuários
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Quem pode acessar o sistema, e o que cada um pode fazer
            </p>
          </div>
          <Button onClick={() => setShowForm(true)}>
            <UserPlus className="h-4 w-4 mr-1.5" />
            Novo usuário
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Usuários cadastrados</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="p-6 space-y-2">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10" />)}
              </div>
            ) : erro ? (
              <div className="p-12 text-center text-sm text-rose-600">{erro}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>E-mail</TableHead>
                    <TableHead className="w-44">Papel</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-72"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {usuarios.map(u => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">{u.nome}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{u.email}</TableCell>
                      <TableCell>
                        <Select value={u.role} onValueChange={v => alterarRole(u, v)}>
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {Object.entries(ROLE_LABELS).map(([value, label]) => (
                              <SelectItem key={value} value={value}>{label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        {u.ativo ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary">Inativo</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditando(u)} title="Editar nome/e-mail">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => resetarSenha(u)} title="Gerar nova senha temporária">
                            <KeyRound className="h-3.5 w-3.5 mr-1" />
                            Senha
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => toggleAtivo(u)}>
                            {u.ativo ? 'Desativar' : 'Reativar'}
                          </Button>
                          <Button variant="outline" size="icon" className="h-8 w-8 text-rose-600 hover:text-rose-700" onClick={() => excluir(u)} title="Excluir usuário">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p><b className="text-foreground">Administrador</b> — acesso total, inclusive gestão de usuários e audit log.</p>
            <p><b className="text-foreground">Técnico</b> — pode cadastrar, editar e excluir dados do dia a dia (terceirizados, itens, entregas), mas não gerencia usuários.</p>
            <p><b className="text-foreground">Leitura</b> — só visualiza, não pode alterar nada no sistema.</p>
          </CardContent>
        </Card>
      </div>

      {showForm && (
        <NovoUsuarioForm
          onClose={() => setShowForm(false)}
          onCreated={(email, senha) => {
            setShowForm(false)
            setSenhaGerada({ email, senha })
            carregar()
          }}
        />
      )}

      {editando && (
        <EditarUsuarioForm
          usuario={editando}
          onClose={() => setEditando(null)}
          onSaved={() => {
            setEditando(null)
            carregar()
          }}
        />
      )}

      {senhaGerada && (
        <SenhaGeradaDialog data={senhaGerada} onClose={() => setSenhaGerada(null)} />
      )}
    </div>
  )
}

function NovoUsuarioForm({ onClose, onCreated }: {
  onClose: () => void
  onCreated: (email: string, senha: string) => void
}) {
  const { toast } = useToast()
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState('tecnico')
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const r = await fetch('/api/admin/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email, role }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erro ao criar usuário')
      onCreated(d.usuario.email, d.senhaTemporaria)
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
          <DialogTitle>Novo usuário</DialogTitle>
          <DialogDescription>
            Uma senha temporária será gerada automaticamente. O e-mail não precisa ser real — é só o identificador de login (o sistema não envia nenhuma mensagem).
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail (identificador de login)</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Papel</Label>
            <Select value={role} onValueChange={setRole}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(ROLE_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Criando...' : 'Criar usuário'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function EditarUsuarioForm({ usuario, onClose, onSaved }: {
  usuario: Usuario
  onClose: () => void
  onSaved: () => void
}) {
  const { toast } = useToast()
  const [nome, setNome] = useState(usuario.nome)
  const [email, setEmail] = useState(usuario.email)
  const [saving, setSaving] = useState(false)

  const submit = async () => {
    setSaving(true)
    try {
      const r = await fetch(`/api/admin/usuarios/${usuario.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, email }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erro ao salvar')
      toast({ title: 'Usuário atualizado' })
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
          <DialogTitle>Editar usuário</DialogTitle>
          <DialogDescription>
            Corrija o nome ou o e-mail de login. Papel e senha se ajustam nos botões da tabela.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Nome completo</Label>
            <Input value={nome} onChange={e => setNome(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>E-mail (identificador de login)</Label>
            <Input type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function SenhaGeradaDialog({ data, onClose }: { data: { email: string; senha: string }; onClose: () => void }) {
  const [copiado, setCopiado] = useState(false)
  const copiar = () => {
    navigator.clipboard.writeText(data.senha)
    setCopiado(true)
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Senha gerada</DialogTitle>
          <DialogDescription>
            Anote esta senha temporária agora — ela não será mostrada de novo. Compartilhe com {data.email} por um canal seguro.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center gap-2 border rounded-md p-3 bg-accent/30">
          <code className="flex-1 text-sm font-mono">{data.senha}</code>
          <Button variant="outline" size="icon" onClick={copiar}>
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>
        <DialogFooter>
          <Button onClick={onClose}>Fechar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
