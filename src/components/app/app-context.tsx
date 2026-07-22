'use client'

import { createContext, useContext, useState, ReactNode } from 'react'

export type View =
  | 'dashboard'
  | 'colaboradores'
  | 'colaborador-detalhe'
  | 'itens'
  | 'matriz-metas'
  | 'checklists'
  | 'entregas'
  | 'pendencias'

interface AppState {
  view: View
  selectedColaboradorId: string | null
  setView: (v: View) => void
  openColaborador: (id: string) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [view, setViewState] = useState<View>('dashboard')
  const [selectedColaboradorId, setSelectedColaboradorId] = useState<string | null>(null)

  const setView = (v: View) => {
    setViewState(v)
    // scroll to top on view change
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const openColaborador = (id: string) => {
    setSelectedColaboradorId(id)
    setView('colaborador-detalhe')
  }

  return (
    <AppContext.Provider value={{ view, selectedColaboradorId, setView, openColaborador }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
