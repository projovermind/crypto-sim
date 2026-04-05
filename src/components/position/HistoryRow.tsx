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
  const [selYear, setSelYear] = useState<number | null>(null)
  const [selMonth, setSelMonth] = useState<number | null>(null)
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
    setSelYear(null); setSelMonth(null); setSelDay(null); setSelHour(null)
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

  // Auto-search closed time when editClosedPrice changes (2-pass: 1h → 1m)
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

    setSelYear(null); setSelMonth(null); setSelDay(null); setSelHour(null)

    let cancelled = false
    setSearchingClosedTime(true)
    setPriceMatches([])
    setManualClosedTime(false)

    const entryT = p.entryTime ? new Date(p.entryTime).getTime() : Date.now()
    const now = Date.now()

    const search = async () => {
      try {
        // 패스1: entryTime~now까지 1h 캔들로 도달 시간대 탐색
        const chunkMs = 1500 * 60 * 60 * 1000
        const fetches: Promise<Response>[] = []
        let cursor = entryT
        while (cursor < now) {
          fetches.push(fetch(`/api/klines?symbol=${p.symbol}&interval=1h&limit=1500&startTime=${cursor}`))
          cursor += chunkMs
        }
        const responses = await Promise.all(fetches)
        const allKlines: { time: number; open: number; high: number; low: number; close: number }[] = []
        for (const res of responses) {
          if (res.ok) {
            const data: { time: number; open: number; high: number; low: number; close: number }[] = await res.json()
            allKlines.push(...data)
          }
        }

        const hourlyMatches = allKlines
          .filter(k => k.low <= price && price <= k.high && k.time * 1000 >= entryT && k.time * 1000 <= now)
          .sort((a, b) => b.time - a.time)
          .slice(0, 30)

        if (cancelled) return

        if (hourlyMatches.length === 0) {
          setSearchingClosedTime(false)
          setManualClosedTime(true)
          return
        }

        // 패스2: 각 1h 캔들에 대해 1m 정밀 매치
        const minuteResults = await Promise.all(
          hourlyMatches.map(async (hk) => {
            try {
              const hourStartMs = hk.time * 1000
              const hourEndMs = hourStartMs + 60 * 60 * 1000
              const mRes = await fetch(
                `/api/klines?symbol=${p.symbol}&interval=1m&limit=60&startTime=${hourStartMs}&endTime=${hourEndMs}`
              )
              if (!mRes.ok) return []
              const mKlines: { time: number; open: number; high: number; low: number; close: number }[] = await mRes.json()
              return mKlines
                .filter(k => k.low <= price && price <= k.high)
                .map(k => {
                  const dt = new Date(k.time * 1000)
                  const pad = (n: number) => String(n).padStart(2, '0')
                  const localStr = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
                  return { time: localStr, timestamp: k.time }
                })
            } catch { return [] }
          })
        )

        if (cancelled) return
        const matches = minuteResults.flat().sort((a, b) => b.timestamp - a.timestamp)
        setSearchingClosedTime(false)
        if (matches.length === 0) {
          setManualClosedTime(true)
        } else if (matches.length === 1) {
          // 자동 설정
          const pt = parseMatchTime(matches[0].time)
          const pad = (n: number) => String(n).padStart(2, '0')
          setEditClosedTime(`${pt.year}-${pad(pt.month)}-${pad(pt.day)}T${pad(pt.hour)}:${pad(pt.minute)}`)
          setPriceMatches([])
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
    const uniq = (arr: Array<{ time: string; timestamp: number }>, fn: (p: ReturnType<typeof parseMatchTime>) => number) =>
      [...new Set(arr.map(m => fn(parseMatchTime(m.time))))].sort((a, b) => b - a)

    // 연도 자동 선택
    const years = uniq(priceMatches, p => p.year)
    if (years.length === 1 && selYear === null) {
      setSelYear(years[0])
      return
    }
    if (selYear === null) return

    const afterYear = priceMatches.filter(m => parseMatchTime(m.time).year === selYear)
    const months = uniq(afterYear, p => p.month)
    if (months.length === 1 && selMonth === null) {
      setSelMonth(months[0])
      return
    }
    if (selMonth === null) return

    const afterMonth = afterYear.filter(m => parseMatchTime(m.time).month === selMonth)
    const days = uniq(afterMonth, p => p.day)
    if (days.length === 1 && selDay === null) {
      setSelDay(days[0])
      return
    }
    if (selDay === null) return

    const afterDay = afterMonth.filter(m => parseMatchTime(m.time).day === selDay)
    const hours = uniq(afterDay, p => p.hour)
    if (hours.length === 1 && selHour === null) {
      setSelHour(hours[0])
      return
    }
    if (selHour === null) return

    const afterHour = afterDay.filter(m => parseMatchTime(m.time).hour === selHour)
    const minutes = uniq(afterHour, p => p.minute)
    if (minutes.length === 1) {
      const match = afterHour[0]
      const pt = parseMatchTime(match.time)
      const pad = (n: number) => String(n).padStart(2, '0')
      const ts = `${pt.year}-${pad(pt.month)}-${pad(pt.day)}T${pad(pt.hour)}:${pad(pt.minute)}`
      setEditClosedTime(ts)
      setPriceMatches([])
      setSelYear(null); setSelMonth(null); setSelDay(null); setSelHour(null)
    }
  }, [priceMatches, selYear, selMonth, selDay, selHour])

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
            const filtered = priceMatches.filter(m => {
              const pt = parseMatchTime(m.time)
              if (selYear !== null && pt.year !== selYear) return false
              if (selMonth !== null && pt.month !== selMonth) return false
              if (selDay !== null && pt.day !== selDay) return false
              if (selHour !== null && pt.hour !== selHour) return false
              return true
            })
            const uniq = (fn: (pt: ReturnType<typeof parseMatchTime>) => number) =>
              [...new Set(filtered.map(m => fn(parseMatchTime(m.time))))].sort((a, b) => b - a)
            const years = uniq(pt => pt.year)
            const months = selYear !== null ? uniq(pt => pt.month) : []
            const days = selMonth !== null ? uniq(pt => pt.day) : []
            const hours = selDay !== null ? uniq(pt => pt.hour) : []
            const minutes = selHour !== null ? uniq(pt => pt.minute) : []
            const chip = (active: boolean) =>
              `px-2.5 py-1 text-[11px] rounded transition-colors cursor-pointer select-none ${active ? 'bg-binance-yellow text-black font-bold' : 'bg-binance-bg border border-binance-border text-binance-text hover:border-binance-yellow/40'}`
            const resetL = (lv: number) => {
              if (lv <= 0) { setSelMonth(null); setSelDay(null); setSelHour(null) }
              if (lv <= 1) { setSelDay(null); setSelHour(null) }
              if (lv <= 2) { setSelHour(null) }
            }
            return (
              <div className="mt-1.5 flex flex-row items-start gap-3 overflow-x-auto bg-binance-bg border border-binance-border rounded p-2">
                <div className="min-w-fit shrink-0">
                  <div className="text-[9px] text-binance-text-dim mb-1 uppercase tracking-wider">연도</div>
                  <div className="flex flex-wrap gap-1">
                    {years.map(y => (
                      <button key={y} type="button" onClick={() => { setSelYear(selYear === y ? null : y); resetL(0) }} className={chip(selYear === y)}>{y}</button>
                    ))}
                  </div>
                </div>
                {selYear !== null && (
                  <div className="min-w-fit shrink-0">
                    <div className="text-[9px] text-binance-text-dim mb-1 uppercase tracking-wider">월</div>
                    <div className="flex flex-wrap gap-1">
                      {months.map(mo => (
                        <button key={mo} type="button" onClick={() => { setSelMonth(selMonth === mo ? null : mo); resetL(1) }} className={chip(selMonth === mo)}>{mo}월</button>
                      ))}
                    </div>
                  </div>
                )}
                {selMonth !== null && (
                  <div className="min-w-fit shrink-0">
                    <div className="text-[9px] text-binance-text-dim mb-1 uppercase tracking-wider">일</div>
                    <div className="flex flex-wrap gap-1">
                      {days.map(d => (
                        <button key={d} type="button" onClick={() => { setSelDay(selDay === d ? null : d); resetL(2) }} className={chip(selDay === d)}>{d}일</button>
                      ))}
                    </div>
                  </div>
                )}
                {selDay !== null && (
                  <div className="min-w-fit shrink-0">
                    <div className="text-[9px] text-binance-text-dim mb-1 uppercase tracking-wider">시</div>
                    <div className="flex flex-wrap gap-1">
                      {hours.map(h => (
                        <button key={h} type="button" onClick={() => setSelHour(selHour === h ? null : h)} className={chip(selHour === h)}>{String(h).padStart(2, '0')}시</button>
                      ))}
                    </div>
                  </div>
                )}
                {selHour !== null && minutes.length > 1 && (
                  <div className="min-w-fit shrink-0">
                    <div className="text-[9px] text-binance-text-dim mb-1 uppercase tracking-wider">분</div>
                    <div className="flex flex-wrap gap-1">
                      {minutes.map(mi => {
                        const match = filtered.find(m => parseMatchTime(m.time).minute === mi)!
                        const pt = parseMatchTime(match.time)
                        const pad = (n: number) => String(n).padStart(2, '0')
                        const ts = `${pt.year}-${pad(pt.month)}-${pad(pt.day)}T${pad(pt.hour)}:${pad(pt.minute)}`
                        return (
                          <button key={mi} type="button" onClick={() => { setEditClosedTime(ts); setPriceMatches([]); setSelYear(null); setSelMonth(null); setSelDay(null); setSelHour(null) }} className={chip(false)}>{String(mi).padStart(2, '0')}분</button>
                        )
                      })}
                    </div>
                  </div>
                )}
                <div className="min-w-fit shrink-0 text-[9px] text-binance-text-dim self-center whitespace-nowrap">
                  {selYear ?? '연도 선택'}{selMonth ? ` / ${selMonth}월` : ''}{selDay ? ` / ${selDay}일` : ''}{selHour ? ` / ${String(selHour).padStart(2, '0')}시` : ''} ({filtered.length}개)
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
