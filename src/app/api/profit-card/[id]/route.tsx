import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'
import { prisma } from '@/lib/prisma'
import { calculatePnL, formatPrice, formatNumber } from '@/lib/calculations'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { INTER_REGULAR_B64, INTER_SEMIBOLD_B64, INTER_BOLD_B64 } from '../font-data'
import { POSTER_BG_1_B64, POSTER_BG_2_B64, POSTER_BG_3_B64 } from '../poster-data'

export const runtime = 'nodejs'

const AUTH_SECRET = process.env.NEXTAUTH_SECRET || 'crypto-sim-secret-key-change-in-production'

function corsResponse(body: string | null, status: number) {
  return new NextResponse(body, {
    status,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}

export async function OPTIONS() {
  return corsResponse(null, 204)
}

// ── 폰트: base64 임베드 → 파일시스템/Lambda 환경 무관 ───────────────────────
function b64ToArrayBuffer(b64: string): ArrayBuffer {
  const bin = Buffer.from(b64, 'base64')
  const ab = new ArrayBuffer(bin.byteLength)
  new Uint8Array(ab).set(bin)
  return ab
}

const FONT_REGULAR  = b64ToArrayBuffer(INTER_REGULAR_B64)
const FONT_SEMIBOLD = b64ToArrayBuffer(INTER_SEMIBOLD_B64)
const FONT_BOLD     = b64ToArrayBuffer(INTER_BOLD_B64)

// ── 포스터 배경: base64 임베드 (Lambda 파일시스템 무관) ─────────────────────
const POSTER_B64 = [POSTER_BG_1_B64, POSTER_BG_2_B64, POSTER_BG_3_B64]

function getBg(idx: number): string {
  const b64 = POSTER_B64[idx] ?? POSTER_B64[0]
  return b64 ? `data:image/png;base64,${b64}` : ''
}

// ── 로고: 파일시스템 (소용량, 이미 작동 확인) ────────────────────────────────
let logoCache = ''

async function getLogo(): Promise<string> {
  if (logoCache) return logoCache
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'tapbit-logo.png'))
    logoCache = `data:image/png;base64,${buf.toString('base64')}`
  } catch { logoCache = '' }
  return logoCache
}

