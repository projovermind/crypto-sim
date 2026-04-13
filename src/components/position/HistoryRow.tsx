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
  onMemoEdit?: (position: Position, field: 'memo1' | 'memo2' | 'memo3') => void
}

const ICON_COLOR = 'rgb(129, 134, 147)'

function TapbitShareIcon({ size = 14, color = 'currentColor', className = '' }: { size?: number; color?: string; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" fill={color} className={className}>
      <g transform="translate(40, 900) scale(1, -1)">
        <path d="M337 811H433Q450 811 462.5 798.5Q475 786 475.0 768.0Q475 750 462.5 737.5Q450 725 433 725H339Q278 725 258 724Q235 722 223 716Q199 703 186 679Q180 667 178 644Q177 624 177 563V205Q177 143 178 124Q180 101 186 89Q199 65 223 52Q235 46 258 44Q278 43 339 43H697Q759 43 778 44Q801 46 813 52Q838 65 850 89Q856 101 858 124Q859 144 859 205V299Q859 310 865.0 320.0Q871 330 881.0 335.5Q891 341 902.5 341.0Q914 341 923.5 335.5Q933 330 939.0 320.0Q945 310 945 299V203Q945 140 943 117Q940 77 926 51Q901 1 852 -24Q825 -37 785 -41Q762 -43 699 -43H337Q274 -43 251 -41Q211 -37 185 -24Q135 1 110 51Q97 77 93 117Q91 140 91 203V565Q91 628 93 651Q97 691 110 718Q135 767 185 792Q211 806 251 809Q274 811 337 811ZM744 798Q756 811 774.0 811.0Q792 811 804 798L932 670Q945 658 945.0 640.0Q945 622 932 610L804 482Q792 470 774.5 470.0Q757 470 744.5 482.5Q732 495 732.0 512.5Q732 530 744 542L799 597H766Q704 597 685 596Q661 594 650 588Q625 575 613 551Q607 539 605 516Q603 496 603 435V384Q603 366 590.5 353.5Q578 341 560.5 341.0Q543 341 530.5 353.5Q518 366 518 384V437Q518 500 520 523Q523 563 537 589Q562 639 611 664Q638 677 678 681Q701 683 764 683H799L744 738Q731 750 731.0 768.0Q731 786 744 798Z" />
      </g>
    </svg>
  )
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const h = d.getHours()
  const ampm = h < 12 ? '오전' : '오후'
  const hh = String(h % 12 || 12).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}.${dd}\n${ampm} ${hh}:${min}`
}

export default function HistoryRow({ position: p, onEditHistory, onDelete, onShare, onTeledditToggle, onMemoEdit }: HistoryRowProps) {
  const [editing, setEditing] = useState(false)
  const [editClosedPrice, setEditClosedPrice] = useState('')
  const [editAmount, setEditAmount] = useState('')
  const [editLeverage, setEditLeverage] = useState('')
  const [editClosedTime, setEditClosedTime] = useState('')
  const [priceMatches, setPriceMatches] = useState<{ time: string; timestamp: number }[]>([])
  const [searchingClosedTime, setSearchingClosedTime] = useState(false)
  const [manualClosedTime, setManualClosedTime] = useState(false)
  const prevClosedPriceRef = useRef('')
  const [teledditChecked, setTeledditChecked] = useState((p as any).teleditVisible !== false)
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

    const fromTime = p.entryTime ? Math.floor(new Date(p.entryTime).getTime() / 1000) : undefined

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
      <tr className="border-b border-binance-border/50 bg-binance-yellow/5" style={{ height: 52 }}>
        {/* 포지션 번호 */}
        <td className="py-2 pl-3 pr-1 text-binance-text-dim text-[10px] font-mono">#{p.positionNumber ?? '-'}</td>
        {/* 생성 시간 — 일반 행과 동일 */}
        <td className="py-2 pl-1 pr-1 text-binance-text-dim text-[11px] whitespace-pre leading-tight">{createdDate}</td>
        {/* Pair + 배율 편집 */}
        <td className="py-2 px-1">
          <div className="flex flex-col leading-tight">
            <span className={`font-bold ${sideColor}`}>{p.side}</span>
            <div className="flex items-center gap-0.5">
              <span className="text-binance-text font-bold text-[11px]">{base}</span>
              <input type="number" step="1" min="1" max="125" value={editLeverage} onChange={e => handleLeverageChange(e.target.value)} className="w-10 bg-binance-bg border border-binance-border rounded px-1 text-[11px] text-binance-text text-center focus:outline-none focus:border-binance-yellow/50" />
              <span className="text-binance-text-dim text-[10px]">x</span>
            </div>
          </div>
        </td>
        {/* Entry Price (read-only) */}
        <td className="py-2 px-1">
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
        <td className="py-1 px-1">
          <input type="number" step="any" value={editClosedPrice} onChange={e => setEditClosedPrice(e.target.value)} className={editInputClass} />
        </td>
        {/* Quantity USDT (수량 = 증거금, read-only preview) */}
        <td className="py-2 px-2 text-binance-text">
          {formatNumber((parseFloat(editAmount) || p.amount) / (parseFloat(editLeverage) || p.leverage))}
        </td>
        {/* Amount (규모) */}
        <td className="py-1 px-2">
          <input type="number" step="any" value={editAmount} onChange={e => setEditAmount(e.target.value)} className={editInputClass} />
        </td>
        {/* PnL Preview — 일반 행과 동일 스타일 */}
        <td className="py-2 px-2">
          <div className="flex flex-col" style={{ lineHeight: '14px' }}>
            <span className={previewColor} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{formatPnL(preview.pnl)}</span>
            <span className={previewColor} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>({formatNumber(preview.roe)}%)</span>
          </div>
        </td>
        {/* 진입 시간 — 일반 행과 동일 */}
        <td className="py-2 px-2 text-binance-text-dim text-[11px] whitespace-pre leading-tight">{entryTimeDate}</td>
        {/* 청산 시간 */}
        <td className="py-1 px-1" colSpan={3}>
          <div className="flex items-center gap-1.5">
            <input type="text" value={editClosedTime ? (() => { const d = new Date(editClosedTime); const pad = (n: number) => String(n).padStart(2, '0'); return `${String(d.getFullYear()).slice(2)}.${pad(d.getMonth()+1)}.${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}` })() : ''} readOnly className={editInputClass + ' text-[10px] cursor-default'} style={{ width: 110 }} />
            {searchingClosedTime && (
              <span className="text-[9px] text-binance-yellow animate-pulse">탐색...</span>
            )}
            {manualClosedTime && !searchingClosedTime && (
              <span className="text-[9px] text-binance-red">⚠️ 없음</span>
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

              const selectBase = 'bg-binance-bg border text-binance-text text-[10px] rounded h-[24px] px-0.5 focus:outline-none'
              const selectCls = (hasVal: boolean) => `${selectBase} ${hasVal ? 'border-binance-yellow' : 'border-binance-border'}`

              return (
                <>
                  <select value={selYearMonth ?? ''} onChange={e => { setSelYearMonth(e.target.value || null); setSelDay(null); setSelHour(null) }} className={selectCls(!!selYearMonth)}>
                    <option value="">년월</option>
                    {yearMonths.map(ym => { const [y, mo] = ym.split('-'); return <option key={ym} value={ym}>{y.slice(2)}년 {parseInt(mo)}월</option> })}
                  </select>
                  {selYearMonth !== null && (
                    <select value={selDay ?? ''} onChange={e => { setSelDay(e.target.value ? Number(e.target.value) : null); setSelHour(null) }} className={selectCls(selDay !== null)}>
                      <option value="">일</option>
                      {days.map(d => <option key={d} value={d}>{d}일</option>)}
                    </select>
                  )}
                  {selDay !== null && (
                    <select value={selHour ?? ''} onChange={e => setSelHour(e.target.value ? Number(e.target.value) : null)} className={selectCls(selHour !== null)}>
                      <option value="">시</option>
                      {hours.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}시</option>)}
                    </select>
                  )}
                  {selHour !== null && (
                    <select value="" onChange={e => {
                      if (!e.target.value) return
                      const mi = Number(e.target.value)
                      const match = afterHour.find(m => parseMatchTime(m.time).minute === mi)
                      if (match) {
                        const pt = parseMatchTime(match.time)
                        const pad = (n: number) => String(n).padStart(2, '0')
                        setEditClosedTime(`${pt.year}-${pad(pt.month)}-${pad(pt.day)}T${pad(pt.hour)}:${pad(pt.minute)}`)
                      }
                    }} className={selectCls(false)}>
                      <option value="">분</option>
                      {minutes.map(mi => <option key={mi} value={mi}>{String(mi).padStart(2, '0')}분</option>)}
                    </select>
                  )}
                  <span className="text-[9px] text-binance-text-dim">({afterHour.length})</span>
                </>
              )
            })()}
            <div className="flex items-center gap-1 ml-auto">
              <button onClick={saveEdit} disabled={searchingClosedTime || manualClosedTime} className={`px-2 py-1 text-[10px] bg-binance-yellow text-binance-bg rounded font-medium hover:bg-binance-yellow/90 ${(searchingClosedTime || manualClosedTime) ? "opacity-50 cursor-not-allowed" : ""}`}>Save</button>
              <button onClick={cancelEdit} className="px-2 py-1 text-[10px] text-binance-text-dim hover:text-binance-text">Cancel</button>
            </div>
          </div>
        </td>
      </tr>
    )
  }

  return (
    <tr className="border-b border-binance-border/50 hover:bg-binance-border/20 transition-colors" style={{ height: 52 }}>
      {/* 포지션 번호 */}
      <td className="py-2 pl-3 pr-1 text-binance-text-dim text-[10px] font-mono">#{p.positionNumber ?? '-'}</td>
      {/* 생성 시간 */}
      <td className="py-2 pl-1 pr-1 text-binance-text-dim text-[11px] whitespace-pre leading-tight">{createdDate}</td>
      {/* Pair */}
      <td className="py-2 px-1">
        <div className="flex flex-col leading-tight">
          <span className={`font-bold ${sideColor}`}>{p.side}</span>
          <span className="text-[11px]"><span className="text-binance-text font-bold">{base}</span> <span className="text-binance-text-dim">{p.leverage}x</span></span>
        </div>
      </td>
      {/* Entry Price (입력가 + 체결가) */}
      <td className="py-2 px-1">
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
      <td className="py-2 px-1 text-binance-text">{formatPrice(closedPrice)}</td>
      {/* Quantity (수량 USDT = 증거금) */}
      <td className="py-2 px-2 text-binance-text">{formatNumber(p.amount / p.leverage)}</td>
      {/* Amount (규모) */}
      <td className="py-2 px-2 text-binance-text">{formatNumber(p.amount)}</td>
      {/* PnL */}
      <td className="py-2 px-2">
        <div className="flex items-center">
          <div className="flex flex-col" style={{ lineHeight: '16px' }}>
            <span className={pnlColor} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{formatPnL(pnlData.pnl)}</span>
            <span className={pnlColor} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>({formatNumber(pnlData.roe)}%)</span>
          </div>
          <span
            className="cursor-pointer hover:opacity-70 transition-opacity shrink-0 ml-2"
            onClick={e => { e.stopPropagation(); onShare(p) }}
          >
            <TapbitShareIcon size={14} color={ICON_COLOR} />
          </span>
        </div>
      </td>
      {/* 진입 시간 */}
      <td className="py-2 px-2 text-binance-text-dim text-[11px] whitespace-pre leading-tight">{entryTimeDate}</td>
      {/* 청산 시간 */}
      <td className="py-2 px-2 text-binance-text-dim text-[11px] whitespace-pre leading-tight">{closedAtDate}</td>
      {/* 포지션 관리 (Edit Del) — 오른쪽 끝, Teledit 옆 붙임 */}
      <td className="py-1 pl-1 pr-1">
        <div className="flex items-center justify-end gap-1">
          <button onClick={startEdit} className="px-2 py-1 text-[12px] text-binance-yellow hover:bg-binance-yellow/10 rounded font-medium">Edit</button>
          <button onClick={() => onDelete(p.id)} className="px-2 py-1 text-[12px] text-binance-red hover:bg-binance-red/10 rounded font-medium">Del</button>
        </div>
      </td>
      {/* Teledit (☑ M1 M2 M3) — 오른쪽 끝 정렬 */}
      <td className="py-1 pl-0 pr-3">
        <div className="flex items-center justify-end gap-1">
          <input
            type="checkbox"
            checked={teledditChecked}
            onChange={() => {
              const next = !teledditChecked
              setTeledditChecked(next)
              onTeledditToggle?.(p, next)
            }}
            className="w-3.5 h-3.5 rounded border-binance-border accent-binance-yellow"
            title="Teledit"
          />
          {onMemoEdit && (['memo1', 'memo2', 'memo3'] as const).map(f => (
            <button
              key={f}
              onClick={() => onMemoEdit(p, f)}
              className={`text-[9px] px-1 py-0.5 rounded ${(p as any)[f] ? 'bg-binance-yellow/20 text-binance-yellow' : 'bg-binance-border/30 text-binance-text-dim'} hover:opacity-80`}
              title={(p as any)[f] || `${f} 입력`}
            >
              {f.replace('memo', 'M')}
            </button>
          ))}
        </div>
      </td>
    </tr>
  )
}
