'use client'

import { useState } from 'react'
import { SYMBOLS, getSymbolBase } from '@/types'
import { formatPrice } from '@/lib/calculations'

interface MarketData {
  price: number
  priceChange: number
  priceChangePercent: number
  high24h: number
  low24h: number
  volume24h: number
}

interface MarketHeaderProps {
  symbol: string
  onSymbolChange: (symbol: string) => void
  marketData: MarketData | null
}

export default function MarketHeader({ symbol, onSymbolChange, marketData }: MarketHeaderProps) {
  const [showSymbols, setShowSymbols] = useState(false)
  const base = getSymbolBase(symbol)
  const isUp = (marketData?.priceChangePercent ?? 0) >= 0

  return (
    <div className="bg-binance-card border-b border-binance-border">
      <div className="flex items-center h-12 px-4 gap-4">
        {/* Symbol selector */}
        <div className="relative">
          <button
            onClick={() => setShowSymbols(!showSymbols)}
            className="flex items-center gap-2 hover:bg-binance-border/50 rounded px-2 py-1 transition-colors"
          >
            <div className="w-5 h-5 rounded-full bg-binance-yellow/20 flex items-center justify-center text-[10px] font-bold text-binance-yellow">₿</div>
            <div className="flex flex-col items-start">
              <div className="flex items-center gap-1">
                <span className="text-sm font-bold text-binance-text">{base}USDT</span>
                <svg className="w-2.5 h-2.5 text-binance-text-dim" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
              <span className="text-[10px] text-binance-text-dim leading-none">Perp</span>
            </div>
          </button>

          {showSymbols && (
            <div className="absolute top-full left-0 mt-1 bg-binance-card border border-binance-border rounded-lg shadow-xl z-50 w-48 max-h-80 overflow-y-auto">
              {SYMBOLS.map(s => (
                <button
                  key={s}
                  onClick={() => { onSymbolChange(s); setShowSymbols(false) }}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-binance-border/50 transition-colors ${
                    s === symbol ? 'text-binance-yellow bg-binance-yellow/5' : 'text-binance-text'
                  }`}
                >
                  {s.replace('USDT', '/USDT')}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Current price - large */}
        {marketData && (
          <>
            <span className={`text-xl font-bold font-mono ${isUp ? 'text-binance-green' : 'text-binance-red'}`}>
              {formatPrice(marketData.price)}
            </span>

            {/* Tapbit-style stat columns */}
            <div className="hidden md:flex items-center gap-5 text-[11px] ml-2">
              <div className="flex flex-col">
                <span className="text-binance-text-dim text-[10px]">마크 가격</span>
                <span className="text-binance-text font-mono">{formatPrice(marketData.price)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-binance-text-dim text-[10px]">인덱스 가격</span>
                <span className="text-binance-text font-mono">{formatPrice(marketData.price * (1 + (Math.random() - 0.5) * 0.001))}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-binance-text-dim text-[10px]">펀딩비/카운트다운</span>
                <span className="text-binance-text font-mono">-0.0002%/01:35:40</span>
              </div>
              <div className="flex flex-col">
                <span className="text-binance-text-dim text-[10px]">24시간 고가</span>
                <span className="text-binance-text font-mono">{formatPrice(marketData.high24h)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-binance-text-dim text-[10px]">24시간 저가</span>
                <span className="text-binance-text font-mono">{formatPrice(marketData.low24h)}</span>
              </div>
              <div className="flex flex-col">
                <span className="text-binance-text-dim text-[10px]">24시간 거래량</span>
                <span className="text-binance-text font-mono">
                  {marketData.volume24h >= 1e9
                    ? `${(marketData.volume24h / 1e9).toFixed(2)}B`
                    : marketData.volume24h >= 1e6
                    ? `${(marketData.volume24h / 1e6).toFixed(3)}${base}`
                    : `${marketData.volume24h.toFixed(3)}${base}`
                  }
                </span>
              </div>
            </div>
          </>
        )}

        {/* Right side - settings */}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] text-binance-text-dim cursor-pointer hover:text-binance-text">⟳</span>
          <span className="text-[10px] text-binance-text-dim cursor-pointer hover:text-binance-text">⚙</span>
        </div>
      </div>
    </div>
  )
}
