import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

/** min~max 범위 랜덤 정수 (둘 다 0이면 0 반환) */
function randInt(min: number, max: number): number {
  if (min === 0 && max === 0) return 0
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// POST /api/admin/backfill-comment-counts
export async function POST(request: NextRequest) {
  try {
    // ── 인증: ADMIN만 허용 ──
    const admin = await getAuthUser(request)
    if (!admin || admin.role !== 'ADMIN') {
      return NextResponse.json({ error: 'ADMIN 권한이 필요합니다.' }, { status: 403 })
    }

    // ── Step 1: 기존 유저 commentMin/Max 기본값 일괄 업데이트 ──
    const updatedUsers = await prisma.user.updateMany({
      where: {
        preEntryCommentMin: 0,
        preEntryCommentMax: 0,
        closeCommentMin: 0,
        closeCommentMax: 0,
      },
      data: {
        preEntryCommentMin: 12,
        preEntryCommentMax: 31,
        longCommentMin: 0,
        longCommentMax: 2,
        shortCommentMin: 0,
        shortCommentMax: 2,
        postEntryCommentMin: 8,
        postEntryCommentMax: 32,
        preCloseCommentMin: 0,
        preCloseCommentMax: 3,
        closeCommentMin: 5,
        closeCommentMax: 14,
        profit1CommentMin: 8,
        profit1CommentMax: 23,
        profit2CommentMin: 16,
        profit2CommentMax: 42,
      },
    })

    // ── Step 2: 기존 포지션 소급 처리 ──
    // positionCommentCount가 없는 모든 Position 조회 (deletedAt 무관 전체)
    const positionsWithoutCounts = await prisma.position.findMany({
      where: {
        positionCommentCount: null,
      },
      select: {
        id: true,
        userId: true,
        side: true,
      },
    })

    if (positionsWithoutCounts.length === 0) {
      return NextResponse.json({
        updatedUsers: updatedUsers.count,
        backfilledPositions: 0,
      })
    }

    // 유저 설정 캐시 (userId → user settings)
    const userIds = [...new Set(positionsWithoutCounts.map((p) => p.userId))]
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        preEntryCommentMin: true,
        preEntryCommentMax: true,
        longCommentMin: true,
        longCommentMax: true,
        shortCommentMin: true,
        shortCommentMax: true,
        postEntryCommentMin: true,
        postEntryCommentMax: true,
        preCloseCommentMin: true,
        preCloseCommentMax: true,
        closeCommentMin: true,
        closeCommentMax: true,
        profit1CommentMin: true,
        profit1CommentMax: true,
        profit2CommentMin: true,
        profit2CommentMax: true,
      },
    })
    const userMap = new Map(users.map((u) => [u.id, u]))

    // 각 포지션에 대해 랜덤 카운트 생성
    const commentCounts = positionsWithoutCounts.map((pos) => {
      const settings = userMap.get(pos.userId)
      const isLong = pos.side === 'LONG'

      return {
        positionId: pos.id,
        preEntryCount: randInt(
          settings?.preEntryCommentMin ?? 12,
          settings?.preEntryCommentMax ?? 31,
        ),
        longCount: isLong
          ? randInt(settings?.longCommentMin ?? 0, settings?.longCommentMax ?? 2)
          : 0,
        shortCount: !isLong
          ? randInt(settings?.shortCommentMin ?? 0, settings?.shortCommentMax ?? 2)
          : 0,
        postEntryCount: randInt(
          settings?.postEntryCommentMin ?? 8,
          settings?.postEntryCommentMax ?? 32,
        ),
        preCloseCount: randInt(
          settings?.preCloseCommentMin ?? 0,
          settings?.preCloseCommentMax ?? 3,
        ),
        closeCount: randInt(
          settings?.closeCommentMin ?? 5,
          settings?.closeCommentMax ?? 14,
        ),
        profit1Count: randInt(
          settings?.profit1CommentMin ?? 8,
          settings?.profit1CommentMax ?? 23,
        ),
        profit2Count: randInt(
          settings?.profit2CommentMin ?? 16,
          settings?.profit2CommentMax ?? 42,
        ),
      }
    })

    const result = await prisma.positionCommentCount.createMany({
      data: commentCounts,
    })

    return NextResponse.json({
      updatedUsers: updatedUsers.count,
      backfilledPositions: result.count,
    })
  } catch (error) {
    console.error('POST /api/admin/backfill-comment-counts error:', error)
    return NextResponse.json(
      { error: '소급 처리 중 오류가 발생했습니다.' },
      { status: 500 },
    )
  }
}
