'use client'

import { useState, useEffect, useRef } from 'react'
import { Position } from '@/types'
import { formatPrice, formatPnL, formatNumber, calculatePnL } from '@/lib/calculations'

interface HistoryRowProps {
  position: Position
  onEditHistory: (id: string, data: {
    entryPrice?: number
    closedPrice?: number
    amount?: number
    leverage?: number
    entryTime?: string
    closedAt?: string
  }) => void
  onDelete: (id: string) => void
  onShare: (position: Position) => void
  onTeledditToggle?: (position: Position, checked: boolean) => void
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export default function HistoryRow({ position: p, onEditHistory, onDelete, onShare, onTeledditToggle }: HistoryRowProps) {
  const [editing, setEditing] = useState(false)
  const [editClosedPrice, setEditClosedPrice] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editLeverage, setEditLeverage] = useState('')
  const [editClosedTime, setEditClosedTime] = useState('')
  const [closedTimeCandidates, setClosedTimeCandidates] = useState<{ time: number; open: number; high: number; low: number; close: number }[]>([])
  const [searchingClosedTime, setSearchingClosedTime] = useState(false)
  const [manualClosedTime, setManualClosedTime] = useState(false)
  const prevClosedPriceRef = useRef('')
  const [teledditChecked, setTeledditChecked] = useState(false)

  const closedPrice = p.closedPrice || p.entryPrice
  const pnlData = calculatePnL(p.side, p.entryPrice, closedPrice, p.leverage, p.amount, p.quantity, p.entryFee)
  const base = p.symbol.replace('USDT', '')
  const pnlColor = pnlData.pnl >= 0 ? 'text-binance-green' : 'text-binance-red'
  const sideColor = p.side === 'LONG' ? 'text-binance-green' : 'text-binance-red'

  const createdDate = formatDateTime(p.createdAt)
  const entryTimeDate = formatDateTime(p.entryTime)
  const closedAtDate = formatDateTime(p.closedAt)

  // margin(증거금) = amount / leverage → 배율 변경 시 margin 고정, amount 재계산
  const handleLeverageChange = (val: string) => {
    const intVal = val.replace(/[^0-9]/g, '')
    const newLev = parseInt(intVal) || 0
    const oldLev = parseInt(editLeverage) || p.leverage
    const oldAmt = parseFloat(editAmount) || p.amount
    setEditLeverage(intVal)
    if (newLev > 0 && oldLev > 0) {
      const margin = oldAmt / oldLev
      setEditAmount((margin * newLev).toFixed(2))
    }
  }

  const toLocalDatetime = (dateStr: string | null) => {
    if (!dateStr) return ''
    const d = new Date(dateStr)
    const offset = d.getTimezoneOffset() * 60000
    return new Date(d.getTime() - offset).toISOString().slice(0, 16)
  }

  const startEdit = () => {
    setEditing(true)
    setEditClosedPrice(String(p.closedPrice || ''))
    setEditAmount(String(p.amount))
    setEditLeverage(String(p.leverage))
    setEditClosedTime(toLocalDatetime(p.closedAt))
  }

  const cancelEdit = () => {
    setEditing(false)
    setClosedTimeCandidates([])
    setManualClosedTime(false)
    prevClosedPriceRef.current = ''
  }

  const saveEdit = () => {
    if (manualClosedTime) {
      alert('진입 이후 해당 가격에 도달한 적이 없습니다.')
      return
    }
    const data: any = {}
    const newClosed = parseFloat(editClosedPrice)
    const newAmount = parseFloat(editAmount)
    const newLeverage = parseFloat(editLeverage)

    if (newClosed && newClosed !== p.closedPrice) data.closedPrice = newClosed
    if (newAmount && newAmount !== p.amount) data.amount = newAmount
    if (newLeverage && newLeverage !== p.leverage) data.leverage = newLeverage
    if (editClosedTime) {
      const newClosed = new Date(editClosedTime).toISOString()
      if (newClosed !== (p.closedAt || '')) data.closedAt = newClosed
    }

    if (Object.keys(data).length > 0) onEditHistory(p.id, data)
    setEditing(false)
  }

  const previewPnL = () => {
    if (!editing) return pnlData
    const ep = p.entryPrice
    const cp = parseFloat(editClosedPrice) || closedPrice
    const amt = parseFloat(editAmount) || p.amount
    const lev = parseFloat(editLeverage) || p.leverage
    const qty = amt / ep
    return calculatePnL(p.side, ep, cp, lev, amt, qty, p.entryFee)
  }

  const preview = previewPnL()
  const previewColor = preview.pnl >= 0 ? 'text-binance-green' : 'text-binance-red'

  const editInputClass = "w-full bg-binance-bg border border-binance-border rounded px-2 py-1 text-[11px] text-binance-text font-mono focus:outline-none focus:border-binance-yellow/50"

