'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useApp, View } from '../app-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSession, signOut } from 'next-auth/react'
import { TrocarSenhaDialog } from './trocar-senha-dialog'
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  Truck,
  AlertCircle,
  LogOut,
  ScrollText,
  KeyRound,
} from 'lucide-react'

interface NavItem {
  id: View
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'colaboradores', label: 'Terceirizados', icon: Users },
  { id: 'itens', label: 'Itens', icon: Package },
  { id: 'checklists', label: 'Checklists', icon: ClipboardList },
  { id: 'entregas', label: 'Entregas', icon: Truck },
  { id: 'pendencias', label: 'Pendências', icon: AlertCircle },
]

export function Sidebar() {
  const { view, setView } = useApp()

  return (
    <aside className="hidden md:flex flex-col w-60 bg-card border-r border-border h-screen sticky top-0">
      <div className="p-5 border-b border-border">
        <div className="flex items-center gap-2">
          <img
            src="/brasao-rs.jpg"
            alt="Brasão do Estado do Rio Grande do Sul"
            className="h-11 w-11 object-contain shrink-0"
          />
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">FISCCON</span>
            <span className="text-xs text-muted-foreground">Fiscalização de Contratos Continuados</span>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-3 space-y-1">
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive = view === item.id || (item.id === 'colaboradores' && view === 'colaborador-detalhe')
          return (
            <Button
              key={item.id}
              variant={isActive ? 'secondary' : 'ghost'}
              className={cn(
                'w-full justify-start gap-3 h-10 text-sm',
                isActive && 'bg-secondary text-secondary-foreground font-medium'
              )}
              onClick={() => setView(item.id)}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          )
        })}
        <AdminLinks />
      </nav>

      <div className="p-3 border-t border-border">
        <UsuarioLogado />
      </div>

      <div className="p-4 border-t border-border text-xs text-muted-foreground">
        <p className="font-medium mb-1">Contrato 004/2026</p>
        <p>Manutenção Predial</p>
        <p className="mt-2">Estado do RS · Secretaria da Casa Civil</p>
      </div>
    </aside>
  )
}

function AdminLinks() {
  const { data: session } = useSession()
  if ((session?.user as { role?: string } | undefined)?.role !== 'admin') return null
  return (
    <div className="pt-2 mt-2 border-t border-border">
      <p className="px-3 pb-1 text-xs font-medium text-muted-foreground">Administração</p>
      <Link href="/admin/usuarios">
        <Button variant="ghost" className="w-full justify-start gap-3 h-10 text-sm">
          <Users className="h-4 w-4" />
          Usuários
        </Button>
      </Link>
      <Link href="/admin/audit-log">
        <Button variant="ghost" className="w-full justify-start gap-3 h-10 text-sm">
          <ScrollText className="h-4 w-4" />
          Audit log
        </Button>
      </Link>
    </div>
  )
}

function UsuarioLogado() {
  const { data: session } = useSession()
  const [showTrocarSenha, setShowTrocarSenha] = useState(false)
  if (!session?.user) return null
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{session.user.name}</div>
        <div className="text-xs text-muted-foreground truncate">{session.user.email}</div>
      </div>
      <div className="flex items-center shrink-0">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          title="Trocar senha"
          onClick={() => setShowTrocarSenha(true)}
        >
          <KeyRound className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="Sair"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
      <TrocarSenhaDialog open={showTrocarSenha} onClose={() => setShowTrocarSenha(false)} />
    </div>
  )
}

export function MobileNav() {
  const { view, setView } = useApp()
  const [showTrocarSenha, setShowTrocarSenha] = useState(false)
  return (
    <div className="md:hidden sticky top-0 z-30 bg-card border-b border-border">
      <div className="flex items-center gap-2 px-4 py-3">
        <img
          src="/brasao-rs.jpg"
          alt="Brasão do Estado do Rio Grande do Sul"
          className="h-9 w-9 object-contain shrink-0"
        />
        <span className="text-sm font-semibold flex-1">FISCCON</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground"
          title="Trocar senha"
          onClick={() => setShowTrocarSenha(true)}
        >
          <KeyRound className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-muted-foreground hover:text-destructive"
          title="Sair"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="h-4 w-4" />
        </Button>
        <TrocarSenhaDialog open={showTrocarSenha} onClose={() => setShowTrocarSenha(false)} />
      </div>
      <div className="flex overflow-x-auto gap-1 px-2 pb-2">
        {NAV.map((item) => {
          const Icon = item.icon
          const isActive = view === item.id || (item.id === 'colaboradores' && view === 'colaborador-detalhe')
          return (
            <Button
              key={item.id}
              variant={isActive ? 'secondary' : 'ghost'}
              size="sm"
              className={cn('gap-2 shrink-0', isActive && 'font-medium')}
              onClick={() => setView(item.id)}
            >
              <Icon className="h-4 w-4" />
              <span className="text-xs">{item.label}</span>
            </Button>
          )
        })}
      </div>
    </div>
  )
}
