/**
 * PnL 계산 유틸리티
 */

// Tapbit 선물 수수료율
export const TAKER_FEE_RATE = 0.0006; // 0.06% (시장가)
export const MAKER_FEE_RATE = 0.0002; // 0.02% (지정가)

// 슬리피지 범위 (시장가 주문 시)
const SLIPPAGE_MIN = 0.00008; // 0.008%
const SLIPPAGE_MAX = 0.00055; // 0.055%

// 지정가 슬리피지 기본값 (0.015~0.025% 범위)
const LIMIT_SLIPPAGE_MIN = 0.00015;
const LIMIT_SLIPPAGE_MAX = 0.00025;
export const LIMIT_SLIPPAGE_DEFAULT = 0.0002;

/**
 * 미세 랜덤 슬리피지율 생성 (소수점 5자리 정밀도)
 */
function randomSlippageRate(min: number, max: number): number {
  const base = min + Math.random() * (max - min);
  // 미세 노이즈 추가 (±0.001% 범위)
  const noise = (Math.random() - 0.5) * 0.00002;
  return Math.max(0, base + noise);
}

/**
 * 시장가 슬리피지 시뮬레이션
 * LONG: 가격이 약간 올라감 (불리), SHORT: 가격이 약간 내려감 (불리)
 */
export function applySlippage(price: number, side: 'LONG' | 'SHORT'): number {
  const slippageRate = randomSlippageRate(SLIPPAGE_MIN, SLIPPAGE_MAX);
  if (side === 'LONG') {
    return price * (1 + slippageRate);
  } else {
    return price * (1 - slippageRate);
  }
}

/**
 * 지정가 슬리피지 적용
 * 지정가라도 실제 체결가는 약간 차이남 (랜덤 범위)
 */
export function applyLimitSlippage(price: number, side: 'LONG' | 'SHORT', slippagePct?: number): number {
  const rate = slippagePct ?? randomSlippageRate(LIMIT_SLIPPAGE_MIN, LIMIT_SLIPPAGE_MAX);
  if (side === 'LONG') {
    return price * (1 + rate);
  } else {
    return price * (1 - rate);
  }
}

/**
 * 수수료 계산 (USDT)
 */
export function calculateFee(notionalValue: number, orderType: 'MARKET' | 'LIMIT' = 'MARKET'): number {
  const rate = orderType === 'MARKET' ? TAKER_FEE_RATE : MAKER_FEE_RATE;
  return notionalValue * rate;
}

export interface PnLResult {
  pnl: number;           // 순수익/손실 (USDT) — 수수료 차감 후
  pnlPercent: number;    // 수익률 (%)
  liquidationPrice: number; // 청산가
  currentMargin: number; // 현재 증거금 가치
  roe: number;           // ROE (%)
}

/**
 * 포지션 PnL 계산 (수수료 포함)
 */
export function calculatePnL(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  currentPrice: number,
  leverage: number,
  amount: number,    // USDT 진입금액
  quantity?: number, // 코인 수량 (없으면 amount/entryPrice로 계산)
  entryFee?: number  // 진입 수수료 (USDT)
): PnLResult {
  const qty = quantity || amount / entryPrice;

  // 명목 가치
  const notional = qty * entryPrice;
  // 증거금 (초기)
  const margin = notional / leverage;

  // 미실현 PnL
  let rawPnl: number;
  let liquidationPrice: number;

  if (side === 'LONG') {
    rawPnl = (currentPrice - entryPrice) * qty;
    const maintenanceRate = 0.005;
    liquidationPrice = entryPrice * (1 - (1 / leverage) + maintenanceRate);
  } else {
    rawPnl = (entryPrice - currentPrice) * qty;
    const maintenanceRate = 0.005;
    liquidationPrice = entryPrice * (1 + (1 / leverage) - maintenanceRate);
  }

  // 수수료 차감: 진입 수수료 + 예상 청산 수수료 (현재가 기준)
  const openFee = entryFee || 0;
  const closeFee = qty * currentPrice * TAKER_FEE_RATE;
  const pnl = rawPnl - openFee - closeFee;

  const pnlPercent = (pnl / margin) * 100; // ROE
  const currentMargin = margin + pnl;

  return {
    pnl,
    pnlPercent,
    liquidationPrice,
    currentMargin: Math.max(0, currentMargin),
    roe: pnlPercent,
  };
}

/**
 * TP/SL 도달 여부 체크
 */
export function checkTPSL(
  side: 'LONG' | 'SHORT',
  entryPrice: number,
  currentPrice: number,
  takeProfit?: number | null,
  stopLoss?: number | null
): { hitTP: boolean; hitSL: boolean } {
  let hitTP = false;
  let hitSL = false;

  if (side === 'LONG') {
    if (takeProfit && currentPrice >= takeProfit) hitTP = true;
    if (stopLoss && currentPrice <= stopLoss) hitSL = true;
  } else {
    if (takeProfit && currentPrice <= takeProfit) hitTP = true;
    if (stopLoss && currentPrice >= stopLoss) hitSL = true;
  }

  return { hitTP, hitSL };
}

/**
 * 포맷팅 유틸
 */
export function formatNumber(value: number, decimals: number = 2): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function formatPrice(price: number, decimals?: number): string {
  // Tapbit style: BTC prices use 1 decimal, others vary
  const d = decimals ?? (price >= 1000 ? 1 : price >= 1 ? 2 : price >= 0.01 ? 4 : 8);
  if (price >= 1000) return price.toLocaleString('en-US', { minimumFractionDigits: d, maximumFractionDigits: d });
  return price.toFixed(d);
}

export function formatPnL(pnl: number): string {
  const sign = pnl >= 0 ? '+' : '';
  return `${sign}${formatNumber(pnl, 2)}`;
}

export function formatPercent(pct: number): string {
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${formatNumber(pct)}%`;
}

export function formatUSDT(amount: number): string {
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
