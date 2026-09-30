import type { NextAuthOptions } from 'next-auth'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import { prisma } from './prisma'
import { crmAuthenticate, crmCheckAllowed } from './crm-auth'
import { getTeleditTemplateDefaults } from './teledit-defaults'

// CRM 에 「아직 허용인가」 를 다시 묻는 주기 — 권한 회수가 이 안에 반영된다.
const CRM_RECHECK_MS = 5 * 60 * 1000

const AUTH_SECRET = process.env.NEXTAUTH_SECRET || 'crypto-sim-secret-key-change-in-production'

/** JWT 토큰에서 유저 ID/email을 꺼내 DB 조회. 스키마 불일치 시 raw SQL 폴백. */
export async function getAuthUser(req: NextRequest) {
  const token = await getToken({ req, secret: AUTH_SECRET })
  if (!token || token.revoked) return null
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

type CrmUser = { crmUserId: string; username: string; name: string | null; isAdmin: boolean }

/** crmUserId 일치 → 없으면 email===username 행에 연결 → 없으면 새로 생성. 로컬 email 은 절대 바꾸지 않는다. */
async function findOrCreateLocalUser(crm: CrmUser) {
  const linked = await prisma.user.findUnique({ where: { crmUserId: crm.crmUserId } })
  if (linked) return linked

  const byEmail = await prisma.user.findUnique({ where: { email: crm.username } })
  if (byEmail && !byEmail.crmUserId) {
    return prisma.user.update({ where: { id: byEmail.id }, data: { crmUserId: crm.crmUserId } })
  }
  // 같은 아이디가 이미 다른 CRM 계정에 연결돼 있으면 새 행을 만들 수 없다(email 유니크) — 계정 혼선 방지로 거부.
  if (byEmail) throw new Error('ACCOUNT_CONFLICT')

  // 로컬 비밀번호는 로그인에 안 쓴다 — 랜덤 해시로 채워 두기만 한다.
  const password = await bcrypt.hash(randomBytes(24).toString('hex'), 12)
  return prisma.user.create({
    data: {
      email: crm.username,
      name: crm.name || crm.username,
      password,
      role: crm.isAdmin ? 'ADMIN' : 'USER',
      status: 'APPROVED',
      crmUserId: crm.crmUserId,
      ...(await getTeleditTemplateDefaults()),
    },
  })
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

        // 인증은 소나무 CRM 에 위임 — 아이디·비밀번호는 CRM 계정 그대로. 로컬 bcrypt 로그인은 없다.
        let crm
        try {
          crm = await crmAuthenticate(credentials.email, credentials.password)
        } catch (e) {
          console.error('CRM 인증 호출 실패:', e)
          throw new Error('CRM_UNAVAILABLE')
        }
        if (!crm.ok) throw new Error(crm.reason)

        const user = await findOrCreateLocalUser(crm.user)

        // 로컬 이중 잠금 — CRM 이 허용해도 여기서 정지된 계정은 거부.
        if (user.status === 'SUSPENDED') {
          throw new Error('SUSPENDED')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          crmUserId: crm.user.crmUserId,
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
        token.crmUserId = (user as any).crmUserId
        token.crmCheckedAt = Date.now()
        token.revoked = false
      } else if (token.crmUserId && Date.now() - ((token.crmCheckedAt as number) || 0) > CRM_RECHECK_MS) {
        // 권한 회수 반영 — CRM 에서 TAPPO 체크가 빠졌거나 정지·퇴사면 revoked.
        // CRM 장애 시엔 기존 판정을 유지한다(내쫓지 않음). 실패해도 확인 시각은 갱신해 장애 중 매 요청 재시도를 막는다.
        token.crmCheckedAt = Date.now()
        try {
          token.revoked = !(await crmCheckAllowed(token.crmUserId as string))
        } catch (e) {
          console.error('CRM 권한 확인 실패(기존 판정 유지):', e)
        }
      }
      return token
    },
    async session({ session, token }) {
      if (token.revoked) {
        // 세션 비우기 — 클라이언트는 user 없음으로 읽어 로그인 화면으로 간다.
        return { expires: session.expires } as typeof session
      }
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