// Tapbit candle icon (ProfitCard.tsx에서 그대로)
const PERPETUAL_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAHmSURBVHgB7ZcxS8NAFMdfRCGgSEZdSscKFTuKiGQR6ib4BZzEQVwcHMW5i6OjiEPHjo6OHTt2DCLoGApCwCG+Ry/4cvWSS5q7iuQHjyTNvd4/9969uwOomQ8HLBLHsYeXc7QIre84zkeezxLYZRfNRfPEfS62BboF21sXWBgtgZg7LlpH5JBVljXbHaO16AZFPmByB2AJXYEb7F57FMWIewpfikqTt//tw3UFFgY79/HiZzRpCeM+VHYoQlHym8lJ4kNxKFIp0UYEVjmZrJSZw6MTWFndVFrw+qb0nclB/Hqq8HKV5yPSFfmVEKI96yxbZUiNoJhVXSGIG8eV3pHPKRhCDnHZ3HFNFXFlmQnDCVxd3ygdd7a34PLiDEyjFjgJ4fGpr3Q82N+zIvDPbxaMrSScTrud+d5bX1O+syKw17uFshgJMdZEqo0RlCPkDyZzcCB3lgN90Iu8ozEWYuxojJcx/w1rJe0rO+JxhG0Gef+jFNhsNODr8x0WTZUhLptzmcgCKSRF8iZhyDeZVZIKMXWCeXIP0w0APyJ22fMILWDvQpNnlJkcFCMhJ7cPPwIDbDMCS/yPc/EisS1wCNNJSGmklSZW1uIEcSy4K+JTh3hedAXyIlymkJuFDkS00IsjaU1NlXwDc0KDXXaFRUEAAAAASUVORK5CYII='

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // next-auth/jwt getToken handles both JWE (extension Bearer) and JWS tokens
    const token = await getToken({ req: request, secret: AUTH_SECRET })
    if (!token) return corsResponse('Unauthorized', 401)

    let userId = (token.id as string) || ''
    if (!userId && token.email) {
      const u = await prisma.user.findUnique({ where: { email: token.email as string }, select: { id: true } })
      if (u) userId = u.id
    }
    if (!userId) return corsResponse('Unauthorized', 401)

    const position = await prisma.position.findUnique({ where: { id: params.id } })
    if (!position) return corsResponse('Not found', 404)
    if (position.userId !== userId) return corsResponse('Forbidden', 403)

    // shareImageUrl 무시 — 항상 satori로 생성 (배경+폰트 보장)

    const bgIdx = parseInt(request.nextUrl.searchParams.get('bg') || '0')
    const bgSrc = getBg(bgIdx)
    const logoSrc = await getLogo()


    // ProfitCard.tsx와 동일한 계산
    const closePrice = position.closedPrice ?? position.entryPrice
    const pnlData = calculatePnL(
      position.side as 'LONG' | 'SHORT',
      position.entryPrice, closePrice,
      position.leverage, position.amount,
      position.quantity, position.entryFee,
    )
    const isProfit  = pnlData.pnl >= 0
    const pnlColor  = isProfit ? '#00ff85' : '#ff3d55'
    const sideColor = position.side === 'LONG' ? '#00ff85' : '#ff3d55'
    const entryPrice = (position as any).inputPrice ?? position.entryPrice

    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    // ── JSX: ProfitCard.tsx와 1:1 동일 구조 ─────────────────────────────────
    return new ImageResponse(
      (
        // 배경 레이어 + 콘텐츠 레이어를 명시적으로 분리
        // satori: flex container 안 absolute img는 content 위에 렌더될 수 있음
        // → 배경을 가장 바깥 wrapper에 두고, 콘텐츠를 그 위 flex div에 배치
        <div
          style={{
            width: 362, height: 500, position: 'relative', display: 'flex',
          }}
        >
          {/* Layer 0: 검정 바탕 */}
          <div style={{
            position: 'absolute', top: 0, left: 0, width: 362, height: 500,
            backgroundColor: 'rgb(2,5,13)', borderRadius: 12, display: 'flex',
          }} />
          {/* Layer 1: 배경 이미지 (포스터) */}
          {bgSrc && (
            <img
              src={bgSrc}
              width={362}
              height={500}
              style={{
                position: 'absolute', top: 0, left: 0,
                width: 362, height: 500, borderRadius: 12,
              }}
            />
          )}
          {/* Layer 2: 콘텐츠 (배경 위) */}
          <div
            style={{
              width: 362, height: 500, borderRadius: 12,
              fontFamily: 'Inter',
              position: 'relative', overflow: 'hidden',
              display: 'flex', flexDirection: 'column',
            }}
          >
          {/* Header: 60px */}
          <div style={{ display: 'flex', alignItems: 'center', height: 60, padding: '0 20px', position: 'relative' }}>
            {logoSrc
              ? <img src={logoSrc} style={{ height: 20 }} />
              : <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>TAPBIT</span>
            }

            {/* Perpetual 배지 */}
            <div style={{
              position: 'absolute', top: -1, right: -1, height: 38,
              padding: '0 20px', display: 'flex', alignItems: 'center',
              background: 'linear-gradient(90deg, transparent 0%, rgba(19,21,29,0.7) 20%, rgba(19,21,29,0.9) 100%)',
              color: '#888',
            }}>
              <img src={PERPETUAL_ICON} style={{ width: 20, height: 20, marginRight: 8 }} />
              <span style={{ height: 20, lineHeight: '20px', fontSize: 14, fontWeight: 600 }}>Perpetual</span>
            </div>

            {/* 하단 라인 */}
            <div style={{ position: 'absolute', left: 20, right: 20, bottom: 0, height: 1, background: '#1b1e25' }} />
          </div>

          {/* Symbol + Tags */}
          <div style={{ display: 'flex', padding: '12px 20px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>
              <span style={{ color: '#fff' }}>{position.symbol}</span>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <i style={{ margin: '1px 12px', width: 1, height: 16, background: 'hsla(0,0%,100%,.2)', display: 'block' }} />
                <span style={{ color: sideColor }}>{position.side === 'LONG' ? 'Long' : 'Short'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <i style={{ margin: '1px 12px', width: 1, height: 16, background: 'hsla(0,0%,100%,.2)', display: 'block' }} />
                <span style={{ color: '#fff' }}>{position.leverage}X</span>
              </div>
            </div>
          </div>

          {/* ROE + PNL */}
          <div style={{ display: 'flex', flexDirection: 'column', margin: '0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
              <div style={{ fontSize: 12, lineHeight: '16px', color: 'rgba(255,255,255,0.8)', marginBottom: 0 }}>ROE</div>
              <div style={{ fontSize: 44, lineHeight: '44px', color: pnlColor, fontWeight: 600 }}>
                {`${isProfit ? '+' : ''}${formatNumber(pnlData.roe)}%`}
              </div>
            </div>

            {/* Entry Price */}
            <div style={{ display: 'flex', fontSize: 12, lineHeight: '14px', color: '#fff', marginBottom: 6 }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Entry Price: </span>
              <span style={{ fontWeight: 600, marginLeft: 4 }}>{formatPrice(entryPrice)}</span>
            </div>

            {/* Last Price */}
            <div style={{ display: 'flex', fontSize: 12, lineHeight: '14px', color: '#fff' }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Last Price: </span>
              <span style={{ fontWeight: 600, marginLeft: 4 }}>{formatPrice(closePrice)}</span>
            </div>
          </div>

          {/* Timestamp */}
          <div style={{ display: 'flex', position: 'absolute', bottom: 16, left: 20, fontSize: 12, lineHeight: '14px', color: '#94979e' }}>
            {dateStr}
          </div>
          </div>
        </div>
      ),
      {
        width: 362,
        height: 500,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Cache-Control': 'no-store, no-cache, must-revalidate',
          'Pragma': 'no-cache',
        },
        fonts: [
          { name: 'Inter', data: FONT_REGULAR,  weight: 400 as const, style: 'normal' as const },
          { name: 'Inter', data: FONT_SEMIBOLD, weight: 600 as const, style: 'normal' as const },
          { name: 'Inter', data: FONT_BOLD,     weight: 700 as const, style: 'normal' as const },
        ],
      },
    )
  } catch (error) {
    console.error('GET /api/profit-card/[id] error:', error)
    return corsResponse('Image generation failed', 500)
  }
}
