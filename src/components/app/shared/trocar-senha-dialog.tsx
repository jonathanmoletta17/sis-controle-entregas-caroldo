'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

export function TrocarSenhaDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { toast } = useToast()
  const [senhaAtual, setSenhaAtual] = useState('')
  const [senhaNova, setSenhaNova] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [saving, setSaving] = useState(false)

  const fechar = () => {
    setSenhaAtual('')
    setSenhaNova('')
    setConfirmacao('')
    onClose()
  }

  const submit = async () => {
    if (senhaNova.length < 6) {
      toast({ title: 'A nova senha deve ter ao menos 6 caracteres', variant: 'destructive' })
      return
    }
    if (senhaNova !== confirmacao) {
      toast({ title: 'A confirmação não confere com a nova senha', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const r = await fetch('/api/me/senha', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ senhaAtual, senhaNova }),
      })
      const d = await r.json()
      if (!r.ok) throw new Error(d.error || 'Erro ao trocar senha')
      toast({ title: 'Senha alterada com sucesso' })
      fechar()
    } catch (e: any) {
      toast({ title: 'Erro', description: e.message, variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && fechar()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Trocar senha</DialogTitle>
          <DialogDescription>Informe sua senha atual e a nova senha desejada.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label>Senha atual</Label>
            <PasswordInput value={senhaAtual} onChange={e => setSenhaAtual(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Nova senha</Label>
            <PasswordInput value={senhaNova} onChange={e => setSenhaNova(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Confirmar nova senha</Label>
            <PasswordInput value={confirmacao} onChange={e => setConfirmacao(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={fechar}>Cancelar</Button>
          <Button onClick={submit} disabled={saving}>{saving ? 'Salvando...' : 'Trocar senha'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
