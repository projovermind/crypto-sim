import { prisma } from './prisma'
import {
  MAX_POSITION_AGE_DAYS,
  MAX_PROFIT_USDT,
  PROFIT_CAP_GRACE_DAYS,
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

/** 수익 상한에 도달했지만 아직 유예 기간이 남은 포지션 — profitCapAt 만 기록한다 */
export interface ProfitCapMark {
  positionId: string
  symbol: string
  side: 'LONG' | 'SHORT'
  /** 상한에 최초 도달한 시각 */
  profitCapAt: Date
  /** 이 시각을 넘기면 강제 종료 (profitCapAt + PROFIT_CAP_GRACE_DAYS) */
  deadlineAt: Date
}

export type AutoCloseAction =
  | { type: 'close'; decision: AutoCloseDecision }
  | { type: 'mark-profit-cap'; mark: ProfitCapMark }

export interface AutoCloseSummary {
  scanned: number
  closed: number
  /** 상한 도달을 새로 기록한 건수 (종료는 아님) */
  marked: number
  skipped: number
  failed: number
  decisions: AutoCloseDecision[]
  marks: ProfitCapMark[]
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
  profitCapAt?: Date | null
}

/**
 * 포지션 하나에 대한 조치 판정. 아직 아무 조치도 필요 없으면 null.
 *
 *   - 수익 상한 최초 도달 → 'mark-profit-cap' (종료하지 않고 시각만 기록)
 *   - 상한 도달 + PROFIT_CAP_GRACE_DAYS 경과 → CLOSED_TP (상한가, pnl 정확히 상한)
 *   - 진입 후 MAX_POSITION_AGE_DAYS 경과 → CLOSED_MANUAL (만료 시점 시세)
 * 유예 마감과 기간 만료 중 먼저 오는 쪽이 이긴다.
 *
 * 조회 실패 시 throw — 값을 추측해서 포지션을 손상시키지 않는다.
 */
export async function decideAutoClose(
  position: OpenPosition,
  now: number = Date.now()
): Promise<AutoCloseAction | null> {
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

  // 이미 기록된 도달 시각이 있으면 klines 를 다시 스캔하지 않는다 (멱등 + 호출 절약).
  const recordedMs = position.profitCapAt ? position.profitCapAt.getTime() : NaN
  let capTouchMs: number | null = Number.isFinite(recordedMs) ? recordedMs : null
  let newlyTouched = false

  // SHORT 은 가격 하한이 0 이라 목표 수익이 구조적으로 불가능할 수 있다 → 기간 만료만 적용
  if (targetPrice !== null && capTouchMs === null) {
    capTouchMs = await findFirstTouchMs(
      position.symbol,
      side,
      targetPrice,
      entryMs,
      scanEndMs
    )
    newlyTouched = capTouchMs !== null
  }

  const deadlineMs = capTouchMs !== null ? capTouchMs + PROFIT_CAP_GRACE_DAYS * DAY_MS : null

  // 유예 마감이 기간 만료보다 먼저 오고, 그 시각이 지났으면 수익 상한으로 종료
  if (targetPrice !== null && deadlineMs !== null && deadlineMs <= expiryMs && now >= deadlineMs) {
    return {
      type: 'close',
      decision: {
        positionId: position.id,
        symbol: position.symbol,
        side,
        status: 'CLOSED_TP',
        reason: 'profit-cap',
        closedAt: new Date(deadlineMs),
        closedPrice: targetPrice,
        pnl: MAX_PROFIT_USDT,
      },
    }
  }

  if (expiryMs > now) {
    if (newlyTouched && capTouchMs !== null && deadlineMs !== null) {
      return {
        type: 'mark-profit-cap',
        mark: {
          positionId: position.id,
          symbol: position.symbol,
          side,
          profitCapAt: new Date(capTouchMs),
          deadlineAt: new Date(deadlineMs),
        },
      }
    }
    return null
  }

  const expiryPrice = await priceAt(position.symbol, expiryMs)
  if (expiryPrice === null) {
    throw new Error(`${position.symbol} 만료 시점(${new Date(expiryMs).toISOString()}) 가격 조회 실패`)
  }

  const pnl = Math.min(
    realizedPnL(side, position.entryPrice, expiryPrice, position.quantity, position.entryFee || 0),
    MAX_PROFIT_USDT
  )

  return {
    type: 'close',
    decision: {
      positionId: position.id,
      symbol: position.symbol,
      side,
      status: 'CLOSED_MANUAL',
      reason: 'max-age',
      closedAt: new Date(expiryMs),
      closedPrice: expiryPrice,
      pnl,
    },
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
      profitCapAt: true,
    },
  })

  const summary: AutoCloseSummary = {
    scanned: 0,
    closed: 0,
    marked: 0,
    skipped: 0,
    failed: 0,
    decisions: [],
    marks: [],
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
        const action = await decideAutoClose(p, now)
        if (!action || dryRun) return action

        if (action.type === 'close') {
          const { decision } = action
          await prisma.position.update({
            where: { id: p.id },
            data: {
              status: decision.status,
              closedAt: decision.closedAt,
              closedPrice: decision.closedPrice,
              pnl: decision.pnl,
              // 상한 도달로 종료한 건은 도달 시각도 남겨 둔다 (사후 확인용)
              ...(decision.reason === 'profit-cap' && !p.profitCapAt
                ? { profitCapAt: new Date(decision.closedAt.getTime() - PROFIT_CAP_GRACE_DAYS * DAY_MS) }
                : {}),
            },
          })
        } else {
          await prisma.position.update({
            where: { id: p.id },
            data: { profitCapAt: action.mark.profitCapAt },
          })
        }
        return action
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
      const action = result.value
      if (!action) {
        summary.skipped++
      } else if (action.type === 'close') {
        summary.closed++
        summary.decisions.push(action.decision)
      } else {
        summary.marked++
        summary.marks.push(action.mark)
      }
    })
  }

  return summary
}
