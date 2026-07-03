'use client'

import { AppProvider, useApp } from '@/components/app/app-context'
import { Sidebar, MobileNav } from '@/components/app/shared/sidebar'
import { DashboardView } from '@/components/app/views/dashboard'
import { ColaboradoresView } from '@/components/app/views/colaboradores'
import { ColaboradorDetalheView } from '@/components/app/views/colaborador-detalhe'
import { ItensView } from '@/components/app/views/itens'
import { ChecklistsView } from '@/components/app/views/checklists'
import { EntregasView } from '@/components/app/views/entregas'
import { PendenciasView } from '@/components/app/views/pendencias'

function MainContent() {
  const { view } = useApp()
  return (
    <main className="flex-1 min-w-0 bg-background">
      <div className="md:hidden"><MobileNav /></div>
      <div className="p-4 md:p-8">
        {view === 'dashboard' && <DashboardView />}
        {view === 'colaboradores' && <ColaboradoresView />}
        {view === 'colaborador-detalhe' && <ColaboradorDetalheView />}
        {view === 'itens' && <ItensView />}
        {view === 'checklists' && <ChecklistsView />}
        {view === 'entregas' && <EntregasView />}
        {view === 'pendencias' && <PendenciasView />}
      </div>
    </main>
  )
}

export default function Home() {
  return (
    <AppProvider>
      <div className="flex min-h-screen bg-background">
        <Sidebar />
        <MainContent />
      </div>
    </AppProvider>
  )
}
