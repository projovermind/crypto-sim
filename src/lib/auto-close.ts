import { prisma } from './prisma'
import {
  MAX_POSITION_AGE_DAYS,
  MAX_PROFIT_USDT,
  priceForTargetPnL,
  realizedPnL,
} from './calculations'

const HOUR_MS = 3600 * 1000
const DAY_MS = 24 * HOUR_MS
// Binance klines 는 요청당 최대 1000개 → 1h 봉 기준 1000시간
const CHUNK_MS = 1000 * HOUR_MS

export interface AutoCloseDecision {
  positionId: string
  symbol: string
  side: 'LONG' | 'SHORT'
  status: 'CLOSED_TP' | 'CLOSED_MANUAL'
  reason: 'profit-cap' | 'max-age'
  closedAt: Date
  closedPrice: number
  pnl: number
}

export interface AutoCloseSummary {
  scanned: number
  closed: number
  skipped: number
  failed: number
  decisions: AutoCloseDecision[]
  errors: { positionId: string; message: string }[]
  truncated: boolean
}

/** Binance 호출 — 일시적 실패는 재시도, 최종 실패는 null (호출자가 판단) */
async function fetchKlines(
  symbol: string,
  interval: '1h' | '1m',
  startTime: number,
  endTime: number,
  limit: number,
  retries = 2
): Promise<any[][] | null> {
  const url =
    `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(symbol)}` +
    `&interval=${interval}&limit=${limit}&startTime=${startTime}&endTime=${endTime}`

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url)
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data)) return data as any[][]
      }
    } catch {
      // 아래 재시도로 흡수
    }
    if (attempt < retries) await new Promise((r) => setTimeout(r, 300))
  }
  return null
}

/** LONG 은 고가가 목표 이상, SHORT 은 저가가 목표 이하일 때 도달로 본다 (갭 상승/하락 포함) */
function reached(side: 'LONG' | 'SHORT', kline: any[], targetPrice: number): boolean {
  const high = parseFloat(kline[2])
  const low = parseFloat(kline[3])
  if (!Number.isFinite(high) || !Number.isFinite(low)) return false
  return side === 'LONG' ? high >= targetPrice : low <= targetPrice
}

/**
 * targetPrice 에 최초로 도달한 시각(ms). 1h 로 후보 시간을 찾고, 그 한 시간을 1m 로 좁힌다.
 * 도달 없음 = null, Binance 조회 실패 = throw (미확정을 "도달 안함"으로 오판하지 않기 위해)
 */
async function findFirstTouchMs(
  symbol: string,
  side: 'LONG' | 'SHORT',
  targetPrice: number,
  fromMs: number,
  toMs: number
): Promise<number | null> {
  for (let chunkStart = fromMs; chunkStart < toMs; chunkStart += CHUNK_MS) {
    const chunkEnd = Math.min(chunkStart + CHUNK_MS, toMs)

    const hourly = await fetchKlines(symbol, '1h', chunkStart, chunkEnd, 1000)
    if (!hourly) throw new Error(`${symbol} 1h klines 조회 실패`)

    const hit = hourly.find((k) => reached(side, k, targetPrice))
    if (!hit) continue

    // 2패스: 해당 시간대를 1분봉으로 정밀 탐색
    const hourStart = Math.floor(hit[0] / 60000) * 60000
    const minutes = await fetchKlines(symbol, '1m', hourStart, hourStart + HOUR_MS, 60)
    if (!minutes) throw new Error(`${symbol} 1m klines 조회 실패`)

    const minute = minutes.find((k) => reached(side, k, targetPrice))
    // 1분봉에 없으면(집계 차이) 해당 시간봉 시작을 도달 시점으로 본다
    const touchMs = minute ? minute[0] : hit[0]
    return Math.max(touchMs, fromMs)
  }

  return null
}

/** 특정 시각의 종가. 1m → 1h 순으로 조회하며, 못 구하면 null */
async function priceAt(symbol: string, atMs: number): Promise<number | null> {
  const minutes = await fetchKlines(symbol, '1m', atMs - 5 * 60000, atMs, 10)
  const lastMinute = minutes && minutes.length > 0 ? parseFloat(minutes[minutes.length - 1][4]) : NaN
  if (Number.isFinite(lastMinute) && lastMinute > 0) return lastMinute

  const hours = await fetchKlines(symbol, '1h', atMs - 6 * HOUR_MS, atMs, 10)
  const lastHour = hours && hours.length > 0 ? parseFloat(hours[hours.length - 1][4]) : NaN
  if (Number.isFinite(lastHour) && lastHour > 0) return lastHour

  return null
}

type OpenPosition = {
  id: string
  symbol: string
  side: string
  entryPrice: number
  quantity: number
  entryFee: number
  entryTime: Date
}

