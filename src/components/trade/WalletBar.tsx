'use client'

import { useState } from 'react'
import { PositionWithLive } from '@/types'
import { calculatePnL, formatPnL, formatNumber } from '@/lib/calculations'

interface WalletBarProps {
  positions: PositionWithLive[]
  balance: number
  onUpdateBalance: (newBalance: number) => void
}

export default function WalletBar({ positions, balance, onUpdateBalance }: WalletBarProps) {
  const [addAmount, setAddAmount] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const handleAdd = () => {
    const val = parseFloat(addAmount)
    if (val > 0) {
      onUpdateBalance(balance + val)
      setAddAmount('')
      setShowAdd(false)
    }
  }

  const openPositions = positions.filter(p => p.status === 'OPEN')

  const unrealizedPnL = openPositions.reduce((sum, p) => {
    const pnl = calculatePnL(p.side, p.entryPrice, p.currentPrice, p.leverage, p.amount, p.quantity, p.entryFee)
    return sum + pnl.pnl
  }, 0)

  const usedMargin = openPositions.reduce((sum, p) => sum + (p.amount / p.leverage), 0)
  const availableBalance = balance - usedMargin
  const totalValue = availableBalance + usedMargin + unrealizedPnL

  return (
    <div className="bg-binance-bg rounded px-3 py-2 mb-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px]">
        <div className="flex items-center gap-1">
          <span className="text-binance-text-dim">지갑</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-binance-text-dim">가용:</span>
          <span className="text-binance-text font-mono">{formatNumber(availableBalance)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-binance-text-dim">증거금:</span>
          <span className="text-binance-text font-mono">{formatNumber(usedMargin)}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-binance-text-dim">미실현:</span>
          <span className={`font-mono ${unrealizedPnL >= 0 ? 'text-binance-green' : 'text-binance-red'}`}>
            {formatPnL(unrealizedPnL)}
          </span>
        </div>
        <div className="flex items-center gap-1 border-l border-binance-border pl-2">
          <span className="text-binance-text-dim">합계:</span>
          <span className="text-binance-text font-mono font-bold">{formatNumber(totalValue)}</span>
        </div>
        {showAdd ? (
          <div className="flex items-center gap-1 ml-auto">
            <input
              type="number"
              step="any"
              value={addAmount}
              onChange={e => setAddAmount(e.target.value)}
              placeholder="USDT"
              className="w-20 h-6 bg-transparent border border-binance-border rounded px-2 text-[10px] text-binance-text focus:outline-none focus:border-binance-yellow/50"
              onKeyDown={e => e.key === 'Enter' && handleAdd()}
              autoFocus
            />
            <button onClick={handleAdd} className="h-6 px-2 text-[10px] font-medium bg-binance-yellow text-binance-bg rounded hover:bg-binance-yellow/90">+</button>
            <button onClick={() => { setShowAdd(false); setAddAmount('') }} className="h-6 px-1 text-[10px] text-binance-text-dim hover:text-binance-text">&times;</button>
          </div>
        ) : (
          <button
            onClick={() => setShowAdd(true)}
            className="ml-auto text-[10px] text-binance-yellow hover:underline"
          >
            + 충전
          </button>
        )}
      </div>
    </div>
  )
}
