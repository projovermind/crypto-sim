'use client'

import { useState, useEffect, useRef } from 'react'
import { formatNumber } from '@/lib/calculations'

const MAX_MARGIN_USDT = 25000

interface OrderFormProps {
  symbol: string
  currentPrice: number
  leverage: number
  orderType: 'Limit' | 'Market'
  setOrderType: (t: 'Limit' | 'Market') => void
  entryPrice: string
  setEntryPrice: (v: string) => void
  amount: string
  setAmount: (v: string) => void
  takeProfit: string
  setTakeProfit: (v: string) => void
  stopLoss: string
  setStopLoss: (v: string) => void
  showTPSL: boolean
  setShowTPSL: (v: boolean) => void
  entryTime: string
  setEntryTime: (v: string) => void
  sliderValue: number
  setSliderValue: (v: number) => void
  qtyUnit: string
  setQtyUnit: (v: string) => void
  volatileMode: boolean
  setVolatileMode: (v: boolean) => void
  enableSlippage: boolean
  setEnableSlippage: (v: boolean) => void
}

const inputClass = "w-full h-[34px] bg-transparent border border-binance-border rounded px-3 text-binance-text text-[13px] focus:outline-none focus:border-binance-yellow/50 transition-colors [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"

// Funding fee calculator
function getFundingInfo(entryTime: string, entryPrice: string, currentPrice: number, amount: string, qtyUnit: string, leverage: number) {
  if (!entryTime) return null
  const entry = new Date(entryTime)
  const now = new Date()
  const hoursDiff = (now.getTime() - entry.getTime()) / 3600000
  const fundingRate = -0.0002
  const fundingCount = Math.floor(hoursDiff / 8)
  const price = parseFloat(entryPrice) || currentPrice
  const rawAmount = parseFloat(amount) || 0
  const margin = qtyUnit === 'USDT' ? rawAmount : rawAmount * price
  const positionSize = margin * leverage
  const fundingFee = positionSize * fundingRate * fundingCount
  return { fundingCount, fundingFee, hoursDiff }
}

// Slippage estimator for limit orders (5자리 정밀도)
function getSlippageEstimate(entryPrice: string, orderType: string, volatileMode: boolean) {
  if (!entryPrice || orderType !== 'Limit') return null
  const price = parseFloat(entryPrice)
  if (!price) return null
  const min = volatileMode ? 0.0008 : 0.00015
  const max = volatileMode ? 0.0015 : 0.00025
  const rate = min + Math.random() * (max - min) + (Math.random() - 0.5) * 0.00002
  const slippage = price * Math.max(0, rate)
  return { slippage, effectivePrice: price + slippage }
}

