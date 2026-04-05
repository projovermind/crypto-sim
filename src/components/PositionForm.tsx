'use client'

import { useState, useEffect } from 'react'
import { SYMBOLS, LEVERAGES } from '@/types'
import { formatPrice } from '@/lib/calculations'
import TimeSearchModal from './TimeSearchModal'

interface PositionFormProps {
  onSubmit: (data: any) => Promise<void>
  onCancel?: () => void
  defaultSymbol?: string
}

export default function PositionForm({ onSubmit, onCancel, defaultSymbol }: PositionFormProps) {
  const [symbol, setSymbol] = useState(defaultSymbol || 'BTCUSDT')
  const [side, setSide] = useState<'LONG' | 'SHORT'>('LONG')
  const [leverage, setLeverage] = useState(10)
  const [entryPrice, setEntryPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [entryTime, setEntryTime] = useState('')
  const [livePrice, setLivePrice] = useState<number | null>(null)
  const [loading, setLoading] = useState(false)
  const [useLivePrice, setUseLivePrice] = useState(false)
  const [showTimeSearch, setShowTimeSearch] = useState(false)

  // Fetch live price for selected symbol
  useEffect(() => {
    const fetchPrice = async () => {
      try {
        const res = await fetch(`/api/price/${symbol}`)
        const data = await res.json()
        if (data.price) {
          setLivePrice(data.price)
          if (useLivePrice) {
            setEntryPrice(String(data.price))
          }
        }
      } catch (e) {}
    }

    fetchPrice()
    const interval = setInterval(fetchPrice, 5000)
    return () => clearInterval(interval)
  }, [symbol, useLivePrice])

  // Set default entry time to now
  useEffect(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    setEntryTime(now.toISOString().slice(0, 16))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      // 입력값 = 증거금(마진), 포지션 크기 = 증거금 × 레버리지
      const margin = parseFloat(amount)
      const positionSize = margin * leverage
      await onSubmit({
        symbol,
        side,
        leverage,
        entryPrice: parseFloat(entryPrice),
        amount: positionSize,
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        entryTime: entryTime ? new Date(entryTime).toISOString() : new Date().toISOString(),
      })
      // Reset form
      setAmount('')
      setTakeProfit('')
      setStopLoss('')
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const inputClass = "w-full bg-binance-bg border border-binance-border rounded-lg px-3 py-2.5 text-binance-text text-sm focus:outline-none focus:border-binance-yellow transition-colors"
  const labelClass = "block text-xs text-binance-text-dim mb-1.5 font-medium"

  return (
    <form onSubmit={handleSubmit} className="bg-binance-card rounded-xl border border-binance-border p-5 space-y-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold text-binance-text">📈 새 포지션 진입</h2>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-binance-text-dim hover:text-binance-text text-xl">
            ✕
          </button>
        )}
      </div>

      {/* Symbol */}
      <div>
        <label className={labelClass}>코인</label>
        <select value={symbol} onChange={e => setSymbol(e.target.value)} className={inputClass}>
          {SYMBOLS.map(s => (
            <option key={s} value={s}>{s.replace('USDT', '/USDT')}</option>
          ))}
        </select>
        {livePrice && (
          <p className="text-xs text-binance-text-dim mt-1">
            현재가: <span className="text-binance-yellow font-mono">{formatPrice(livePrice)} USDT</span>
            <button
              type="button"
              onClick={() => { setUseLivePrice(true); setEntryPrice(String(livePrice)); }}
              className="ml-2 text-binance-blue hover:underline"
            >
              적용
            </button>
          </p>
        )}
      </div>

      {/* Side */}
      <div>
        <label className={labelClass}>방향</label>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setSide('LONG')}
            className={`py-2.5 rounded-lg font-bold text-sm transition-all ${
              side === 'LONG'
                ? 'bg-binance-green/20 text-binance-green border-2 border-binance-green'
                : 'bg-binance-bg text-binance-text-dim border-2 border-binance-border hover:border-binance-green/50'
            }`}
          >
            ▲ LONG
          </button>
          <button
            type="button"
            onClick={() => setSide('SHORT')}
            className={`py-2.5 rounded-lg font-bold text-sm transition-all ${
              side === 'SHORT'
                ? 'bg-binance-red/20 text-binance-red border-2 border-binance-red'
                : 'bg-binance-bg text-binance-text-dim border-2 border-binance-border hover:border-binance-red/50'
            }`}
          >
            ▼ SHORT
          </button>
        </div>
      </div>

      {/* Leverage */}
      <div>
        <label className={labelClass}>배율 (Leverage)</label>
        <div className="flex flex-wrap gap-1.5">
          {LEVERAGES.map(l => (
            <button
              key={l}
              type="button"
              onClick={() => setLeverage(l)}
              className={`px-2.5 py-1.5 rounded text-xs font-bold transition-all ${
                leverage === l
                  ? 'bg-binance-yellow text-binance-bg'
                  : 'bg-binance-bg text-binance-text-dim border border-binance-border hover:border-binance-yellow/50'
              }`}
            >
              {l}x
            </button>
          ))}
        </div>
      </div>

      {/* Entry Price */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-binance-text-dim font-medium whitespace-nowrap shrink-0">가격 (USDT)</label>
        <input
          type="number"
          step="any"
          value={entryPrice}
          onChange={e => { setEntryPrice(e.target.value); setUseLivePrice(false); }}
          placeholder="0.00"
          className="flex-1 bg-binance-bg border border-binance-border rounded-lg px-3 py-2 text-binance-text text-sm focus:outline-none focus:border-binance-yellow transition-colors"
          required
        />
      </div>

      {/* Amount (Margin) */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-binance-text-dim font-medium whitespace-nowrap shrink-0">수량 (증거금)</label>
        <input
          type="number"
          step="any"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          placeholder="100.00"
          className="flex-1 bg-binance-bg border border-binance-border rounded-lg px-3 py-2 text-binance-text text-sm focus:outline-none focus:border-binance-yellow transition-colors"
          required
        />
      </div>

      {/* TP */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-binance-text-dim font-medium whitespace-nowrap shrink-0">
          TP <span className="text-binance-green">(USDT)</span>
        </label>
        <input
          type="number"
          step="any"
          value={takeProfit}
          onChange={e => setTakeProfit(e.target.value)}
          placeholder="선택사항"
          className="flex-1 bg-binance-bg border border-binance-border rounded-lg px-3 py-2 text-binance-text text-sm focus:outline-none focus:border-binance-yellow transition-colors"
        />
      </div>

      {/* SL */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-binance-text-dim font-medium whitespace-nowrap shrink-0">
          SL <span className="text-binance-red">(USDT)</span>
        </label>
        <input
          type="number"
          step="any"
          value={stopLoss}
          onChange={e => setStopLoss(e.target.value)}
          placeholder="선택사항"
          className="flex-1 bg-binance-bg border border-binance-border rounded-lg px-3 py-2 text-binance-text text-sm focus:outline-none focus:border-binance-yellow transition-colors"
        />
      </div>

      {/* Entry Time */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs text-binance-text-dim font-medium">진입 시간</label>
          <button
            type="button"
            onClick={() => {
              if (!entryPrice || isNaN(parseFloat(entryPrice))) {
                alert('먼저 진입 가격을 입력하세요')
                return
              }
              setShowTimeSearch(true)
            }}
            className="text-binance-text-dim hover:text-binance-yellow transition-colors text-lg"
            title="시간 탐색"
          >
            🔍
          </button>
        </div>
        <input
          type="datetime-local"
          value={entryTime}
          onChange={e => setEntryTime(e.target.value)}
          className={inputClass}
        />
      </div>

      {/* Time Search Modal */}
      {showTimeSearch && (
        <TimeSearchModal
          symbol={symbol}
          targetPrice={parseFloat(entryPrice)}
          onSelect={(date: Date) => {
            const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
            setEntryTime(d.toISOString().slice(0, 16))
            setShowTimeSearch(false)
          }}
          onClose={() => setShowTimeSearch(false)}
        />
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={loading}
        className={`w-full py-3 rounded-lg font-bold text-sm transition-all ${
          side === 'LONG'
            ? 'bg-binance-green hover:bg-binance-green/90 text-binance-bg'
            : 'bg-binance-red hover:bg-binance-red/90 text-white'
        } disabled:opacity-50`}
      >
        {loading ? '진입 중...' : `${side === 'LONG' ? '🟢 롱' : '🔴 숏'} 포지션 진입`}
      </button>
    </form>
  )
}
