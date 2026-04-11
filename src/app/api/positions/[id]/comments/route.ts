import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// GET /api/positions/[id]/comments — 포지션의 상황별 메시지 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json(
        { error: '인증이 필요합니다.' },
        { status: 401, headers: CORS_HEADERS },
      )
    }

    const position = await prisma.position.findUnique({
      where: { id: params.id },
      select: { userId: true },
    })

    if (!position) {
      return NextResponse.json(
        { error: '포지션을 찾을 수 없습니다.' },
        { status: 404, headers: CORS_HEADERS },
      )
    }

    if (position.userId !== user.id) {
      return NextResponse.json(
        { error: '권한이 없습니다.' },
        { status: 403, headers: CORS_HEADERS },
      )
    }

    const comments = await prisma.positionComment.findMany({
      where: { positionId: params.id },
      orderBy: { orderIndex: 'asc' },
      select: {
        id: true,
        messageType: true,
        authorName: true,
        avatarUrl: true,
        content: true,
        orderIndex: true,
      },
    })

    return NextResponse.json({ comments }, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('GET /api/positions/[id]/comments error:', error)
    return NextResponse.json(
      { error: '댓글 조회 중 오류가 발생했습니다.' },
      { status: 500, headers: CORS_HEADERS },
    )
  }
}