  // Auto-search closed time when editClosedPrice changes
  useEffect(() => {
    if (!editing) return
    const price = parseFloat(editClosedPrice)
    if (isNaN(price) || price <= 0) {
      setClosedTimeCandidates([])
      setManualClosedTime(false)
      return
    }
    // Skip if same as previous value (avoid re-search)
    if (editClosedPrice === prevClosedPriceRef.current) return
    prevClosedPriceRef.current = editClosedPrice

    const entryT = p.entryTime ? new Date(p.entryTime).getTime() : Date.now()
    const startTime = entryT - 2 * 3600000
    const endTime = entryT + 4 * 3600000

    let cancelled = false
    setSearchingClosedTime(true)
    setClosedTimeCandidates([])
    setManualClosedTime(false)

    fetch(`/api/klines?symbol=${p.symbol}&interval=1m&startTime=${startTime}&endTime=${endTime}&limit=360`)
      .then(r => r.json())
      .then((klines: { time: number; open: number; high: number; low: number; close: number }[]) => {
        if (cancelled) return
        const matches = klines.filter(k => k.low <= price && price <= k.high)
        setSearchingClosedTime(false)
        if (matches.length === 1) {
          // Auto-set single match
          const d = new Date(matches[0].time * 1000)
          const offset = d.getTimezoneOffset() * 60000
          setEditClosedTime(new Date(d.getTime() - offset).toISOString().slice(0, 16))
          setClosedTimeCandidates([])
        } else if (matches.length > 1) {
          // Show candidates, latest first
          setClosedTimeCandidates(matches.sort((a, b) => b.time - a.time))
        } else {
          setManualClosedTime(true)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSearchingClosedTime(false)
          setManualClosedTime(true)
        }
      })

    return () => { cancelled = true }
  }, [editing, editClosedPrice])

  const selectClosedTimeCandidate = (time: number) => {
    const d = new Date(time * 1000)
    const offset = d.getTimezoneOffset() * 60000
    setEditClosedTime(new Date(d.getTime() - offset).toISOString().slice(0, 16))
    setClosedTimeCandidates([])
  }

