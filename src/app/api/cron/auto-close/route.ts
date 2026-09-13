import { NextRequest, NextResponse } from 'next/server'
import { runAutoClose } from '@/lib/auto-close'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Vercel Cron 은 Authorization: Bearer $CRON_SECRET 로 호출한다.
// 수동 실행 편의를 위해 x-cron-secret 헤더도 허용.
function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return false

  const bearer = request.headers.get('authorization')
  if (bearer === `Bearer ${secret}`) return true

  return request.headers.get('x-cron-secret') === secret
}

// GET /api/cron/auto-close?limit=200&dryRun=1
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  const { searchParams } = new URL(request.url)
  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '200'), 1), 1000)
  const dryRun = searchParams.get('dryRun') === '1'

  try {
    const summary = await runAutoClose({ limit, dryRun })
    return NextResponse.json({ ok: true, dryRun, ...summary })
  } catch (error) {
    console.error('[cron/auto-close] 실행 실패:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '자동 종료 처리에 실패했습니다.' },
      { status: 500 }
    )
  }
}
