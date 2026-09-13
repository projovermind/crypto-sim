// 자동 종료 규칙 — 클라이언트/서버 공용 (prisma 의존 없음)
//
// 서버 크론(src/lib/auto-close.ts)은 과거 klines 를 스캔해 "언제 도달했는지"까지
// 정확히 판정한다. 이 모듈은 실시간 가격만 가지고 "지금 종료 대상인가"를 판정해서
// 크론 주기를 기다리지 않고 UI 에서 즉시 반영하기 위한 것이다.
//
// 규칙 (먼저 발생한 조건이 이긴다):
//   1) 순수익이 MAX_PROFIT_USDT 도달  → CLOSED_TP     (priceForTargetPnL 가격, pnl 정확히 상한)
//   2) 진입 후 MAX_POSITION_AGE_DAYS 경과 → CLOSED_MANUAL (현재가)
// 사용자 지정 TP/SL 은 단독으로 자동 종료를 유발하지 않는다(기존 동작). 다만 위 규칙이
// 발동할 때 TP/SL 이 더 먼저 도달해 있었다면 그 가격/상태로 체결된 것으로 본다.
import {
  MAX_POSITION_AGE_DAYS,
  MAX_PROFIT_USDT,
  PnLResult,
  checkTPSL,
  priceForTargetPnL,
  realizedPnL,
} from './calculations'

const DAY_MS = 24 * 3600 * 1000

export type AutoCloseReason = 'profit-cap' | 'max-age' | 'take-profit' | 'stop-loss'

export interface LiveAutoCloseTrigger {
  reason: AutoCloseReason
  status: 'CLOSED_TP' | 'CLOSED_SL' | 'CLOSED_MANUAL'
  /** 이 가격에 도달해서 규칙이 발동했다 */
  closedPrice: number
  /** closedPrice 기준 순수익 (상한 클램프 적용) */
  pnl: number
}

/** 규칙에 필요한 포지션 필드만 — Position / PositionWithLive 모두 그대로 넘길 수 있다 */
export interface AutoCloseCandidate {
  side: string
  entryPrice: number
  quantity: number
  amount: number
  leverage: number
  entryFee?: number | null
  takeProfit?: number | null
  stopLoss?: number | null
  entryTime: string | Date
  status?: string
}

/** 미실현/실현 수익 상한. 표시용 값도 서버 규칙(MAX_PROFIT_USDT) 이상으로 보이지 않게 한다. */
export function clampProfit(pnl: number): number {
  if (!Number.isFinite(pnl)) return pnl
  return Math.min(pnl, MAX_PROFIT_USDT)
}

/**
 * calculatePnL 결과에 수익 상한을 적용한다.
 * pnl 을 자르면 그로부터 파생되는 roe / currentMargin 도 함께 맞춰야 표시가 일관된다.
 */
export function clampPnLResult(result: PnLResult, margin: number): PnLResult {
  const pnl = clampProfit(result.pnl)
  if (pnl === result.pnl) return result

  const roe = margin > 0 ? (pnl / margin) * 100 : result.roe
  return {
    ...result,
    pnl,
    pnlPercent: roe,
    roe,
    currentMargin: Math.max(0, margin + pnl),
  }
}

function toMs(value: string | Date): number {
  return value instanceof Date ? value.getTime() : new Date(value).getTime()
}

/** 진입 후 MAX_POSITION_AGE_DAYS 가 되는 시각(ms). 진입 시각이 깨졌으면 null. */
export function expiryMs(entryTime: string | Date): number | null {
  const entryMs = toMs(entryTime)
  if (!Number.isFinite(entryMs)) return null
  return entryMs + MAX_POSITION_AGE_DAYS * DAY_MS
}

/**
 * 실시간 가격 기준으로 자동 종료 대상인지 판정한다. 아니면 null.
 *
 * 우선순위: 기간 만료는 "이미 지난 시각"에 발동한 것이므로 가격 조건보다 앞선다.
 * 가격 조건들끼리는 진입가에서 가까운 트리거가 먼저 도달한 것이므로 그쪽이 이긴다
 * (예: TP 가 수익 상한 가격보다 진입가에 가까우면 TP 가 먼저 체결됐어야 한다).
 */
export function evaluateLiveAutoClose(
  position: AutoCloseCandidate,
  currentPrice: number,
  now: number = Date.now()
): LiveAutoCloseTrigger | null {
  if (position.status && position.status !== 'OPEN') return null
  if (!Number.isFinite(currentPrice) || currentPrice <= 0) return null

  const side = position.side === 'SHORT' ? 'SHORT' : 'LONG'
  const entryPrice = position.entryPrice
  const quantity = position.quantity || (entryPrice > 0 ? position.amount / entryPrice : 0)
  const entryFee = position.entryFee || 0
  if (!Number.isFinite(entryPrice) || entryPrice <= 0 || !(quantity > 0)) return null

  const pnlAt = (price: number) =>
    clampProfit(realizedPnL(side, entryPrice, price, quantity, entryFee))

  // 1) 기간 만료 — 지난 시각에 발동했으므로 지금 보이는 가격 조건보다 우선한다.
  const expiry = expiryMs(position.entryTime)
  if (expiry !== null && now >= expiry) {
    return {
      reason: 'max-age',
      status: 'CLOSED_MANUAL',
      closedPrice: currentPrice,
      pnl: pnlAt(currentPrice),
    }
  }

  // 2) 수익 상한 — SHORT 은 가격 하한이 0 이라 상한 자체가 불가능할 수 있다(capPrice=null).
  const capPrice = priceForTargetPnL(side, entryPrice, quantity, MAX_PROFIT_USDT, entryFee)
  const capReached =
    capPrice !== null &&
    realizedPnL(side, entryPrice, currentPrice, quantity, entryFee) >= MAX_PROFIT_USDT
  if (!capReached || capPrice === null) return null

  const candidates: LiveAutoCloseTrigger[] = [
    {
      reason: 'profit-cap',
      status: 'CLOSED_TP',
      closedPrice: capPrice,
      pnl: MAX_PROFIT_USDT,
    },
  ]

  // 3) 사용자 TP/SL 이 수익 상한보다 먼저 도달했다면 그쪽 체결로 봐야 한다.
  //    (TP/SL 단독으로는 이 함수가 종료를 지시하지 않는다 — 기존 동작 유지)
  const { hitTP, hitSL } = checkTPSL(side, entryPrice, currentPrice, position.takeProfit, position.stopLoss)
  if (hitTP && position.takeProfit) {
    candidates.push({
      reason: 'take-profit',
      status: 'CLOSED_TP',
      closedPrice: position.takeProfit,
      pnl: pnlAt(position.takeProfit),
    })
  }
  if (hitSL && position.stopLoss) {
    candidates.push({
      reason: 'stop-loss',
      status: 'CLOSED_SL',
      closedPrice: position.stopLoss,
      pnl: pnlAt(position.stopLoss),
    })
  }

  // 진입가에 가장 가까운 트리거 = 가장 먼저 도달한 트리거
  return candidates.reduce((first, c) =>
    Math.abs(c.closedPrice - entryPrice) < Math.abs(first.closedPrice - entryPrice) ? c : first
  )
}