  if (editing) {
    return (
      <tr className="border-b border-binance-border/50 bg-binance-yellow/5">
        {/* 생성 시간 */}
        <td className="py-2 pl-3 pr-2 text-binance-text-dim">{createdDate}</td>
        {/* Pair */}
        <td className="py-2 px-2">
          <div className="flex items-center gap-1">
            <span className={`font-bold ${sideColor}`}>{p.side}</span>
            <span className="text-binance-text font-bold">{base}</span>
          </div>
        </td>
        {/* Entry Price (read-only) */}
        <td className="py-2 px-2">
          {p.inputPrice != null && p.inputPrice !== p.entryPrice ? (
            <>
              <div className="text-binance-text leading-tight">
                입력가 {formatPrice(p.inputPrice)}
              </div>
              <div className="text-binance-text leading-tight">
                체결가 {formatPrice(p.entryPrice)}
              </div>
            </>
          ) : (
            <div className="text-binance-text">
              진입가 {formatPrice(p.entryPrice)}
            </div>
          )}
        </td>
        {/* Closed Price */}
        <td className="py-1 px-2">
          <input type="number" step="any" value={editClosedPrice} onChange={e => setEditClosedPrice(e.target.value)} className={editInputClass} />
        </td>
        {/* Quantity USDT (수량 = 증거금, read-only preview) */}
        <td className="py-2 px-2 text-binance-text">
          {formatNumber((parseFloat(editAmount) || p.amount) / (parseFloat(editLeverage) || p.leverage))}
        </td>
        {/* Leverage */}
        <td className="py-1 px-2">
          <input type="number" step="1" min="1" max="125" value={editLeverage} onChange={e => handleLeverageChange(e.target.value)} className={editInputClass} />
        </td>
        {/* Amount (규모) */}
        <td className="py-1 px-2">
          <input type="number" step="any" value={editAmount} onChange={e => setEditAmount(e.target.value)} className={editInputClass} />
        </td>
        {/* PnL Preview */}
        <td className="py-2 px-2">
          <div className="flex flex-col" style={{ lineHeight: '14px' }}>
            <span className={previewColor} style={{ fontVariantNumeric: 'tabular-nums' }}>{formatPnL(preview.pnl)}</span>
            <span className={previewColor} style={{ fontVariantNumeric: 'tabular-nums' }}>({formatNumber(preview.roe)}%)</span>
          </div>
        </td>
        {/* 진입 시간 (read-only) */}
        <td className="py-2 px-2 text-binance-text-dim">{entryTimeDate}</td>
        {/* 청산 시간 */}
        <td className="py-1 px-2">
          <input type="datetime-local" value={editClosedTime} onChange={e => setEditClosedTime(e.target.value)} className={editInputClass + ' text-[10px]'} />
          {searchingClosedTime && (
            <div className="text-[9px] text-binance-yellow mt-0.5 animate-pulse">탐색 중...</div>
          )}
          {manualClosedTime && !searchingClosedTime && (
            <div className="text-[9px] text-binance-red mt-0.5">⚠️ 해당 가격 도달 이력 없음</div>
          )}
          {closedTimeCandidates.length > 1 && (
            <div className="mt-1 max-h-[60px] overflow-y-auto flex flex-wrap gap-0.5">
              {closedTimeCandidates.slice(0, 12).map((k) => {
                const t = new Date(k.time * 1000)
                const hh = String(t.getHours()).padStart(2, '0')
                const mm = String(t.getMinutes()).padStart(2, '0')
                return (
                  <button
                    key={k.time}
                    onClick={() => selectClosedTimeCandidate(k.time)}
                    className="px-1 py-0.5 text-[9px] bg-binance-bg border border-binance-border rounded hover:border-binance-yellow hover:text-binance-yellow transition-colors font-mono"
                  >
                    {hh}:{mm}
                  </button>
                )
              })}
              {closedTimeCandidates.length > 12 && (
                <span className="text-[9px] text-binance-text-dim px-1 self-center">+{closedTimeCandidates.length - 12}</span>
              )}
            </div>
          )}
        </td>
        {/* Actions */}
        <td className="py-1 px-2">
          <div className="flex items-center gap-1">
            <button onClick={saveEdit} disabled={searchingClosedTime || manualClosedTime} className={`px-2 py-1 text-[10px] bg-binance-yellow text-binance-bg rounded font-medium hover:bg-binance-yellow/90 ${(searchingClosedTime || manualClosedTime) ? "opacity-50 cursor-not-allowed" : ""}`}>Save</button>
            <button onClick={cancelEdit} className="px-2 py-1 text-[10px] text-binance-text-dim hover:text-binance-text">Cancel</button>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-binance-border/50 hover:bg-binance-border/20 transition-colors">
      {/* 생성 시간 */}
      <td className="py-2 pl-3 pr-2 text-binance-text-dim">{createdDate}</td>
      {/* Pair */}
      <td className="py-2 px-2">
        <div className="flex items-center gap-1">
          <span className={`font-bold ${sideColor}`}>{p.side}</span>
          <span className="text-binance-text font-bold">{base}</span>
          <span className="text-binance-text-dim text-[11px]">{p.leverage}x</span>
        </div>
      </td>
      {/* Entry Price (입력가 + 체결가) */}
      <td className="py-2 px-2">
        {p.inputPrice != null && p.inputPrice !== p.entryPrice ? (
          <>
            <div className="text-binance-text leading-tight">
              입력가 {formatPrice(p.inputPrice)}
            </div>
            <div className="text-binance-text leading-tight">
              체결가 {formatPrice(p.entryPrice)}
            </div>
          </>
        ) : (
          <div className="text-binance-text">
            진입가 {formatPrice(p.entryPrice)}
          </div>
        )}
      </td>
      {/* Closed Price */}
      <td className="py-2 px-2 text-binance-text">{formatPrice(closedPrice)}</td>
      {/* Quantity (수량 USDT = 증거금) */}
      <td className="py-2 px-2 text-binance-text">{formatNumber(p.amount / p.leverage)}</td>
      {/* Leverage (배율) */}
      <td className="py-2 px-2 text-binance-text">{p.leverage}x</td>
      {/* Amount (규모) */}
      <td className="py-2 px-2 text-binance-text">{formatNumber(p.amount)}</td>
      {/* PnL */}
      <td className="py-2 px-2">
        <div className="flex flex-col" style={{ lineHeight: '16px' }}>
          <span className={pnlColor} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{formatPnL(pnlData.pnl)}</span>
          <span className={pnlColor} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>({formatNumber(pnlData.roe)}%)</span>
        </div>
      </td>
      {/* 진입 시간 */}
      <td className="py-2 px-2 text-binance-text-dim">{entryTimeDate}</td>
      {/* 청산 시간 */}
      <td className="py-2 px-2 text-binance-text-dim">{closedAtDate}</td>
      {/* Actions */}
      <td className="py-1 px-2">
        <div className="flex items-center gap-1.5">
          <button onClick={startEdit} className="px-2.5 py-1 text-[13px] text-binance-yellow hover:bg-binance-yellow/10 rounded font-medium">Edit</button>
          <button onClick={() => onDelete(p.id)} className="px-2.5 py-1 text-[13px] text-binance-red hover:bg-binance-red/10 rounded font-medium">Del</button>
          <button
            onClick={() => onShare(p)}
            className="px-2.5 py-1 text-[13px] text-binance-text-dim hover:text-binance-text hover:bg-binance-border/30 rounded font-medium transition-colors"
            title="공유 포스터"
          >
            Share
          </button>
        </div>
      </td>
    </tr>
  )
}
