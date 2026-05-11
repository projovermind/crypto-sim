'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import LeverageSelector from './LeverageSelector'
import OrderForm from './OrderForm'
import TradeButtons from './TradeButtons'

const MAX_MARGIN_USDT = 25000
const SETTINGS_KEY_PREFIX = 'tappo_trade_'

interface TradePanelProps {
  symbol: string
  currentPrice: number
  onSubmit: (data: any) => Promise<void>
}

export default function TradePanel({ symbol, currentPrice, onSubmit }: TradePanelProps) {
  const { data: session } = useSession()
  const [leverage, setLeverage] = useState(10)
  const [marginMode, setMarginMode] = useState<'CROSS' | 'ISOLATED'>('ISOLATED')
  const [showLeverage, setShowLeverage] = useState(false)
  const [activeTab, setActiveTab] = useState<'open' | 'close'>('open')
  const [orderType, setOrderType] = useState<'Limit' | 'Market'>('Market')
  const [entryPrice, setEntryPrice] = useState('')
  const [amount, setAmount] = useState('')
  const [takeProfit, setTakeProfit] = useState('')
  const [stopLoss, setStopLoss] = useState('')
  const [showTPSL, setShowTPSL] = useState(false)
  const [loading, setLoading] = useState(false)
  const [sliderValue, setSliderValue] = useState(0)
  const [qtyUnit, setQtyUnit] = useState<string>('USDT')
  const [entryTime, setEntryTime] = useState('')
  const [volatileMode, setVolatileMode] = useState(false)
  const [enableSlippage, setEnableSlippage] = useState(true)
  const [settingsLoaded, setSettingsLoaded] = useState(false)

  const userId = (session?.user as any)?.id
  const settingsKey = userId ? `${SETTINGS_KEY_PREFIX}${userId}` : null

  // Load saved settings on mount (per user)
  useEffect(() => {
    if (!settingsKey) return
    try {
      const saved = localStorage.getItem(settingsKey)
      if (saved) {
        const s = JSON.parse(saved)
        if (s.leverage) setLeverage(s.leverage)
        if (s.marginMode) setMarginMode(s.marginMode)
      }
    } catch {}
    setSettingsLoaded(true)
  }, [settingsKey])

  // Save settings on change
  useEffect(() => {
    if (!settingsKey || !settingsLoaded) return
    try {
      localStorage.setItem(settingsKey, JSON.stringify({ leverage, marginMode }))
    } catch {}
  }, [leverage, marginMode, settingsKey, settingsLoaded])

  const base = symbol.replace('USDT', '')

  useEffect(() => {
    setQtyUnit('USDT')
  }, [base])

  useEffect(() => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    setEntryTime(now.toISOString().slice(0, 16))
  }, [])

  const handleSubmit = async (submitSide: 'LONG' | 'SHORT') => {
    setLoading(true)
    try {
      const price = orderType === 'Market' ? currentPrice : parseFloat(entryPrice)
      if (!price || isNaN(price) || price <= 0) {
        alert('유효한 가격을 입력해주세요.')
        return
      }
      const rawAmount = parseFloat(amount)
      if (!rawAmount || isNaN(rawAmount) || rawAmount <= 0) {
        alert('유효한 수량을 입력해주세요.')
        return
      }
      // 입력값 = 증거금(마진), 포지션 크기 = 증거금 × 레버리지
      const margin = qtyUnit === 'USDT' ? rawAmount : rawAmount * price
      const positionSize = margin * leverage
      if (margin > MAX_MARGIN_USDT) {
        alert(`최대 증거금은 25,000 USDT입니다.`)
        return
      }
      await onSubmit({
        symbol,
        side: submitSide,
        leverage,
        marginMode,
        entryPrice: price,
        amount: positionSize,
        orderType: orderType === 'Market' ? 'MARKET' : 'LIMIT',
        takeProfit: takeProfit ? parseFloat(takeProfit) : null,
        stopLoss: stopLoss ? parseFloat(stopLoss) : null,
        entryTime: orderType === 'Market' ? new Date().toISOString() : (entryTime ? new Date(entryTime).toISOString() : new Date().toISOString()),
        volatileMode,
        enableSlippage,
      })
      setAmount('')
      setTakeProfit('')
      setStopLoss('')
      setSliderValue(0)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-binance-card">
      {/* Leverage */}
      <LeverageSelector
        leverage={leverage} setLeverage={setLeverage}
        marginMode={marginMode} setMarginMode={setMarginMode}
        showLeverage={showLeverage} setShowLeverage={setShowLeverage}
      />

      {/* Open / Close tabs */}
      <div className="px-3 pb-1">
        <div className="flex rounded-md p-0.5 h-8" style={{ backgroundColor: '#202125', borderRadius: '6px' }}>
          {(['open', 'close'] as const).map(t => (
            <button
              key={t}
              onClick={() => setActiveTab(t)}
              className={`flex-1 h-7 rounded text-sm font-medium transition-colors ${
                activeTab === t ? 'text-white' : 'text-binance-text-dim'
              }`}
              style={activeTab === t ? { backgroundColor: '#40434A', borderRadius: '4px' } : {}}
            >
              {t === 'open' ? '개설' : '청산'}
            </button>
          ))}
        </div>
      </div>

      {/* Order Form */}
      <OrderForm
        symbol={symbol} currentPrice={currentPrice}
        leverage={leverage}
        orderType={orderType} setOrderType={setOrderType}
        entryPrice={entryPrice} setEntryPrice={setEntryPrice}
        amount={amount} setAmount={setAmount}
        takeProfit={takeProfit} setTakeProfit={setTakeProfit}
        stopLoss={stopLoss} setStopLoss={setStopLoss}
        showTPSL={showTPSL} setShowTPSL={setShowTPSL}
        entryTime={entryTime} setEntryTime={setEntryTime}
        sliderValue={sliderValue} setSliderValue={setSliderValue}
        qtyUnit={qtyUnit} setQtyUnit={setQtyUnit}
        volatileMode={volatileMode} setVolatileMode={setVolatileMode}
        enableSlippage={enableSlippage} setEnableSlippage={setEnableSlippage}
      />

      {/* Trade Buttons + Cost */}
      <TradeButtons
        symbol={symbol} loading={loading}
        amount={amount} entryPrice={entryPrice}
        qtyUnit={qtyUnit} leverage={leverage} onSubmit={handleSubmit}
      />
    </div>
  )
}