/**
 * 포지션 하나의 종료 여부 판정. 아직 종료 조건 미충족이면 null.
 * 조회 실패 시 throw — 값을 추측해서 포지션을 손상시키지 않는다.
 */
export async function decideAutoClose(
  position: OpenPosition,
  now: number = Date.now()
): Promise<AutoCloseDecision | null> {
  const side = position.side === 'SHORT' ? 'SHORT' : 'LONG'
  const entryMs = position.entryTime.getTime()
  const expiryMs = entryMs + MAX_POSITION_AGE_DAYS * DAY_MS
  const scanEndMs = Math.min(now, expiryMs)

  if (!Number.isFinite(entryMs) || scanEndMs <= entryMs) return null

  const targetPrice = priceForTargetPnL(
    side,
    position.entryPrice,
    position.quantity,
    MAX_PROFIT_USDT,
    position.entryFee || 0
  )

  // SHORT 은 가격 하한이 0 이라 목표 수익이 구조적으로 불가능할 수 있다 → 기간 만료만 적용
  if (targetPrice !== null) {
    const touchMs = await findFirstTouchMs(
      position.symbol,
      side,
      targetPrice,
      entryMs,
      scanEndMs
    )

    if (touchMs !== null) {
      return {
        positionId: position.id,
        symbol: position.symbol,
        side,
        status: 'CLOSED_TP',
        reason: 'profit-cap',
        closedAt: new Date(touchMs),
        closedPrice: targetPrice,
        pnl: MAX_PROFIT_USDT,
      }
    }
  }

  if (expiryMs > now) return null

  const expiryPrice = await priceAt(position.symbol, expiryMs)
  if (expiryPrice === null) {
    throw new Error(`${position.symbol} 만료 시점(${new Date(expiryMs).toISOString()}) 가격 조회 실패`)
  }

  const pnl = Math.min(
    realizedPnL(side, position.entryPrice, expiryPrice, position.quantity, position.entryFee || 0),
    MAX_PROFIT_USDT
  )

  return {
    positionId: position.id,
    symbol: position.symbol,
    side,
    status: 'CLOSED_MANUAL',
    reason: 'max-age',
    closedAt: new Date(expiryMs),
    closedPrice: expiryPrice,
    pnl,
  }
}

export interface RunAutoCloseOptions {
  /** 한 번에 검사할 최대 포지션 수 */
  limit?: number
  /** 동시 처리 수 (Binance rate limit 고려) */
  concurrency?: number
  /** 이 시간(ms)을 넘기면 남은 포지션은 다음 실행으로 미룬다 */
  budgetMs?: number
  /** true 면 DB 를 수정하지 않고 판정 결과만 반환 */
  dryRun?: boolean
}

/**
 * OPEN 포지션 전체를 검사해 자동 종료 규칙을 적용한다.
 * 포지션별로 격리되어 한 건의 실패가 나머지에 영향을 주지 않는다.
 */
export async function runAutoClose(
  options: RunAutoCloseOptions = {}
): Promise<AutoCloseSummary> {
  const {
    limit = 200,
    concurrency = 4,
    budgetMs = 240_000,
    dryRun = false,
  } = options

  const startedAt = Date.now()

  const positions = await prisma.position.findMany({
    where: { status: 'OPEN', deletedAt: null },
    orderBy: { entryTime: 'asc' },
    take: limit,
    select: {
      id: true,
      symbol: true,
      side: true,
      entryPrice: true,
      quantity: true,
      entryFee: true,
      entryTime: true,
    },
  })

  const summary: AutoCloseSummary = {
    scanned: 0,
    closed: 0,
    skipped: 0,
    failed: 0,
    decisions: [],
    errors: [],
    truncated: false,
  }

  const now = Date.now()

  for (let i = 0; i < positions.length; i += concurrency) {
    if (Date.now() - startedAt > budgetMs) {
      summary.truncated = true
      break
    }

    const batch = positions.slice(i, i + concurrency)
    const results = await Promise.allSettled(
      batch.map(async (p) => {
        const decision = await decideAutoClose(p, now)
        if (!decision || dryRun) return decision

        await prisma.position.update({
          where: { id: p.id },
          data: {
            status: decision.status,
            closedAt: decision.closedAt,
            closedPrice: decision.closedPrice,
            pnl: decision.pnl,
          },
        })
        return decision
      })
    )

    results.forEach((result, idx) => {
      summary.scanned++
      if (result.status === 'rejected') {
        summary.failed++
        summary.errors.push({
          positionId: batch[idx].id,
          message: result.reason instanceof Error ? result.reason.message : String(result.reason),
        })
        return
      }
      if (result.value) {
        summary.closed++
        summary.decisions.push(result.value)
      } else {
        summary.skipped++
      }
    })
  }

  return summary
}
