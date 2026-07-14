import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { AuthSessionProvider } from "@/components/providers/session-provider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FISCCON — Fiscalização de Contratos Continuados · Contrato 004/2026",
  description: "FISCCON: fiscalização de contratos continuados, cadastro de terceirizados, checklists e registro de entregas para o Contrato de Manutenção Predial 004/2026 do Estado do RS.",
  keywords: ["FISCCON", "Fiscalização de Contratos Continuados", "CAROLDO", "Manutenção Predial", "Contrato 004/2026", "EPI", "Terceirizados", "Estado do RS", "Casa Civil"],
  icons: {
    icon: "/brasao-rs.jpg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <AuthSessionProvider>
          {children}
          <Toaster />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
