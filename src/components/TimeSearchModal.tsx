'use client'

import { useState, useCallback } from 'react'
import { formatPrice } from '@/lib/calculations'

interface TimeSearchModalProps {
  symbol: string
  targetPrice: number
  onSelect: (date: Date) => void
  onClose: () => void
}

interface KlineResult {
  time: number
  open: number
  high: number
  low: number
  close: number
}

type RangeMode = 2 | 4 | 8

export default function TimeSearchModal({
  symbol,
  targetPrice,
  onSelect,
  onClose,
}: TimeSearchModalProps) {
  // 날짜: 오늘 기준
  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`

  const [dateInput, setDateInput] = useState(todayStr)
  const [hourInput, setHourInput] = useState('12')
  const [rangeMode, setRangeMode] = useState<RangeMode>(2)
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<KlineResult[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState('')

  const doSearch = useCallback(async (range: RangeMode) => {
    setSearching(true)
    setError('')
    setResults([])
    setRangeMode(range)

    try {
      // Parse date + hour → center timestamp
      const [y, m, d] = dateInput.split('-').map(Number)
      const centerMs = new Date(y, m - 1, d, parseInt(hourInput), 0, 0).getTime()

      const startMs = centerMs - range * 3600 * 1000
      const endMs = centerMs + range * 3600 * 1000
      const totalCandles = range * 2 * 60 // 1m interval, range hours each side

      const res = await fetch(
        `/api/klines?symbol=${symbol}&interval=1m&startTime=${startMs}&endTime=${endMs}&limit=${totalCandles}`
      )
      if (!res.ok) {
        setError('캔들 데이터를 가져올 수 없습니다.')
        return
      }

      const klines: KlineResult[] = await res.json()

      // Filter: low <= targetPrice <= high
      const filtered = klines.filter(
        (k) => k.low <= targetPrice && targetPrice <= k.high
      )

      // Sort by time descending
      filtered.sort((a, b) => b.time - a.time)
      setResults(filtered)
    } catch {
      setError('검색 중 오류가 발생했습니다.')
    } finally {
      setSearching(false)
      setSearched(true)
    }
  }, [dateInput, hourInput, symbol, targetPrice])

  const handleSearch = () => doSearch(2)

  const handleExpand = () => {
    const next: RangeMode = rangeMode === 2 ? 4 : 8
    doSearch(next)
  }

  const formatTime = (ts: number) => {
    const d = new Date(ts * 1000)
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }

  const formatDate = (ts: number) => {
    const d = new Date(ts * 1000)
    return `${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-binance-card border border-binance-border rounded-lg p-5 w-[460px] max-w-[92vw] max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-binance-text">시간 탐색</h3>
          <button onClick={onClose} className="text-binance-text-dim hover:text-binance-text">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Info */}
        <div className="text-[11px] text-binance-text-dim mb-3">
          <span className="text-binance-yellow">{symbol}</span> 가격{' '}
          <span className="text-binance-text font-medium">{formatPrice(targetPrice)}</span>이 체결된 시간 탐색
        </div>

        {/* Search inputs */}
        <div className="flex items-center gap-2 mb-3">
          <input
            type="date"
            value={dateInput}
            onChange={(e) => setDateInput(e.target.value)}
            className="flex-1 bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50"
          />
          <select
            value={hourInput}
            onChange={(e) => setHourInput(e.target.value)}
            className="bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50"
          >
            {Array.from({ length: 24 }, (_, i) => (
              <option key={i} value={String(i)}>
                {String(i).padStart(2, '0')}시
              </option>
            ))}
          </select>
          <button
            onClick={handleSearch}
            disabled={searching}
            className="px-4 py-2 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50 whitespace-nowrap"
          >
            {searching ? '검색 중...' : '검색'}
          </button>
        </div>

        {/* Range indicator */}
        <div className="text-[10px] text-binance-text-dim mb-2">
          검색 범위: ±{rangeMode}h ({rangeMode * 2}시간, {rangeMode * 2 * 60}캔들)
        </div>

        {/* Error */}
        {error && (
          <div className="text-[11px] text-red-400 mb-2">{error}</div>
        )}

        {/* Results */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {searched && results.length === 0 && !searching && !error && (
            <div className="flex flex-col items-center gap-3 py-6">
              <span className="text-[11px] text-binance-text-dim">
                해당 범위에 가격이 {formatPrice(targetPrice)}을 통과한 캔들이 없습니다.
              </span>
              {rangeMode < 8 && (
                <button
                  onClick={handleExpand}
                  className="px-4 py-1.5 text-xs border border-binance-yellow text-binance-yellow rounded hover:bg-binance-yellow/10 transition-colors"
                >
                  범위 확장 (±{rangeMode === 2 ? 4 : 8}h)
                </button>
              )}
            </div>
          )}

          {results.length > 0 && (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-binance-text-dim border-b border-binance-border">
                  <th className="text-left py-1.5 font-normal">날짜</th>
                  <th className="text-left py-1.5 font-normal">시간</th>
                  <th className="text-right py-1.5 font-normal">O</th>
                  <th className="text-right py-1.5 font-normal">H</th>
                  <th className="text-right py-1.5 font-normal">L</th>
                  <th className="text-right py-1.5 font-normal">C</th>
                  <th className="text-center py-1.5 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((k, i) => (
                  <tr
                    key={`${k.time}-${i}`}
                    className="border-b border-binance-border/50 hover:bg-binance-border/20"
                  >
                    <td className="py-1.5 text-binance-text-dim">{formatDate(k.time)}</td>
                    <td className="py-1.5 text-binance-yellow font-medium">{formatTime(k.time)}</td>
                    <td className="py-1.5 text-right text-binance-text">{formatPrice(k.open)}</td>
                    <td className="py-1.5 text-right text-green-400">{formatPrice(k.high)}</td>
                    <td className="py-1.5 text-right text-red-400">{formatPrice(k.low)}</td>
                    <td className="py-1.5 text-right text-binance-text">{formatPrice(k.close)}</td>
                    <td className="py-1.5 text-center">
                      <button
                        onClick={() => onSelect(new Date(k.time * 1000))}
                        className="px-2 py-0.5 text-[10px] bg-binance-yellow/20 text-binance-yellow rounded hover:bg-binance-yellow/30 transition-colors"
                      >
                        선택
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Result count */}
        {results.length > 0 && (
          <div className="mt-2 text-[10px] text-binance-text-dim text-right">
            {results.length}개 캔들 발견
          </div>
        )}
      </div>
    </div>
  )
}