export default function OrderForm({
  symbol, currentPrice, leverage,
  orderType, setOrderType, entryPrice, setEntryPrice,
  amount, setAmount, takeProfit, setTakeProfit, stopLoss, setStopLoss,
  showTPSL, setShowTPSL, entryTime, setEntryTime,
  sliderValue, setSliderValue, qtyUnit, setQtyUnit,
  volatileMode, setVolatileMode,
  enableSlippage, setEnableSlippage,
}: OrderFormProps) {
  const base = symbol.replace('USDT', '')
  const [showQtyDropdown, setShowQtyDropdown] = useState(false)
  const priceMatchRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [priceMatches, setPriceMatches] = useState<Array<{ time: string; timestamp: number }>>([])
  const [showMatchList, setShowMatchList] = useState(false)
  // 2-step time picker state (Step1: 날짜, Step2: 시간)
  const [selDate, setSelDate] = useState<string | null>(null)

  // Parse match time string to components
  const parseMatchTime = (t: string) => {
    const [datePart, timePart] = t.split('T')
    const [y, mo, d] = datePart.split('-').map(Number)
    const [h, mi] = timePart.split(':').map(Number)
    return { year: y, month: mo, day: d, hour: h, minute: mi }
  }

  // entryPrice 변경 시 가격 도달 이력 검색 — 서버 API 1회 호출 (Limit 모드만)
  useEffect(() => {
    if (orderType !== 'Limit') return
    const price = parseFloat(entryPrice)
    if (!price || price <= 0) {
      setPriceMatches([])
      setShowMatchList(false)
      return
    }
    // Reset selection
    setSelDate(null)

    if (priceMatchRef.current) clearTimeout(priceMatchRef.current)
    priceMatchRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/price-touches?symbol=${encodeURIComponent(symbol)}&price=${price}&searchDays=180`
        )
        if (!res.ok) throw new Error(`API ${res.status}`)
        const data: { matches: Array<{ time: string; timestamp: number }>; incomplete?: boolean } = await res.json()
        setPriceMatches(data.matches)
        setShowMatchList(true)
      } catch {
        setPriceMatches([])
        setShowMatchList(false)
      }
    }, 500)

    return () => {
      if (priceMatchRef.current) clearTimeout(priceMatchRef.current)
    }
  }, [entryPrice, symbol, orderType])

  // Auto-select: 매치가 1개뿐이면 자동 선택
  useEffect(() => {
    if (priceMatches.length === 0) return
    if (priceMatches.length === 1) {
      const match = priceMatches[0]
      setEntryTime(match.time)
      setShowMatchList(false)
      setSelDate(null)
      return
    }
    // 날짜가 1개뿐이면 자동 선택 후 시간 목록 대기
    const dates = [...new Set(priceMatches.map(m => m.time.split('T')[0]))]
    if (dates.length === 1 && selDate === null) {
      setSelDate(dates[0])
    }
  }, [priceMatches, selDate, setEntryTime])

  useEffect(() => {
    if (currentPrice) {
      if (orderType === 'Market') {
        setEntryPrice(String(currentPrice))
        // 시장가: 진입시간을 현재 시간으로 고정
        const now = new Date()
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
        setEntryTime(now.toISOString().slice(0, 16))
      } else if (!entryPrice) {
        // Limit 주문 시에도 현재가로 초기값 세팅
        setEntryPrice(String(currentPrice))
      }
    }
  }, [orderType, currentPrice, setEntryPrice, setEntryTime])

  const applyLastPrice = () => {
    if (currentPrice) setEntryPrice(String(currentPrice))
  }

  const handleSlider = (pct: number) => {
    setSliderValue(pct)
    const price = parseFloat(entryPrice) || currentPrice
    if (price <= 0) return
    // 슬라이더 = 최대 증거금 기준
    const maxMargin = MAX_MARGIN_USDT
    const marginForPct = (maxMargin * pct) / 100
    if (qtyUnit === 'USDT') {
      setAmount(marginForPct > 0 ? marginForPct.toFixed(2) : '')
    } else {
      const coinAmount = marginForPct / price
      setAmount(coinAmount > 0 ? coinAmount.toFixed(6) : '')
    }
  }

  const fundingInfo = getFundingInfo(entryTime, entryPrice, currentPrice, amount, qtyUnit, leverage)
  const slippageEstimate = getSlippageEstimate(entryPrice, orderType, volatileMode)

  return (
    <>
      {/* Order type tabs */}
      <div className="flex items-center gap-4 px-3 py-2 border-b border-binance-border">
        {(['Limit', 'Market'] as const).map(type => (
          <button
            key={type}
            onClick={() => setOrderType(type)}
            className={`text-xs transition-colors ${
              orderType === type ? 'text-white font-medium' : 'text-binance-text-dim hover:text-binance-text'
            }`}
          >
            {type === 'Limit' ? '지정가' : '시장가'}
          </button>
        ))}
        <span className="ml-auto text-binance-text-dim cursor-pointer text-xs">&#9432;</span>
      </div>

      <div className="flex-1 flex flex-col px-3 py-1.5 gap-1.5 overflow-y-auto">
        {/* Max position info */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-binance-text-dim">최대 증거금:</span>
          <span className="text-xs text-binance-text">{MAX_MARGIN_USDT.toLocaleString()} USDT</span>
        </div>

        {/* Price */}
        {orderType === 'Limit' ? (
          <div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-binance-text-dim shrink-0" style={{ width: 68 }}>가격 (USDT)</label>
              <div className="relative flex-1">
                <input
                  type="number"
                  step="any"
                  value={entryPrice}
                  onChange={e => setEntryPrice(e.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} pr-14`}
                  required
                />
                <button
                  type="button"
                  onClick={applyLastPrice}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-binance-yellow hover:text-binance-yellow/80 font-medium z-10"
                >
                  Last
                </button>
              </div>
            </div>
            {slippageEstimate && (
              <div className="mt-1 text-[10px] text-binance-text-dim bg-binance-bg rounded px-2 py-1 flex items-center justify-between">
                <label className="flex items-center gap-1 cursor-pointer shrink-0">
                  <input
                    type="checkbox"
                    checked={volatileMode}
                    onChange={e => setVolatileMode(e.target.checked)}
                    className="w-3 h-3 rounded border-binance-border accent-binance-yellow"
                  />
                  <span className="text-binance-text-dim">급등락 타점</span>
                </label>
                <span>
                  예상 슬리피지: <span className="text-binance-yellow font-mono">~{slippageEstimate.slippage.toFixed(4)}</span>
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <label className="text-xs text-binance-text-dim shrink-0" style={{ width: 68 }}>가격 (USDT)</label>
            <div className="flex-1">
              <div className={`${inputClass} flex items-center text-binance-text-dim`}>시장가</div>
            </div>
          </div>
        )}

        {/* Quantity */}
        <div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-binance-text-dim shrink-0" style={{ width: 68 }}>수량 (증거금)</label>
            <div className="relative flex-1">
              <input
                type="number"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="0.00"
                className={`${inputClass} pr-20`}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                <button
                  onClick={() => setShowQtyDropdown(!showQtyDropdown)}
                  className="flex items-center gap-1 text-xs text-binance-text"
                >
                  {qtyUnit} <span className="text-[10px] text-binance-text-dim">&#9662;</span>
                </button>
                {showQtyDropdown && (
                  <div className="absolute top-full right-0 mt-1 bg-binance-card border border-binance-border rounded shadow-xl z-50 w-20">
                    {[base, 'USDT'].map(u => (
                      <button
                        key={u}
                        onClick={() => { setQtyUnit(u); setShowQtyDropdown(false) }}
                        className={`w-full text-left px-2 py-1.5 text-xs hover:bg-binance-border/50 ${
                          qtyUnit === u ? 'text-binance-yellow' : 'text-binance-text'
                        }`}
                      >
                        {u}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          {/* 증거금 환산 */}
          <span className="text-[10px] text-binance-text-dim mt-0.5 block" style={{ paddingLeft: 70 }}>
            = {amount && entryPrice
              ? qtyUnit === 'USDT'
                ? `${(parseFloat(amount) / parseFloat(entryPrice || '1')).toFixed(6)} ${base}`
                : `${formatNumber(parseFloat(amount) * parseFloat(entryPrice || '1'))} USDT`
              : qtyUnit === 'USDT' ? `0.000000 ${base}` : '0.00 USDT'}
          </span>
          {/* 포지션 크기 = 수량 × 배율 */}
          {amount && parseFloat(amount) > 0 && (
            <span className="text-[10px] text-binance-yellow mt-0.5 block font-mono" style={{ paddingLeft: 70 }}>
              포지션 크기: {(() => {
                const raw = parseFloat(amount)
                const price = parseFloat(entryPrice || '1')
                const margin = qtyUnit === 'USDT' ? raw : raw * price
                const posSize = margin * leverage
                return `${formatNumber(posSize)} USDT (${(posSize / price).toFixed(6)} ${base})`
              })()}
            </span>
          )}
        </div>

        {/* Percentage slider */}
        <div>
          <div className="flex items-center justify-between mb-0.5">
            <span className="text-[10px] text-binance-text-dim">포지션 비중</span>
            <span className="text-[10px] text-binance-yellow font-mono">{sliderValue}%</span>
          </div>
          <input
            type="range"
            min="0" max="100" step="1"
            value={sliderValue}
            onChange={e => handleSlider(parseInt(e.target.value))}
            className="w-full h-1 bg-binance-border rounded-lg appearance-none cursor-pointer accent-binance-yellow"
          />
          <div className="flex justify-between text-xs text-binance-text-dim mt-1">
            {[0, 25, 50, 75, 100].map(pct => (
              <span
                key={pct}
                className={`cursor-pointer hover:text-binance-yellow transition-colors ${sliderValue === pct ? 'text-binance-yellow' : ''}`}
                onClick={() => handleSlider(pct)}
              >
                {pct}%
              </span>
            ))}
          </div>
        </div>

        {/* TP/SL toggle + Slippage toggle */}
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showTPSL}
              onChange={e => setShowTPSL(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-binance-border accent-binance-yellow"
            />
            <span className="text-xs text-binance-text-dim">TP/SL</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={enableSlippage}
              onChange={e => setEnableSlippage(e.target.checked)}
              className="w-3.5 h-3.5 rounded border-binance-border accent-binance-yellow"
            />
            <span className="text-xs text-binance-text-dim">슬리피지</span>
          </label>
        </div>

        {showTPSL && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-binance-green mb-1 block">Take Profit</label>
              <input
                type="number" step="any"
                value={takeProfit}
                onChange={e => setTakeProfit(e.target.value)}
                placeholder="TP Price"
                className={inputClass}
              />
            </div>
            <div>
              <label className="text-xs text-binance-red mb-1 block">Stop Loss</label>
              <input
                type="number" step="any"
                value={stopLoss}
                onChange={e => setStopLoss(e.target.value)}
                placeholder="SL Price"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* Entry Time */}
        <div>
          <label className="text-xs text-binance-text-dim mb-0.5 block">
            진입 시간 {orderType === 'Limit' && <span className="text-[10px] text-binance-yellow">(가격 도달 시각 선택)</span>}
          </label>
          {entryTime && (
            <div className="text-sm text-binance-text mb-1">{entryTime.replace('T', ' ')}</div>
          )}
          {/* 2-step time selector from price matches */}
          {showMatchList && orderType === 'Limit' && parseFloat(entryPrice) > 0 && (
            priceMatches.length > 0 ? (() => {
              // Step1: 유니크 날짜 목록 (최신순)
              const dates = [...new Set(priceMatches.map(m => m.time.split('T')[0]))].sort().reverse()
              // Step2: 선택된 날짜의 시:분 목록
              const timesForDate = selDate
                ? priceMatches
                    .filter(m => m.time.startsWith(selDate + 'T'))
                    .sort((a, b) => b.timestamp - a.timestamp)
                : []
              const dayNames = ['일', '월', '화', '수', '목', '금', '토']

              return (
                <div className="mt-1.5 bg-binance-bg border border-binance-border rounded p-2">
                  <div className="flex gap-2">
                    {/* Step1: 날짜 목록 */}
                    <div className="flex-1 min-w-0">
                      <div className="text-[9px] text-binance-text-dim mb-1">날짜 선택 ({dates.length}일)</div>
                      <div className="max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-binance-border">
                        {dates.map(d => {
                          const dt = new Date(d + 'T00:00:00')
                          const dayName = dayNames[dt.getDay()]
                          const isSelected = selDate === d
                          return (
                            <button
                              key={d}
                              onClick={() => setSelDate(isSelected ? null : d)}
                              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                                isSelected
                                  ? 'text-binance-yellow bg-binance-yellow/10'
                                  : 'hover:bg-binance-yellow/10 text-binance-text'
                              }`}
                            >
                              {d} ({dayName})
                            </button>
                          )
                        })}
                      </div>
                    </div>
                    {/* Step2: 시간 목록 */}
                    {selDate && (
                      <div className="flex-1 min-w-0">
                        <div className="text-[9px] text-binance-text-dim mb-1">시간 선택 ({timesForDate.length}개)</div>
                        <div className="max-h-[150px] overflow-y-auto scrollbar-thin scrollbar-thumb-binance-border">
                          {timesForDate.map(m => {
                            const timePart = m.time.split('T')[1]
                            return (
                              <button
                                key={m.timestamp}
                                onClick={() => {
                                  setEntryTime(m.time)
                                  setShowMatchList(false)
                                  setSelDate(null)
                                }}
                                className="w-full text-left px-3 py-2 text-xs text-binance-text hover:bg-binance-yellow/10 transition-colors"
                              >
                                {timePart}
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })() : (
              <div className="mt-1 text-[10px] text-binance-red bg-binance-bg border border-binance-border rounded px-2 py-1.5">
                해당 가격 도달 이력 없음
              </div>
            )
          )}
          {orderType === 'Market' && (
            <div className={`${inputClass} text-[11px] flex items-center text-binance-text-dim cursor-not-allowed`} style={{ opacity: 0.7 }}>
              🕐 현재 시간 (시장가 즉시 체결)
            </div>
          )}
          {fundingInfo && fundingInfo.hoursDiff > 0 && (
            <div className="mt-1 text-[10px] bg-binance-bg rounded px-2 py-1.5 space-y-0.5">
              <div className="flex justify-between">
                <span className="text-binance-text-dim">경과 시간</span>
                <span className="text-binance-text font-mono">{fundingInfo.hoursDiff.toFixed(1)}h</span>
              </div>
              <div className="flex justify-between">
                <span className="text-binance-text-dim">펀딩 횟수 (8시간)</span>
                <span className="text-binance-text font-mono">{fundingInfo.fundingCount}x</span>
              </div>
              <div className="flex justify-between">
                <span className="text-binance-text-dim">예상 펀딩비</span>
                <span className={`font-mono ${fundingInfo.fundingFee >= 0 ? 'text-binance-green' : 'text-binance-red'}`}>
                  {fundingInfo.fundingFee >= 0 ? '+' : ''}{fundingInfo.fundingFee.toFixed(4)} USDT
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
