import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { calculatePnL, formatPrice, formatNumber } from '@/lib/calculations'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'

const JWT_SECRET = new TextEncoder().encode(
  process.env.NEXTAUTH_SECRET || 'crypto-sim-secret-key-change-in-production',
)

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

// ── 캐시 ─────────────────────────────────────────────────────────────────────
let bgCache: Record<string, string> = {}
let fontCache: Record<string, ArrayBuffer> = {}
let logoCache: string = ''

async function getBg(idx: number): Promise<string> {
  const key = `bg${idx + 1}`
  if (bgCache[key]) return bgCache[key]
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'posters', `${key}.png`))
    bgCache[key] = `data:image/png;base64,${buf.toString('base64')}`
  } catch { bgCache[key] = '' }
  return bgCache[key]
}

async function getLogo(): Promise<string> {
  if (logoCache) return logoCache
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'tapbit-logo.png'))
    logoCache = `data:image/png;base64,${buf.toString('base64')}`
  } catch { logoCache = '' }
  return logoCache
}

async function getFont(name: string): Promise<ArrayBuffer> {
  if (fontCache[name]) return fontCache[name]
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'fonts', `${name}.ttf`))
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    if (ab.byteLength > 1000) { fontCache[name] = ab; return ab }
  } catch { /* ignore */ }
  try {
    const base = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000'
    const res = await fetch(`${base}/fonts/${name}.ttf`)
    if (res.ok) { fontCache[name] = await res.arrayBuffer(); return fontCache[name] }
  } catch { /* ignore */ }
  return new ArrayBuffer(0)
}

