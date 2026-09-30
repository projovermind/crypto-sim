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

// crmUserId 별 「허용 여부」 캐시 — 쿠키·Bearer(확장) 모두 getAuthUser 를 지나므로 여기서 한 번에 회수한다.
const crmAllowCache = new Map<string, { allowed: boolean; at: number }>()

/** CRM 미연결 계정(옛 계정·옛 확장 토큰)은 차단. 연결 계정은 CRM 판정을 5분 캐시로 확인. CRM 장애 시엔 캐시값, 없으면 허용. */
async function passCrmGate<T extends { crmUserId?: string | null }>(user: T | null): Promise<T | null> {
  if (!user) return null
  if (!user.crmUserId) return null
  const cached = crmAllowCache.get(user.crmUserId)
  if (cached && Date.now() - cached.at < CRM_RECHECK_MS) return cached.allowed ? user : null
  try {
    const allowed = await crmCheckAllowed(user.crmUserId)
    crmAllowCache.set(user.crmUserId, { allowed, at: Date.now() })
    return allowed ? user : null
  } catch (e) {
    console.error('CRM 권한 확인 실패(기존 판정 유지):', e)
    return cached ? (cached.allowed ? user : null) : user
  }
}

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
    return await passCrmGate(user)
  } catch (e) {
    // 스키마 불일치 시 raw SQL 폴백 — 핵심 컬럼만 조회
    console.error('getAuthUser Prisma 실패, raw SQL 폴백:', e)
    const rows = await prisma.$queryRaw<Array<{
      id: string; email: string; name: string; password: string; role: string; status: string; createdAt: Date; crmUserId: string | null
    }>>`
      SELECT id, email, name, password, role, status, "createdAt", "crmUserId"
      FROM "User"
      WHERE id = ${userId} OR email = ${email || ''}
      LIMIT 1
    `
    return await passCrmGate(rows[0] || null)
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

/** CRM 위임 로그인 — authorize 와 확장 로그인이 같이 쓴다. 실패는 사유 코드를 message 로 던진다(CRM_UNAVAILABLE 포함). */
export async function loginViaCrm(username: string, password: string) {
  let crm
  try {
    crm = await crmAuthenticate(username, password)
  } catch (e) {
    console.error('CRM 인증 호출 실패:', e)
    throw new Error('CRM_UNAVAILABLE')
  }
  if (!crm.ok) throw new Error(crm.reason)

  const user = await findOrCreateLocalUser(crm.user)

  // 역할 동기화 — POSI 관리자 = CRM 풀 관리자. 로컬 status 는 더 보지 않는다(정지·퇴사는 CRM 이 BLOCKED 로 막고,
  // 로컬에서 정지를 풀 UI 도 없다 — CRM 이 유일 정본).
  const role = crm.user.isAdmin ? 'ADMIN' : 'USER'
  if (user.role !== role) await prisma.user.update({ where: { id: user.id }, data: { role } })

  crmAllowCache.set(crm.user.crmUserId, { allowed: true, at: Date.now() })
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role,
    status: user.status,
    crmUserId: crm.user.crmUserId,
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

        return loginViaCrm(credentials.email, credentials.password)
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
