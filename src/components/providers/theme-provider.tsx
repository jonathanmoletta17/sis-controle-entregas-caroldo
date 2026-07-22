"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  // Relatório é um documento para impressão/PDF — sempre no papel branco,
  // independente do tema escolhido no resto do app.
  const forcedTheme = pathname?.startsWith("/relatorio") ? "light" : undefined

  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="fisccon-theme"
      themes={["light", "dark"]}
      forcedTheme={forcedTheme}
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  )
}
