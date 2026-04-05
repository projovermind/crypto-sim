'use client'

import { useState, useEffect } from 'react'
import { formatPrice } from '@/lib/calculations'

interface Trade {
  price: number
  qty: number
  time: number
  isBuyerMaker: boolean
}

interface RecentTradesProps {
  symbol: string
}

export default function RecentTrades({ symbol }: RecentTradesProps) {
  const [trades, setTrades] = useState<Trade[]>([])

  useEffect(() => {
    let isMounted = true
    const fetchTrades = async () => {
      try {
        const res = await fetch(`/api/trades/${symbol}`)
        const data = await res.json()
        if (isMounted && Array.isArray(data)) {
          setTrades(data.slice(0, 40))
        }
      } catch {}
    }

    fetchTrades()
    const interval = setInterval(fetchTrades, 2000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [symbol])

  const formatTime = (ts: number) => {
    const d = new Date(ts)
    return d.toLocaleTimeString('en-GB', { hour12: false })
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-binance-border">
        <span className="text-xs font-bold text-binance-text">Trades</span>
        <span className="text-binance-text-dim cursor-pointer">⇄</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-3 px-3 py-1 text-[10px] text-binance-text-dim border-b border-binance-border">
        <span>Price</span>
        <span className="text-right">Quantity(BTC)</span>
        <span className="text-right">Time</span>
      </div>

      {/* Trades list */}
      <div className="flex-1 overflow-hidden">
        {trades.map((trade, i) => (
          <div key={`trade-${i}`} className="grid grid-cols-3 px-3 py-[1px] text-[11px] font-mono">
            <span className={trade.isBuyerMaker ? 'text-binance-red' : 'text-binance-green'}>
              {formatPrice(trade.price)}
            </span>
            <span className="text-right text-binance-text">{trade.qty.toFixed(3)}</span>
            <span className="text-right text-binance-text-dim">{formatTime(trade.time)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
