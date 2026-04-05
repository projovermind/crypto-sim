'use client'

import { useState, useEffect } from 'react'
import { formatPrice } from '@/lib/calculations'

interface OrderBookProps {
  symbol: string
  currentPrice: number
  priceChangePercent: number
  markPrice?: number
}

export default function OrderBook({ symbol, currentPrice, priceChangePercent, markPrice }: OrderBookProps) {
  const [bids, setBids] = useState<[number, number][]>([])
  const [asks, setAsks] = useState<[number, number][]>([])

  useEffect(() => {
    let isMounted = true
    const fetchDepth = async () => {
      try {
        const res = await fetch(`/api/depth/${symbol}`)
        const data = await res.json()
        if (isMounted && data.bids && data.asks) {
          setBids(data.bids.slice(0, 7))
          setAsks(data.asks.slice(0, 7).reverse())
        }
      } catch {}
    }

    fetchDepth()
    const interval = setInterval(fetchDepth, 2000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [symbol])

  // Calculate cumulative totals
  const askCumulatives = asks.map((_, i) => asks.slice(i).reduce((s, a) => s + a[1], 0))
  const bidCumulatives = bids.map((_, i) => bids.slice(0, i + 1).reduce((s, b) => s + b[1], 0))
  const maxCumulative = Math.max(
    ...(askCumulatives.length > 0 ? askCumulatives : [0.001]),
    ...(bidCumulatives.length > 0 ? bidCumulatives : [0.001])
  )

  const buyVolume = bids.reduce((s, b) => s + b[1], 0)
  const sellVolume = asks.reduce((s, a) => s + a[1], 0)
  const totalVolume = buyVolume + sellVolume || 1
  const buyPercent = Math.round((buyVolume / totalVolume) * 100)
  const sellPercent = 100 - buyPercent

  const isUp = priceChangePercent >= 0

  return (
    <div className="flex flex-col bg-binance-card">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-binance-border">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-binance-text">Order Book</span>
          <span className="text-binance-text-dim cursor-pointer text-xs">⇄</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-binance-text-dim bg-binance-bg px-1.5 py-0.5 rounded cursor-pointer">0.1</span>
          <span className="text-binance-text-dim text-[10px]">▾</span>
        </div>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-3 py-1 text-[10px] text-binance-text-dim border-b border-binance-border">
        <span>Price</span>
        <span className="text-right">Quantity(BTC)</span>
        <span className="text-right">Total(BTC)</span>
      </div>

      {/* Asks (sells) - red */}
      <div className="flex flex-col justify-end">
        {asks.map((ask, i) => {
          const cumulative = askCumulatives[i] || 0
          const barWidth = (cumulative / maxCumulative) * 100
          return (
            <div key={`ask-${i}`} className="relative grid grid-cols-3 px-3 py-[2px] text-[11px] font-mono cursor-pointer hover:bg-binance-border/30">
              <div className="absolute right-0 top-0 bottom-0 bg-binance-red/10" style={{ width: `${barWidth}%` }} />
              <span className="relative text-binance-red">{formatPrice(ask[0])}</span>
              <span className="relative text-right text-binance-text">{ask[1].toFixed(3)}</span>
              <span className="relative text-right text-binance-text">{cumulative.toFixed(3)}</span>
            </div>
          )
        })}
      </div>

      {/* Current price */}
      <div className="px-3 py-1.5 border-y border-binance-border flex items-center gap-2">
        <span className={`text-base font-bold font-mono ${isUp ? 'text-binance-green' : 'text-binance-red'}`}>
          {formatPrice(currentPrice)}
        </span>
        <span className={`text-xs ${isUp ? 'text-binance-green' : 'text-binance-red'}`}>
          {isUp ? '↑' : '↓'}
        </span>
        <span className="text-[10px] text-binance-text-dim font-mono">
          {formatPrice(markPrice || currentPrice)}
        </span>
      </div>

      {/* Bids (buys) - green */}
      <div className="flex flex-col">
        {bids.map((bid, i) => {
          const cumulative = bidCumulatives[i] || 0
          const barWidth = (cumulative / maxCumulative) * 100
          return (
            <div key={`bid-${i}`} className="relative grid grid-cols-3 px-3 py-[2px] text-[11px] font-mono cursor-pointer hover:bg-binance-border/30">
              <div className="absolute right-0 top-0 bottom-0 bg-binance-green/10" style={{ width: `${barWidth}%` }} />
              <span className="relative text-binance-green">{formatPrice(bid[0])}</span>
              <span className="relative text-right text-binance-text">{bid[1].toFixed(3)}</span>
              <span className="relative text-right text-binance-text">{cumulative.toFixed(3)}</span>
            </div>
          )
        })}
      </div>

      {/* Buy/Sell ratio */}
      <div className="px-3 py-1.5 border-t border-binance-border">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-binance-green font-bold">B</span>
          <span className="text-[10px] text-binance-green">{buyPercent}%</span>
          <div className="flex-1 flex h-1 rounded-full overflow-hidden">
            <div className="bg-binance-green" style={{ width: `${buyPercent}%` }} />
            <div className="bg-binance-red" style={{ width: `${sellPercent}%` }} />
          </div>
          <span className="text-[10px] text-binance-red">{sellPercent}%</span>
          <span className="text-[10px] text-binance-red font-bold">S</span>
        </div>
      </div>
    </div>
  )
}
