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
  const [priceMatches, setPriceMatches] = useState<{ time: string; timestamp: number }[]>([])
  const [searchingClosedTime, setSearchingClosedTime] = useState(false)
  const [manualClosedTime, setManualClosedTime] = useState(false)
  const prevClosedPriceRef = useRef('')
  const [teledditChecked, setTeledditChecked] = useState(false)
  const [selYearMonth, setSelYearMonth] = useState<string | null>(null)
  const [selDay, setSelDay] = useState<number | null>(null)
  const [selHour, setSelHour] = useState<number | null>(null)

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
    setPriceMatches([])
    setManualClosedTime(false)
    setSelYearMonth(null); setSelDay(null); setSelHour(null)
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

  const parseMatchTime = (t: string) => {
    const [datePart, timePart] = t.split('T')
    const [y, mo, d] = datePart.split('-').map(Number)
    const [h, mi] = timePart.split(':').map(Number)
    return { year: y, month: mo, day: d, hour: h, minute: mi }
  }

  // Auto-search closed time when editClosedPrice changes (server-side API)
  useEffect(() => {
    if (!editing) return
    const price = parseFloat(editClosedPrice)
    if (isNaN(price) || price <= 0) {
      setPriceMatches([])
      setManualClosedTime(false)
      return
    }
    if (editClosedPrice === prevClosedPriceRef.current) return
    prevClosedPriceRef.current = editClosedPrice

    setSelYearMonth(null); setSelDay(null); setSelHour(null)

    let cancelled = false
    setSearchingClosedTime(true)
    setPriceMatches([])
    setManualClosedTime(false)

    const fromTime = p.entryTime ? new Date(p.entryTime).getTime() : undefined

    const search = async () => {
      try {
        const params = new URLSearchParams({
          symbol: p.symbol,
          price: String(price),
        })
        if (fromTime) params.set('fromTime', String(fromTime))

        const res = await fetch(`/api/price-touches?${params}`)
        if (!res.ok) throw new Error('API error')
        const data = await res.json()

        if (cancelled) return

        const matches: { time: string; timestamp: number }[] = data.matches || []
        setSearchingClosedTime(false)

        if (matches.length === 0) {
          setManualClosedTime(true)
        } else if (matches.length === 1) {
          const pt = parseMatchTime(matches[0].time)
          const pad = (n: number) => String(n).padStart(2, '0')
          setEditClosedTime(`${pt.year}-${pad(pt.month)}-${pad(pt.day)}T${pad(pt.hour)}:${pad(pt.minute)}`)
          setPriceMatches([])
          setSelYearMonth(null); setSelDay(null); setSelHour(null)
        } else {
          setPriceMatches(matches)
        }
      } catch {
        if (!cancelled) {
          setSearchingClosedTime(false)
          setManualClosedTime(true)
        }
      }
    }

    search()
    return () => { cancelled = true }
  }, [editing, editClosedPrice])

  // Cascading auto-select: 각 단계가 1개뿐이면 자동 선택 + 하위 단계로 넘어감
  useEffect(() => {
    if (priceMatches.length === 0) return
    const parseYM = (t: string) => {
      const p = parseMatchTime(t)
      return `${p.year}-${String(p.month).padStart(2, '0')}`
    }

    // 년월 자동 선택
    const yearMonths = [...new Set(priceMatches.map(m => parseYM(m.time)))].sort().reverse()
    if (yearMonths.length === 1 && selYearMonth === null) {
      setSelYearMonth(yearMonths[0])
      return
    }
    if (selYearMonth === null) return

    const afterYM = priceMatches.filter(m => parseYM(m.time) === selYearMonth)
    const days = [...new Set(afterYM.map(m => parseMatchTime(m.time).day))].sort((a, b) => b - a)
    if (days.length === 1 && selDay === null) {
      setSelDay(days[0])
      return
    }
    if (selDay === null) return

    const afterDay = afterYM.filter(m => parseMatchTime(m.time).day === selDay)
    const hours = [...new Set(afterDay.map(m => parseMatchTime(m.time).hour))].sort((a, b) => b - a)
    if (hours.length === 1 && selHour === null) {
      setSelHour(hours[0])
      return
    }
    if (selHour === null) return

    const afterHour = afterDay.filter(m => parseMatchTime(m.time).hour === selHour)
    const minutes = [...new Set(afterHour.map(m => parseMatchTime(m.time).minute))].sort((a, b) => b - a)
    if (minutes.length === 1) {
      const match = afterHour[0]
      const pt = parseMatchTime(match.time)
      const pad = (n: number) => String(n).padStart(2, '0')
      const ts = `${pt.year}-${pad(pt.month)}-${pad(pt.day)}T${pad(pt.hour)}:${pad(pt.minute)}`
      setEditClosedTime(ts)
      setPriceMatches([])
      setSelYearMonth(null); setSelDay(null); setSelHour(null)
    }
  }, [priceMatches, selYearMonth, selDay, selHour])

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
          {priceMatches.length > 0 && (() => {
            const parseYM = (t: string) => {
              const p = parseMatchTime(t)
              return `${p.year}-${String(p.month).padStart(2, '0')}`
            }
            const yearMonths = [...new Set(priceMatches.map(m => parseYM(m.time)))].sort().reverse()
            const afterYM = selYearMonth !== null ? priceMatches.filter(m => parseYM(m.time) === selYearMonth) : priceMatches
            const days = [...new Set(afterYM.map(m => parseMatchTime(m.time).day))].sort((a, b) => b - a)
            const afterDay = selDay !== null ? afterYM.filter(m => parseMatchTime(m.time).day === selDay) : afterYM
            const hours = [...new Set(afterDay.map(m => parseMatchTime(m.time).hour))].sort((a, b) => b - a)
            const afterHour = selHour !== null ? afterDay.filter(m => parseMatchTime(m.time).hour === selHour) : afterDay
            const minutes = [...new Set(afterHour.map(m => parseMatchTime(m.time).minute))].sort((a, b) => b - a)

            const selectBase = 'bg-binance-bg border text-binance-text text-[11px] rounded h-[28px] px-1 focus:outline-none transition-colors'
            const selectCls = (hasVal: boolean) => `${selectBase} ${hasVal ? 'border-binance-yellow' : 'border-binance-border'}`

            return (
              <div className="mt-1.5 bg-binance-bg border border-binance-border rounded p-2">
                <div className="flex gap-2 items-center">
                  {/* 년월 select */}
                  <select
                    value={selYearMonth ?? ''}
                    onChange={e => { setSelYearMonth(e.target.value || null); setSelDay(null); setSelHour(null) }}
                    className={selectCls(!!selYearMonth)}
                  >
                    <option value="">--년월--</option>
                    {yearMonths.map(ym => {
                      const [y, mo] = ym.split('-')
                      return <option key={ym} value={ym}>{y}년 {parseInt(mo)}월</option>
                    })}
                  </select>
                  {/* 일 select */}
                  {selYearMonth !== null && (
                    <select
                      value={selDay ?? ''}
                      onChange={e => { setSelDay(e.target.value ? Number(e.target.value) : null); setSelHour(null) }}
                      className={selectCls(selDay !== null)}
                    >
                      <option value="">--일--</option>
                      {days.map(d => <option key={d} value={d}>{d}일</option>)}
                    </select>
                  )}
                  {/* 시 select */}
                  {selDay !== null && (
                    <select
                      value={selHour ?? ''}
                      onChange={e => setSelHour(e.target.value ? Number(e.target.value) : null)}
                      className={selectCls(selHour !== null)}
                    >
                      <option value="">--시--</option>
                      {hours.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}시</option>)}
                    </select>
                  )}
                  {/* 분 select */}
                  {selHour !== null && (
                    <select
                      value=""
                      onChange={e => {
                        if (!e.target.value) return
                        const mi = Number(e.target.value)
                        const match = afterHour.find(m => parseMatchTime(m.time).minute === mi)
                        if (match) {
                          const pt = parseMatchTime(match.time)
                          const pad = (n: number) => String(n).padStart(2, '0')
                          const ts = `${pt.year}-${pad(pt.month)}-${pad(pt.day)}T${pad(pt.hour)}:${pad(pt.minute)}`
                          setEditClosedTime(ts)
                          setPriceMatches([])
                          setSelYearMonth(null); setSelDay(null); setSelHour(null)
                        }
                      }}
                      className={selectCls(false)}
                    >
                      <option value="">--분--</option>
                      {minutes.map(mi => <option key={mi} value={mi}>{String(mi).padStart(2, '0')}분</option>)}
                    </select>
                  )}
                  <span className="text-[9px] text-binance-text-dim whitespace-nowrap">
                    ({afterHour.length}개)
                  </span>
                </div>
              </div>
            )
          })()}
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
