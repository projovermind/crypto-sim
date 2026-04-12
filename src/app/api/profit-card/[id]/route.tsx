import { ImageResponse } from 'next/og'
import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'
import { prisma } from '@/lib/prisma'
import { calculatePnL, formatPrice, formatNumber } from '@/lib/calculations'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { DMMono_Regular_B64, DMMono_Medium_B64 } from '../font-data'

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

// 캐시
let bgCache: Record<string, string> = {}

// DM Mono: base64 임베드 → 파일시스템/CDN 불필요, 항상 사용 가능
function _b64toAB(b64: string): ArrayBuffer {
  const buf = Buffer.from(b64, 'base64')
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
}
const DM_MONO_REGULAR_BUF: ArrayBuffer = _b64toAB(DMMono_Regular_B64)
const DM_MONO_MEDIUM_BUF: ArrayBuffer  = _b64toAB(DMMono_Medium_B64)

let fontCache: Record<string, ArrayBuffer> = {}

async function getBg(idx: number): Promise<string> {
  const key = `bg${idx + 1}`
  if (bgCache[key]) return bgCache[key]
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'posters', `${key}.png`))
    bgCache[key] = `data:image/png;base64,${buf.toString('base64')}`
    return bgCache[key]
  } catch { return '' }
}

// 폰트명 → Google Fonts CDN 직접 URL (파일시스템 실패 시 최후 폴백)
const FONT_CDN: Record<string, string> = {
  'Inter-Regular':   'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuLyfAZ9hiA.woff2',
  'Inter-SemiBold':  'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuGKYAZ9hiA.woff2',
  'Inter-Bold':      'https://fonts.gstatic.com/s/inter/v19/UcCO3FwrK3iLTeHuS_nVMrMxCp50SjIw2boKoduKmMEVuFuYAZ9hiA.woff2',
  'DMMono-Regular':  'https://fonts.gstatic.com/s/dmmono/v16/aFTR7PB1QTsUX8KYvumzIYQ.ttf',
  'DMMono-Medium':   'https://fonts.gstatic.com/s/dmmono/v16/aFTU7PB1QTsUX8KYhh0.ttf',
}

async function getFont(name: string): Promise<ArrayBuffer> {
  if (fontCache[name]) return fontCache[name]

  // 1차: 파일시스템 (로컬 dev / Vercel)
  try {
    const buf = await readFile(join(process.cwd(), 'public', 'fonts', `${name}.ttf`))
    const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer
    if (ab.byteLength > 1000) {
      fontCache[name] = ab
      return ab
    }
  } catch { /* ignore */ }

  // 2차: 로컬 서버 HTTP
  try {
    const baseUrl = process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000'
    const res = await fetch(`${baseUrl}/fonts/${name}.ttf`)
    if (res.ok) {
      const ab = await res.arrayBuffer()
      if (ab.byteLength > 1000) {
        fontCache[name] = ab
        return ab
      }
    }
  } catch { /* ignore */ }

  // 3차: Google Fonts CDN 직접 fetch
  if (FONT_CDN[name]) {
    try {
      const res = await fetch(FONT_CDN[name])
      if (res.ok) {
        fontCache[name] = await res.arrayBuffer()
        return fontCache[name]
      }
    } catch { /* ignore */ }
  }

  return new ArrayBuffer(0)
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    // 커스텀 JWT 직접 verify (next-auth getToken은 확장 토큰 미지원)
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
    const [bgSrc, fontRegular, fontSemiBold, fontBold] = await Promise.all([
      getBg(bgIdx),
      getFont('Inter-Regular'),
      getFont('Inter-SemiBold'),
      getFont('Inter-Bold'),
    ])
    // DM Mono: 임베드 버퍼 직접 사용 (로딩 실패 없음)
    const fontMonoRegular = DM_MONO_REGULAR_BUF
    const fontMonoMedium  = DM_MONO_MEDIUM_BUF

    // 포시 calculatePnL과 100% 동일
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
          backgroundColor: 'rgb(2, 5, 13)', fontFamily: 'Inter',
          position: 'relative', overflow: 'hidden', borderRadius: 12,
        }}>
          {bgSrc && <img src={bgSrc} style={{ position: 'absolute', top: 0, left: 0, width: 362, height: 500 }} />}

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, padding: '0 20px', position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 4, height: 16, background: '#f0a500', marginRight: 8, borderRadius: 2 }} />
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>TAPBIT</span>
            </div>
            <span style={{ color: '#888', fontSize: 14, fontWeight: 600 }}>Perpetual</span>
          </div>
          <div style={{ width: 322, height: 1, background: '#1b1e25', margin: '0 20px' }} />

          {/* Symbol */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12 }}>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{position.symbol}</span>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ color: sideColor, fontSize: 16, fontWeight: 600 }}>{position.side === 'LONG' ? 'Long' : 'Short'}</span>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{position.leverage}X</span>
          </div>

          {/* ROE */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '0 20px' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>ROE</span>
            <span style={{ color: pnlColor, fontSize: 44, fontWeight: 500, lineHeight: 1.1, marginTop: 4, fontFamily: 'DM Mono' }}>
              {isProfit ? '+' : ''}{formatNumber(pnlData.roe)}%
            </span>
          </div>

          {/* Prices */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: 6 }}>
            <div style={{ display: 'flex', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Entry Price: </span>
              <span style={{ color: '#fff', fontWeight: 500, marginLeft: 4, fontFamily: 'DM Mono' }}>{formatPrice(entryPrice)}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 12 }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Last Price: </span>
              <span style={{ color: '#fff', fontWeight: 500, marginLeft: 4, fontFamily: 'DM Mono' }}>{formatPrice(closePrice)}</span>
            </div>
          </div>

          {/* Timestamp */}
          <div style={{ position: 'absolute', bottom: 16, left: 20, fontSize: 12, color: '#94979e', fontFamily: 'DM Mono' }}>{dateStr}</div>
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
          { name: 'Inter', data: fontRegular, weight: 400 as const, style: 'normal' as const },
          { name: 'Inter', data: fontSemiBold, weight: 600 as const, style: 'normal' as const },
          { name: 'Inter', data: fontBold, weight: 700 as const, style: 'normal' as const },
          { name: 'DM Mono', data: fontMonoRegular, weight: 400 as const, style: 'normal' as const },
          { name: 'DM Mono', data: fontMonoMedium, weight: 500 as const, style: 'normal' as const },
        ],
      },
    )
  } catch (error) {
    console.error('GET /api/profit-card/[id] error:', error)
    return corsResponse('Image generation failed', 500)
  }
}
