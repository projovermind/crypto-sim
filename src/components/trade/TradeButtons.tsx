'use client'

import { formatNumber } from '@/lib/calculations'

interface TradeButtonsProps {
  symbol: string
  loading: boolean
  amount: string
  entryPrice: string
  qtyUnit: string
  leverage: number
  onSubmit: (side: 'LONG' | 'SHORT') => void
}

export default function TradeButtons({ symbol, loading, amount, entryPrice, qtyUnit, leverage, onSubmit }: TradeButtonsProps) {
  const base = symbol.replace('USDT', '')
  const price = parseFloat(entryPrice)
  const qty = parseFloat(amount)
  const isDisabled = loading || !amount || !qty || !entryPrice || !price || price <= 0

  return (
    <div className="px-3 pb-2">
      {/* Validation hint */}
      {!loading && isDisabled && (
        <p className="text-[10px] text-binance-yellow mb-1 text-center">
          {!entryPrice || !price || price <= 0 ? '가격을 입력하세요' : '수량을 입력하세요'}
        </p>
      )}

      {/* Buy / Sell buttons */}
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => onSubmit('LONG')}
          className="h-[36px] rounded font-medium text-sm bg-binance-green hover:bg-binance-green/90 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          롱 개설
        </button>
        <button
          type="button"
          disabled={isDisabled}
          onClick={() => onSubmit('SHORT')}
          className="h-[36px] rounded font-medium text-sm bg-binance-red hover:bg-binance-red/90 text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          숏 개설
        </button>
      </div>

      {/* Cost info */}
      <div className="text-xs text-binance-text-dim space-y-0.5 py-1 border-t border-binance-border mt-1.5">
        <div className="flex justify-between">
          <span>증거금</span>
          <span>
            {amount && entryPrice ? (() => {
              const raw = parseFloat(amount)
              const price = parseFloat(entryPrice || '1')
              const margin = qtyUnit === 'USDT' ? raw : raw * price
              return <><span className="text-binance-green">{formatNumber(margin)}</span> / <span className="text-binance-red">{formatNumber(margin)}</span></>
            })() : '0.00 / 0.00'}
            <span className="ml-1 text-binance-text-dim">USDT</span>
          </span>
        </div>
        <div className="flex justify-between">
          <span>포지션 크기</span>
          <span>
            {amount && entryPrice ? (() => {
              const raw = parseFloat(amount)
              const price = parseFloat(entryPrice || '1')
              const margin = qtyUnit === 'USDT' ? raw : raw * price
              const posSize = margin * leverage
              const qty = posSize / price
              return <><span className="text-binance-green">{qty.toFixed(6)}</span> / <span className="text-binance-red">{qty.toFixed(6)}</span></>
            })() : '0.000000 / 0.000000'}
            <span className="ml-1 text-binance-text-dim">{base}</span>
          </span>
        </div>
      </div>
    </div>
  )
}
