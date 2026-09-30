import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/admin/users — 전체 유저 목록
export async function GET(request: NextRequest) {
  try {
    const admin = await getAuthUser(request)
    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'MANAGER')) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    let users
    try {
      users = await prisma.user.findMany({
        select: {
          id: true,
          email: true,
          name: true,
          nickname1: true,
          nickname2: true,
          entryWaitWord: true,
          profitProofWord: true,
          role: true,
          status: true,
          createdAt: true,
          _count: { select: { positions: true } },
        },
        orderBy: { createdAt: 'desc' },
      })
    } catch (prismaError) {
      // 스키마 불일치 등으로 Prisma 쿼리 실패 시 raw SQL 폴백
      console.error('Prisma findMany 실패, raw SQL 폴백:', prismaError)
      const rawUsers = await prisma.$queryRaw<Array<{
        id: string; email: string; name: string; role: string; status: string; createdAt: Date; positionCount: bigint
      }>>`
        SELECT u.id, u.email, u.name, u.role, u.status, u."createdAt",
               COUNT(p.id)::bigint AS "positionCount"
        FROM "User" u
        LEFT JOIN "Position" p ON p."userId" = u.id
        GROUP BY u.id
        ORDER BY u."createdAt" DESC
      `
      users = rawUsers.map(u => ({
        id: u.id, email: u.email, name: u.name, role: u.role, status: u.status, createdAt: u.createdAt,
        _count: { positions: Number(u.positionCount) },
      }))
    }

    return NextResponse.json(users)
  } catch (error) {
    console.error('GET /api/admin/users error:', error)
    return NextResponse.json({ error: '유저 목록 조회 실패' }, { status: 500 })
  }
}

// POST /api/admin/users — 계정 생성 비활성. 로그인이 소나무 CRM 에 위임돼 계정은 CRM 회원관리에서 만든다.
export async function POST(request: NextRequest) {
  const admin = await getAuthUser(request)
  if (!admin || admin.role !== 'ADMIN') {
    return NextResponse.json({ error: 'ADMIN 권한이 필요합니다.' }, { status: 403 })
  }
  return NextResponse.json({ error: 'CRM 에서 관리합니다. 계정은 소나무 CRM 회원관리에서 만드세요.' }, { status: 410 })
}
