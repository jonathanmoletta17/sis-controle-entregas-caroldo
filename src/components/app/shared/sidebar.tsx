'use client'

import Link from 'next/link'
import { useApp, View } from '../app-context'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSession, signOut } from 'next-auth/react'
import {
  LayoutDashboard,
  Users,
  Package,
  ClipboardList,
  Truck,
  HardHat,
  AlertCircle,
  LogOut,
  ScrollText,
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
          <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <HardHat className="h-5 w-5" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="text-sm font-semibold">Controle de Entregas</span>
            <span className="text-xs text-muted-foreground">CAROLDO · 003/2026</span>
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
        <p className="font-medium mb-1">Contrato 003/2026</p>
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
  if (!session?.user) return null
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <div className="text-sm font-medium truncate">{session.user.name}</div>
        <div className="text-xs text-muted-foreground truncate">{session.user.email}</div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
        title="Sair"
        onClick={() => signOut({ callbackUrl: '/login' })}
      >
        <LogOut className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function MobileNav() {
  const { view, setView } = useApp()
  return (
    <div className="md:hidden sticky top-0 z-30 bg-card border-b border-border">
      <div className="flex items-center gap-2 px-4 py-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <HardHat className="h-4 w-4" />
        </div>
        <span className="text-sm font-semibold flex-1">Controle de Entregas</span>
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
