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

    // ── 자동 증가 로직 (GET 호출 시 실행) ──
    const now = new Date()
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
    let _genChanged = false
    const autoUpdate: Record<string, unknown> = {}

    // 매월 1일: 기수 +1 + 구독자수 초기화 (800~1100 랜덤) — genAutoIncrement 활성 시만
    const resetDay = u.subscriberResetDay ? new Date(u.subscriberResetDay as string) : null
    if (u.genAutoIncrement && now.getDate() === 1 && (!resetDay || resetDay.getMonth() !== now.getMonth() || resetDay.getFullYear() !== now.getFullYear())) {
      if (u.channelGeneration != null) {
        autoUpdate.channelGeneration = (Number(u.channelGeneration) || 0) + 1
        _genChanged = true
      }
      autoUpdate.subscriberCount = rand(800, 1100)
      autoUpdate.subscriberResetDay = todayStart
    }

    // 매일 00시 이후: 구독자수 +17~31 — genAutoIncrement 활성 + 구독자수 설정된 경우만
    const lastDaily = u.subscriberLastDaily ? new Date(u.subscriberLastDaily as string) : null
    if (u.genAutoIncrement && Number(u.subscriberCount) > 0 && (!lastDaily || lastDaily.getTime() < todayStart.getTime())) {
      autoUpdate.subscriberCount = (Number(autoUpdate.subscriberCount ?? u.subscriberCount) || 0) + rand(17, 31)
      autoUpdate.subscriberLastDaily = todayStart
    }

    if (Object.keys(autoUpdate).length > 0) {
      const { prisma: p } = await import('@/lib/prisma')
      await p.user.update({ where: { id: user.id }, data: autoUpdate as any })
      // 로컬 값 반영
      for (const k of Object.keys(autoUpdate)) (u as any)[k] = autoUpdate[k]
    }

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

      channelName: (u.channelName as string) || null,
      channelGeneration: u.channelGeneration != null ? Number(u.channelGeneration) : null,
      subscriberCount: Number(u.subscriberCount) || 0,
      channelAvatarUrl: (u.channelAvatarUrl as string) || null,
      userName: (u.name as string) || null,
      nickname1: (u.nickname1 as string) || null,
      nickname2: (u.nickname2 as string) || null,

      // ── 반응 개수 — 유형별 JSON ──
      reactionSettings: (() => {
        try { return u.reactionSettings ? JSON.parse(u.reactionSettings as string) : null } catch { return null }
      })(),
      // 전역 기본값 (유형별 설정 없으면 폴백)
      reactions: {
        heart: { min: Number(u.reactionHeartMin ?? 20), max: Number(u.reactionHeartMax ?? 30) },
        thumb: { min: Number(u.reactionThumbMin ?? 20), max: Number(u.reactionThumbMax ?? 30) },
        fire:  { min: Number(u.reactionFireMin  ?? 20), max: Number(u.reactionFireMax  ?? 30) },
      },

      // ── 템플릿별 이미지 URL (DB키 → 확장키 매핑) ──
      templateImages: (() => {
        try {
          console.log('[settings] teleditTemplateImages raw:', u.teleditTemplateImages)
          const raw = u.teleditTemplateImages ? JSON.parse(u.teleditTemplateImages as string) : {}
          // DB 필드명 → 확장 slot.templateKey 매핑 (templates 섹션과 동일 키)
          const keyMap: Record<string, string> = {
            teleditPreEntryTemplate: 'preEntry',
            teledditLongTemplate: 'long',
            teledditShortTemplate: 'short',
            teleditPostEntryTemplate: 'postEntry',
            teleditPostEntry1Template: 'postEntry1',
            teleditPostEntry2Template: 'postEntry2',
            teleditPostEntry3Template: 'postEntry3',
            teleditPreCloseTemplate: 'preClose',
            teleditCloseTemplate: 'close',
            teleditPostClose1Template: 'postClose1',
            teleditPostClose2Template: 'postClose2',
            teleditPostClose3Template: 'postClose3',
            teleditProfitTemplate: 'profit1',
            teleditProfitTemplate2: 'profit2',
          }
          const mapped: Record<string, string> = {}
          for (const [dbKey, url] of Object.entries(raw)) {
            const shortKey = keyMap[dbKey] || dbKey
            if (url) mapped[shortKey] = url as string
          }
          return mapped
        } catch { return {} }
      })(),

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
