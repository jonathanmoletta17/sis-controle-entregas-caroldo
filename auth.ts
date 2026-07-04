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
      authorize: async (credentials) => {
        const email = String(credentials?.email || '').trim().toLowerCase()
        const senha = String(credentials?.senha || '')
        if (!email || !senha) return null

        const usuario = await db.usuario.findUnique({ where: { email } })
        if (!usuario || !usuario.ativo) return null

        const senhaValida = await bcrypt.compare(senha, usuario.senhaHash)
        if (!senhaValida) return null

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
})
