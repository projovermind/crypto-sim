import { ImageResponse } from 'next/og'
import { NextRequest } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculatePnL, formatPrice, formatNumber } from '@/lib/calculations'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const runtime = 'nodejs'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: CORS_HEADERS })
}

// 배경 이미지 캐시
let bgBase64Cache: Record<string, string> = {}

async function getBackgroundBase64(bgIndex: number): Promise<string> {
  const key = `bg${bgIndex + 1}`
  if (bgBase64Cache[key]) return bgBase64Cache[key]
  try {
    const filePath = join(process.cwd(), 'public', 'posters', `${key}.png`)
    const buffer = await readFile(filePath)
    bgBase64Cache[key] = `data:image/png;base64,${buffer.toString('base64')}`
    return bgBase64Cache[key]
  } catch {
    return ''
  }
}

/**
 * GET /api/profit-card/[id]?bg=0
 * 포지션 ID로 수익인증 카드 이미지 생성 (PNG)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
    }

    const position = await prisma.position.findUnique({
      where: { id: params.id },
    })

    if (!position) {
      return new Response('Not found', { status: 404, headers: CORS_HEADERS })
    }

    if (position.userId !== user.id) {
      return new Response('Forbidden', { status: 403, headers: CORS_HEADERS })
    }

    // 배경 인덱스 (기본 0)
    const bgIndex = parseInt(request.nextUrl.searchParams.get('bg') || '0')
    const bgSrc = await getBackgroundBase64(bgIndex)

    // 포시 calculatePnL과 100% 동일한 계산
    const closePrice = position.closedPrice ?? position.entryPrice
    const pnlData = calculatePnL(
      position.side as 'LONG' | 'SHORT',
      position.entryPrice,
      closePrice,
      position.leverage,
      position.amount,
      position.quantity,
      position.entryFee,
    )
    const isProfit = pnlData.pnl >= 0
    const pnlColor = isProfit ? '#00ff85' : '#ff3d55'
    const sideColor = position.side === 'LONG' ? '#00ff85' : '#ff3d55'
    const entryPrice = (position as any).inputPrice ?? position.entryPrice

    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    const imageResponse = new ImageResponse(
      (
        <div
          style={{
            width: 362,
            height: 500,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: 'rgb(2, 5, 13)',
            fontFamily: 'Inter, sans-serif',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* 배경 이미지 */}
          {bgSrc && (
            <img
              src={bgSrc}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: 362,
                height: 500,
              }}
            />
          )}

          {/* 헤더 */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 60,
              padding: '0 20px',
              position: 'relative',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <div style={{ width: 4, height: 16, background: '#f0a500', marginRight: 8, borderRadius: 2 }} />
              <span style={{ color: '#fff', fontSize: 18, fontWeight: 700 }}>TAPBIT</span>
            </div>
            <span style={{ color: '#888', fontSize: 14, fontWeight: 600 }}>Perpetual</span>
          </div>

          {/* 구분선 */}
          <div style={{ width: 322, height: 1, background: '#1b1e25', margin: '0 20px' }} />

          {/* 심볼 + 방향 + 레버리지 */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '16px 20px', gap: 12 }}>
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{position.symbol}</span>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ color: sideColor, fontSize: 16, fontWeight: 600 }}>
              {position.side === 'LONG' ? 'Long' : 'Short'}
            </span>
            <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.2)' }} />
            <span style={{ color: '#fff', fontSize: 16, fontWeight: 600 }}>{position.leverage}X</span>
          </div>

          {/* ROE */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '0 20px' }}>
            <span style={{ color: 'rgba(255,255,255,0.8)', fontSize: 13 }}>ROE</span>
            <span style={{ color: pnlColor, fontSize: 52, fontWeight: 600, lineHeight: 1.1, marginTop: 4 }}>
              {isProfit ? '+' : ''}{formatNumber(pnlData.roe)}%
            </span>
          </div>

          {/* Entry / Last Price */}
          <div style={{ display: 'flex', flexDirection: 'column', padding: '24px 20px', gap: 6 }}>
            <div style={{ display: 'flex', fontSize: 13 }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Entry Price: </span>
              <span style={{ color: '#fff', fontWeight: 600, marginLeft: 4 }}>{formatPrice(entryPrice)}</span>
            </div>
            <div style={{ display: 'flex', fontSize: 13 }}>
              <span style={{ color: 'rgba(255,255,255,0.8)' }}>Last Price: </span>
              <span style={{ color: '#fff', fontWeight: 600, marginLeft: 4 }}>{formatPrice(closePrice)}</span>
            </div>
          </div>

          {/* 타임스탬프 */}
          <div
            style={{
              position: 'absolute',
              bottom: 16,
              left: 20,
              fontSize: 12,
              color: '#94979e',
            }}
          >
            {dateStr}
          </div>
        </div>
      ),
      {
        width: 362,
        height: 500,
        headers: CORS_HEADERS,
      },
    )

    return imageResponse
  } catch (error) {
    console.error('GET /api/profit-card/[id] error:', error)
    return new Response('Image generation failed', { status: 500, headers: CORS_HEADERS })
  }
}
