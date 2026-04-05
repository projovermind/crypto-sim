import type { NextAuthOptions } from 'next-auth'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { prisma } from './prisma'

const AUTH_SECRET = process.env.NEXTAUTH_SECRET || 'crypto-sim-secret-key-change-in-production'

/** JWT 토큰에서 유저 ID/email을 꺼내 DB 조회. 스키마 불일치 시 raw SQL 폴백. */
export async function getAuthUser(req: NextRequest) {
  const token = await getToken({ req, secret: AUTH_SECRET })
  if (!token) return null
  const userId = token.id as string
  const email = token.email as string
  try {
    let user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user && email) {
      user = await prisma.user.findUnique({ where: { email } })
    }
    return user
  } catch (e) {
    // 스키마 불일치 시 raw SQL 폴백 — 핵심 컬럼만 조회
    console.error('getAuthUser Prisma 실패, raw SQL 폴백:', e)
    const rows = await prisma.$queryRaw<Array<{
      id: string; email: string; name: string; password: string; role: string; status: string; createdAt: Date
    }>>`
      SELECT id, email, name, password, role, status, "createdAt"
      FROM "User"
      WHERE id = ${userId} OR email = ${email || ''}
      LIMIT 1
    `
    return rows[0] || null
  }
}

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'ID', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }

        let user
        try {
          user = await prisma.user.findUnique({
            where: { email: credentials.email },
          })
        } catch (e) {
          // 스키마 불일치 시 raw SQL 폴백
          console.error('authorize Prisma 실패, raw SQL 폴백:', e)
          const rows = await prisma.$queryRaw<Array<{
            id: string; email: string; name: string; password: string; role: string; status: string
          }>>`
            SELECT id, email, name, password, role, status
            FROM "User"
            WHERE email = ${credentials.email}
            LIMIT 1
          `
          user = rows[0] || null
        }

        if (!user) {
          return null
        }

        const isPasswordValid = await bcrypt.compare(credentials.password, user.password)
        if (!isPasswordValid) {
          return null
        }

        if (user.status === 'SUSPENDED') {
          throw new Error('SUSPENDED')
        }

        if (user.status === 'PENDING') {
          throw new Error('PENDING')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as any).role
        token.status = (user as any).status
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id = token.id
        ;(session.user as any).role = token.role
        ;(session.user as any).status = token.status
      }
      return session
    },
  },
  pages: {
    signIn: '/login',
  },
  secret: AUTH_SECRET,
}
