import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
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

// POST /api/admin/users — 관리자/매니저 계정 생성
export async function POST(request: NextRequest) {
  try {
    const admin = await getAuthUser(request)
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'ADMIN 권한이 필요합니다.' }, { status: 403 })
    }

    const { username, name, password, role } = await request.json()

    if (!username || !name || !password) {
      return NextResponse.json({ error: '모든 항목을 입력해주세요.' }, { status: 400 })
    }

    if (!['MANAGER', 'ADMIN'].includes(role)) {
      return NextResponse.json({ error: '유효하지 않은 역할입니다.' }, { status: 400 })
    }

    const existing = await prisma.user.findUnique({ where: { email: username } })
    if (existing) {
      return NextResponse.json({ error: '이미 존재하는 아이디입니다.' }, { status: 409 })
    }

    const hashedPassword = await bcrypt.hash(password, 12)
    const { getTeleditTemplateDefaults } = await import('@/lib/teledit-defaults')
    const templateDefaults = await getTeleditTemplateDefaults()
    const user = await prisma.user.create({
      data: {
        email: username,
        name,
        password: hashedPassword,
        role,
        status: 'APPROVED',
        ...templateDefaults,
      },
    })

    return NextResponse.json({ id: user.id, name: user.name, role: user.role }, { status: 201 })
  } catch (error) {
    console.error('POST /api/admin/users error:', error)
    return NextResponse.json({ error: '계정 생성 실패' }, { status: 500 })
  }
}
