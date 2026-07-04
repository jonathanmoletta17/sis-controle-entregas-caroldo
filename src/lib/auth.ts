import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'E-mail', type: 'email' },
        senha: { label: 'Senha', type: 'password' },
      },
      authorize: async (credentials, request) => {
        const email = String(credentials?.email || '').trim().toLowerCase()
        const senha = String(credentials?.senha || '')
        if (!email || !senha) return null

        const usuario = await db.usuario.findUnique({ where: { email } })
        if (!usuario || !usuario.ativo) return null

        const senhaValida = await bcrypt.compare(senha, usuario.senhaHash)
        if (!senhaValida) return null

        const ip = request?.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        const userAgent = request?.headers.get('user-agent') || undefined
        await db.sessaoLogin.create({
          data: { usuarioId: usuario.id, ip, userAgent },
        })

        return {
          id: usuario.id,
          email: usuario.email,
          name: usuario.nome,
          role: usuario.role,
        }
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
      }
      return token
    },
    session({ session, token }) {
      if (session.user) {
        ;(session.user as any).id = token.id
        ;(session.user as any).role = token.role
      }
      return session
    },
  },
  events: {
    async signOut(message) {
      const token = 'token' in message ? message.token : null
      const userId = (token as { id?: string } | null)?.id
      if (!userId) return
      const aberta = await db.sessaoLogin.findFirst({
        where: { usuarioId: userId, logoutEm: null },
        orderBy: { loginEm: 'desc' },
      })
      if (aberta) {
        await db.sessaoLogin.update({ where: { id: aberta.id }, data: { logoutEm: new Date() } })
      }
    },
  },
})