// 거래소 아이콘 (포지션카드 컴포넌트에서 그대로)
const EXCHANGE_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAHmSURBVHgB7ZcxS8NAFMdfRCGgSEZdSscKFTuKiGQR6ib4BZzEQVwcHMW5i6OjiEPHjo6OHTt2DCLoGApCwCG+Ry/4cvWSS5q7iuQHjyTNvd4/9969uwOomQ8HLBLHsYeXc7QIre84zkeezxLYZRfNRfPEfS62BboF21sXWBgtgZg7LlpH5JBVljXbHaO16AZFPmByB2AJXYEb7F57FMWIewpfikqTt//tw3UFFgY79/HiZzRpCeM+VHYoQlHym8lJ4kNxKFIp0UYEVjmZrJSZw6MTWFndVFrw+qb0nclB/Hqq8HKV5yPSFfmVEKI96yxbZUiNoJhVXSGIG8eV3pHPKRhCDnHZ3HFNFXFlmQnDCVxd3ygdd7a34PLiDEyjFjgJ4fGpr3Q82N+zIvDPbxaMrSScTrud+d5bX1O+syKw17uFshgJMdZEqo0RlCPkDyZzcCB3lgN90Iu8ozEWYuxojJcx/w1rJe0rO+JxhG0Gef+jFNhsNODr8x0WTZUhLptzmcgCKSRF8iZhyDeZVZIKMXWCeXIP0w0APyJ22fMILWDvQpNnlJkcFCMhJ7cPPwIDbDMCS/yPc/EisS1wCNNJSGmklSZW1uIEcSy4K+JTh3hedAXyIlymkJuFDkS00IsjaU1NlXwDc0KDXXaFRUEAAAAASUVORK5CYII='

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) return corsResponse('Unauthorized', 401)
    let userId: string
    try {
      const { payload } = await jwtVerify(authHeader.slice(7), JWT_SECRET)
      userId = (payload as any).userId ?? (payload as any).id ?? ''
      if (!userId) {
        const email = (payload as any).email
        if (email) {
          const u = await prisma.user.findUnique({ where: { email }, select: { id: true } })
          if (u) userId = u.id
        }
      }
      if (!userId) return corsResponse('Unauthorized', 401)
    } catch { return corsResponse('Invalid token', 401) }

    const position = await prisma.position.findUnique({ where: { id: params.id } })
    if (!position) return corsResponse('Not found', 404)
    if (position.userId !== userId) return corsResponse('Forbidden', 403)

    const bgIdx = parseInt(request.nextUrl.searchParams.get('bg') || '0')
    const [bgSrc, logoSrc, fontRegular, fontSemiBold, fontBold] = await Promise.all([
      getBg(bgIdx),
      getLogo(),
      getFont('Inter-Regular'),
      getFont('Inter-SemiBold'),
      getFont('Inter-Bold'),
    ])

    const closePrice = position.closedPrice ?? position.entryPrice
    const pnlData = calculatePnL(
      position.side as 'LONG' | 'SHORT',
      position.entryPrice, closePrice,
      position.leverage, position.amount,
      position.quantity, position.entryFee,
    )
    const isProfit = pnlData.pnl >= 0
    const pnlColor = isProfit ? '#00ff85' : '#ff3d55'
    const sideColor = position.side === 'LONG' ? '#00ff85' : '#ff3d55'
    const entryPrice = (position as any).inputPrice ?? position.entryPrice

    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    return new ImageResponse(
      (
        <div style={{
          width: 362, height: 500, display: 'flex', flexDirection: 'column',
          backgroundColor: 'rgb(2,5,13)', fontFamily: 'Inter',
          position: 'relative', overflow: 'hidden', borderRadius: 12,
        }}>
          {/* 배경 이미지 */}
          {bgSrc && (
            <img src={bgSrc} style={{
              position: 'absolute', top: 0, left: 0, width: 362, height: 500,
              objectFit: 'cover', objectPosition: 'center bottom',
            }} />
          )}

          {/* ── 헤더 ── */}
          <div style={{
            display: 'flex', alignItems: 'center',
            height: 60, padding: '0 20px', position: 'relative',
          }}>
            {/* 로고 */}
            {logoSrc
              ? <img src={logoSrc} style={{ height: 20 }} />
              : <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>TAPBIT</span>
            }

            {/* Perpetual 배지 */}
            <div style={{
              position: 'absolute', top: -1, right: -1,
              height: 38, padding: '0 20px',
              display: 'flex', alignItems: 'center',
              background: 'linear-gradient(90deg, transparent 0%, rgba(19,21,29,0.7) 20%, rgba(19,21,29,0.9) 100%)',
              color: 'rgb(136,136,136)',
            }}>
              <img src={EXCHANGE_ICON} style={{ width: 20, height: 20, marginRight: 8 }} />
              <span style={{ height: 20, lineHeight: '20px', fontSize: 14, fontWeight: 600 }}>Perpetual</span>
            </div>

            {/* 헤더 하단 라인 */}
            <div style={{
              position: 'absolute', left: 20, right: 20, bottom: 0,
              height: 1, background: 'rgb(27,30,37)',
            }} />
          </div>

          {/* ── 심볼 행 ── */}
          <div style={{ display: 'flex', padding: '12px 20px 20px' }}>
            <div style={{
              display: 'flex', alignItems: 'center',
              fontSize: 14, fontWeight: 600, lineHeight: '18px',
            }}>
              <span style={{ color: '#fff' }}>{position.symbol}</span>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <i style={{ margin: '1px 12px', width: 1, height: 16, background: 'rgba(255,255,255,0.2)', display: 'block' }} />
                <span style={{ color: sideColor }}>{position.side === 'LONG' ? 'Long' : 'Short'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <i style={{ margin: '1px 12px', width: 1, height: 16, background: 'rgba(255,255,255,0.2)', display: 'block' }} />
                <span style={{ color: '#fff' }}>{position.leverage}X</span>
              </div>
            </div>
          </div>

          {/* ── 콘텐츠 ── */}
          <div style={{ display: 'flex', flexDirection: 'column', margin: '0 20px' }}>

            {/* ROE */}
            <div style={{ display: 'flex', flexDirection: 'column', marginBottom: 20 }}>
              <div style={{ fontSize: 12, lineHeight: '16px', color: 'rgba(255,255,255,0.8)' }}>ROE</div>
              <div style={{ fontSize: 44, lineHeight: '44px', color: pnlColor, fontWeight: 600 }}>
                {isProfit ? '+' : ''}{formatNumber(pnlData.roe)}%
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

          {/* ── 타임스탬프 ── */}
          <div style={{
            position: 'absolute', bottom: 16, left: 20,
            fontSize: 12, lineHeight: '14px', color: 'rgb(148,151,158)',
          }}>
            {dateStr}
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
        },
        fonts: [
          { name: 'Inter', data: fontRegular,  weight: 400 as const, style: 'normal' as const },
          { name: 'Inter', data: fontSemiBold, weight: 600 as const, style: 'normal' as const },
          { name: 'Inter', data: fontBold,     weight: 700 as const, style: 'normal' as const },
        ],
      },
    )
  } catch (error) {
    console.error('GET /api/profit-card/[id] error:', error)
    return corsResponse('Image generation failed', 500)
  }
}
