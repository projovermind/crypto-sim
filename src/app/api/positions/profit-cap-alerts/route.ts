import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { expiryMs, profitCapDeadlineMs } from '@/lib/auto-close-rules'

export const dynamic = 'force-dynamic'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// GET /api/positions/profit-cap-alerts
// 수익 상한에 도달해 유예 중인(아직 OPEN) 내 포지션 목록.
// deadlineAt 을 넘기면 크론이 CLOSED_TP 로 강제 종료한다.
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401, headers: CORS_HEADERS })
    }

    const positions = await prisma.position.findMany({
      where: {
        userId: user.id,
        deletedAt: null,
        status: 'OPEN',
        profitCapAt: { not: null },
      },
      orderBy: { profitCapAt: 'asc' },
      select: {
        id: true,
        positionNumber: true,
        symbol: true,
        side: true,
        profitCapAt: true,
        entryTime: true,
      },
    })

    const alerts = positions.map((p) => {
      const capDeadline = profitCapDeadlineMs(p.profitCapAt)
      const expiry = expiryMs(p.entryTime)
      // 유예 마감과 기간 만료 중 먼저 오는 쪽이 실제 강제 종료 시점이다.
      const effective =
        capDeadline === null ? expiry : expiry === null ? capDeadline : Math.min(capDeadline, expiry)

      return {
        id: p.id,
        positionNumber: p.positionNumber,
        symbol: p.symbol,
        side: p.side,
        profitCapAt: p.profitCapAt,
        deadlineAt: effective === null ? null : new Date(effective),
        entryTime: p.entryTime,
      }
    })

    return NextResponse.json({ positions: alerts }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('GET /api/positions/profit-cap-alerts error:', error)
    return NextResponse.json(
      { error: '수익 상한 알림 조회 중 오류가 발생했습니다.' },
      { status: 500, headers: CORS_HEADERS }
    )
  }
}
