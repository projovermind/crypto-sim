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

const echoCache: Record<string, string> = {}
async function getEchobitAsset(name: string): Promise<string> {
  if (echoCache[name]) return echoCache[name]
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'echobit', name))
    echoCache[name] = `data:image/png;base64,${buf.toString('base64')}`
  } catch { echoCache[name] = '' }
  return echoCache[name]
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

    // ?factor=0.8~1 : Last Price 가 독립변수 — 원래 청산가까지 간 거리의 factor 만큼만 가고(원본보다 덜 번다),
    // ROE 는 그 가격 변동 × 배율로 종속된다. ?lev=1~125 로 배율을 달리 표시하면 ROE 도 배율에 비례해 달라진다.
    let displayRoe = pnlData.roe
    let displayLast = closePrice
    let displayLev = position.leverage
    const factorRaw = request.nextUrl.searchParams.get('factor')
    const factor = factorRaw !== null ? parseFloat(factorRaw) : NaN
    if (Number.isFinite(factor) && factor >= 0.8 && factor <= 1) {
      const levRaw = parseFloat(request.nextUrl.searchParams.get('lev') ?? '')
      if (Number.isFinite(levRaw) && levRaw >= 1 && levRaw <= 125) displayLev = Math.round(levRaw)
      const move = (closePrice - position.entryPrice) / position.entryPrice // 실제 가격 변동률(부호 포함)
      displayLast = entryPrice * (1 + move * factor)
      displayRoe = pnlData.roe * factor * (displayLev / position.leverage)
    }

    const cardDate = position.closedAt ? new Date(position.closedAt) : new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const dateStr = `${cardDate.getFullYear()}-${pad(cardDate.getMonth() + 1)}-${pad(cardDate.getDate())} ${pad(cardDate.getHours())}:${pad(cardDate.getMinutes())}:${pad(cardDate.getSeconds())}`

    // ── ?design=echobit : public/echobit/README.md·layout*.txt 규격 (672x856, 336x428 좌표계 ×2) ──
    if (request.nextUrl.searchParams.get('design') === 'echobit') {
      const S = 2
      const echoBg = await getEchobitAsset(bgIdx === 1 ? 'position-share-2.png' : 'position-share-1.png')
      const echoLogo = await getEchobitAsset('header-logo.png')
      const GREEN = '#44c17b', RED = '#ef5532', GRAY = '#8b8a90', WHITE = '#ffffff', PURPLE = '#944af9'
      const valColor = isProfit ? GREEN : RED
      const sideTxtColor = position.side === 'LONG' ? GREEN : RED
      const roiStr = (displayRoe >= 0.005 ? '+' : '') + formatNumber(displayRoe) + '%'
      const pnlStr = (pnlData.pnl >= 0.00005 ? '+' : '') + formatNumber(pnlData.pnl, 4)
      const fmtOpen = (p: number) => p.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: p >= 1000 ? 1 : p >= 1 ? 2 : p >= 0.01 ? 4 : 8 })
      const fmtLast = (p: number) => formatNumber(p, p >= 1000 ? 1 : p >= 1 ? 2 : p >= 0.01 ? 4 : 8)
      const echoDate = dateStr.slice(0, 16)
      // baseline y → top (lineHeight=글자크기, Inter 기준 baseline ≈ top + 0.864·fs)
      const T = (base: number, fs: number) => (base - 0.864 * fs) * S
      const txt = (s: string, x: number, base: number, fs: number, color: string) => (
        <div style={{ position: 'absolute', left: x * S, top: T(base, fs), fontSize: fs * S, lineHeight: `${fs * S}px`, color, fontWeight: 600, whiteSpace: 'nowrap', display: 'flex' }}>{s}</div>
      )
      return new ImageResponse(
        (
          <div style={{ width: 336 * S, height: 428 * S, position: 'relative', display: 'flex', fontFamily: 'Inter', backgroundColor: '#000' }}>
            {echoBg && <img src={echoBg} width={336 * S} height={428 * S} style={{ position: 'absolute', left: 0, top: 0, width: 336 * S, height: 428 * S }} />}
            {echoLogo && <img src={echoLogo} width={95 * S} height={22 * S} style={{ position: 'absolute', left: 221 * S, top: 20 * S, width: 95 * S, height: 22 * S }} />}
            {txt(echoDate, 20, 30, 10, WHITE)}
            {txt(`${position.symbol} Perpetual`, 20, 79, 18, WHITE)}
            {/* 종목명 너비에 따라 5X / Open long 가로 배치 (간격 9, 5X 너비 ≈10) */}
            {(() => {
              const nameW = (`${position.symbol} Perpetual`.length) * 18 * 0.569 // 실측: 'TBTCTUSDT Perpetual' 5X x=223.65
              const x5 = 20 + nameW + 9
              const w5 = `${displayLev}X`.length * 6.3 // 실측: '5X' 너비 12.58
              return (
                <>
                  {txt(`${displayLev}X`, x5, 76, 10, PURPLE)}
                  {txt(position.side === 'LONG' ? 'Open long' : 'Open short', x5 + w5 + 9, 76, 10, sideTxtColor)}
                </>
              )
            })()}
            {txt('ROI', 20, 108, 11, GRAY)}
            {txt(roiStr, 20, 152.4, 48, valColor)}
            {txt('PNL(USDT)', 20, 187, 11, GRAY)}
            {txt(pnlStr, 20, 210.6, 22, valColor)}
            {txt('Opening price', 20, 239, 10, GRAY)}
            {txt(fmtOpen(entryPrice), 20, 257.2, 14, WHITE)}
            {txt('Latest price', 20, 284, 10, GRAY)}
            {txt(fmtLast(displayLast), 20, 302.2, 14, WHITE)}
          </div>
        ),
        {
          width: 336 * S,
          height: 428 * S,
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
          ],
        },
      )
    }

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
                <span style={{ color: '#fff' }}>{displayLev}X</span>
              </div>
            </div>
          </div>

          {/* ROE + PNL */}
          <div style={{ display: 'flex', flexDirection: 'column', margin: '0 20px' }}>
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
              <div style={{ fontSize: 12, lineHeight: '16px', color: 'rgba(255,255,255,0.8)', marginBottom: 0 }}>ROE</div>
              <div style={{ fontSize: 44, lineHeight: '44px', color: pnlColor, fontWeight: 600 }}>
                {`${isProfit ? '+' : ''}${formatNumber(displayRoe)}%`}
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
              <span style={{ fontWeight: 600, marginLeft: 4 }}>{formatPrice(displayLast)}</span>
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
