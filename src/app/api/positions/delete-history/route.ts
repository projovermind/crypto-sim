import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// POST /api/positions/delete-history — 히스토리 소프트 삭제 (휴지통으로 이동)
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { ids, all } = await request.json()

    if (all) {
      const result = await prisma.position.updateMany({
        where: {
          userId: user.id,
          status: { not: 'OPEN' },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      })
      return NextResponse.json({ deleted: result.count })
    }

    if (ids && Array.isArray(ids) && ids.length > 0) {
      const result = await prisma.position.updateMany({
        where: {
          id: { in: ids },
          userId: user.id,
          status: { not: 'OPEN' },
          deletedAt: null,
        },
        data: { deletedAt: new Date() },
      })
      return NextResponse.json({ deleted: result.count })
    }

    return NextResponse.json({ error: 'ids 또는 all 파라미터가 필요합니다.' }, { status: 400 })
  } catch (error) {
    console.error('POST /api/positions/delete-history error:', error)
    return NextResponse.json({ error: '히스토리 삭제 실패' }, { status: 500 })
  }
}
