import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

// 기본 템플릿 (DB에 NULL이면 사용)
const DEFAULTS = {
  teleditPreEntryTemplate: '⏳ {{symbol}} {{side}} {{leverage}}x | 진입 예정 ${{entryPrice}}',
  teledditLongTemplate: '🟢 {{symbol}} LONG {{leverage}}x | 진입 ${{entryPrice}}',
  teledditShortTemplate: '🔴 {{symbol}} SHORT {{leverage}}x | 진입 ${{entryPrice}}',
  teleditPostEntryTemplate: '📊 {{symbol}} {{side}} {{leverage}}x | 진입 완료 ${{entryPrice}}',
  teleditPostEntry1Template: null,
  teleditPostEntry2Template: null,
  teleditPostEntry3Template: null,
  teleditPreCloseTemplate: '⏳ {{symbol}} {{side}} | 청산 예정 PnL {{pnl}}USDT ({{roe}}%)',
  teleditCloseTemplate: '🔴 {{symbol}} {{side}} 청산 | PnL {{pnl}}USDT ({{roe}}%)',
  teleditPostClose1Template: null,
  teleditPostClose2Template: null,
  teleditPostClose3Template: null,
  teleditProfitTemplate: '💰 수익 인증\n{{symbol}} {{side}} {{leverage}}x\n진입 ${{entryPrice}} → 청산 ${{closePrice}}\nPnL {{pnl}}USDT ({{roe}}%)',
  teleditProfitTemplate2: '📈 수익 인증\n{{symbol}} {{side}} {{leverage}}x\nPnL {{pnl}}USDT ({{roe}}%)',
}

/**
 * GET /api/user/settings
 * 확장에서 사용할 유저의 Teledit 메시지 설정 (템플릿 + 타이밍 + 활성화)
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401, headers: CORS_HEADERS })
    }

    const u = user as Record<string, unknown>

    const settings = {
      // ── 템플릿 (NULL이면 기본값) ──
      templates: {
        preEntry:    u.teleditPreEntryTemplate   || DEFAULTS.teleditPreEntryTemplate,
        long:        u.teledditLongTemplate      || DEFAULTS.teledditLongTemplate,
        short:       u.teledditShortTemplate     || DEFAULTS.teledditShortTemplate,
        postEntry:   u.teleditPostEntryTemplate  || DEFAULTS.teleditPostEntryTemplate,
        postEntry1:  u.teleditPostEntry1Template || DEFAULTS.teleditPostEntry1Template,
        postEntry2:  u.teleditPostEntry2Template || DEFAULTS.teleditPostEntry2Template,
        postEntry3:  u.teleditPostEntry3Template || DEFAULTS.teleditPostEntry3Template,
        preClose:    u.teleditPreCloseTemplate   || DEFAULTS.teleditPreCloseTemplate,
        close:       u.teleditCloseTemplate      || DEFAULTS.teleditCloseTemplate,
        postClose1:  u.teleditPostClose1Template || DEFAULTS.teleditPostClose1Template,
        postClose2:  u.teleditPostClose2Template || DEFAULTS.teleditPostClose2Template,
        postClose3:  u.teleditPostClose3Template || DEFAULTS.teleditPostClose3Template,
        profit1:     u.teleditProfitTemplate     || DEFAULTS.teleditProfitTemplate,
        profit2:     u.teleditProfitTemplate2    || DEFAULTS.teleditProfitTemplate2,
      },

      // ── 활성화 ──
      enabled: {
        preEntry:    u.teleditPreEntryEnabled   ?? true,
        long:        u.teledditLongEnabled      ?? true,
        short:       u.teledditShortEnabled     ?? true,
        postEntry:   u.teleditPostEntryEnabled  ?? true,
        postEntry1:  u.teleditPostEntry1Enabled ?? true,
        postEntry2:  u.teleditPostEntry2Enabled ?? true,
        postEntry3:  u.teleditPostEntry3Enabled ?? true,
        preClose:    u.teleditPreCloseEnabled   ?? true,
        close:       u.teleditCloseEnabled      ?? true,
        postClose1:  u.teleditPostClose1Enabled ?? true,
        postClose2:  u.teleditPostClose2Enabled ?? true,
        postClose3:  u.teleditPostClose3Enabled ?? true,
        profit1:     u.teleditProfitEnabled     ?? true,
        profit2:     u.teleditProfit2Enabled    ?? true,
      },

      // ── 댓글 수 (min/max) ──
      commentCounts: {
        preEntry:  { min: Number(u.preEntryCommentMin  ?? 0), max: Number(u.preEntryCommentMax  ?? 0) },
        long:      { min: Number(u.longCommentMin      ?? 0), max: Number(u.longCommentMax      ?? 0) },
        short:     { min: Number(u.shortCommentMin     ?? 0), max: Number(u.shortCommentMax     ?? 0) },
        postEntry: { min: Number(u.postEntryCommentMin ?? 0), max: Number(u.postEntryCommentMax ?? 0) },
        preClose:  { min: Number(u.preCloseCommentMin  ?? 0), max: Number(u.preCloseCommentMax  ?? 0) },
        close:     { min: Number(u.closeCommentMin     ?? 0), max: Number(u.closeCommentMax     ?? 0) },
        profit1:   { min: Number(u.profit1CommentMin   ?? 0), max: Number(u.profit1CommentMax   ?? 0) },
        profit2:   { min: Number(u.profit2CommentMin   ?? 0), max: Number(u.profit2CommentMax   ?? 0) },
      },

      // ── 타이밍 (초) ──
      timing: {
        preEntryMin:  u.preEntryMinSec  ?? 60,
        preEntryMax:  u.preEntryMaxSec  ?? 120,
        postEntryMin: u.postEntryMinSec ?? 30,
        postEntryMax: u.postEntryMaxSec ?? 60,
        preCloseMin:  u.preCloseMinSec  ?? 60,
        preCloseMax:  u.preCloseMaxSec  ?? 120,
        profit1Min:   u.profit1MinSec   ?? 30,
        profit1Max:   u.profit1MaxSec   ?? 60,
        profit2Min:   u.profit2MinSec   ?? 30,
        profit2Max:   u.profit2MaxSec   ?? 60,
      },
    }

    return NextResponse.json(settings, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('GET /api/user/settings error:', error)
    return NextResponse.json({ error: '설정 조회 실패' }, { status: 500, headers: CORS_HEADERS })
  }
}
