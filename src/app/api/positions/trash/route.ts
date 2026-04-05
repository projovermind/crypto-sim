import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/positions/trash — 휴지통 목록 (7일 이상 자동 퍼지 포함)
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // 7일 이상 된 항목 자동 영구 삭제
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    await prisma.position.deleteMany({
      where: {
        userId: user.id,
        deletedAt: { not: null, lt: sevenDaysAgo },
      },
    })

    // 남은 휴지통 항목 반환
    const trashed = await prisma.position.findMany({
      where: { userId: user.id, deletedAt: { not: null } },
      orderBy: { deletedAt: 'desc' },
    })

    return NextResponse.json(trashed)
  } catch (error) {
    console.error('GET /api/positions/trash error:', error)
    return NextResponse.json({ error: '휴지통 조회 실패' }, { status: 500 })
  }
}

// POST /api/positions/trash — 복원 또는 비우기
// body: { action: 'restore', ids: [...] } | { action: 'empty' }
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { action, ids } = await request.json()

    if (action === 'empty') {
      // 휴지통 비우기 (영구 삭제)
      const result = await prisma.position.deleteMany({
        where: { userId: user.id, deletedAt: { not: null } },
      })
      return NextResponse.json({ deleted: result.count })
    }

    if (action === 'restore' && Array.isArray(ids) && ids.length > 0) {
      // 복원
      const result = await prisma.position.updateMany({
        where: { id: { in: ids }, userId: user.id, deletedAt: { not: null } },
        data: { deletedAt: null },
      })
      return NextResponse.json({ restored: result.count })
    }

    return NextResponse.json({ error: 'action(restore/empty) 파라미터가 필요합니다.' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/positions/trash error:', error)
    return NextResponse.json({ error: '휴지통 작업 실패' }, { status: 500 })
  }
}
