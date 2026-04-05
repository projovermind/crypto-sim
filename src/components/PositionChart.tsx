'use client'

import { useEffect, useRef, useState } from 'react'
import { PositionWithLive, TimeInterval } from '@/types'
import { formatPrice } from '@/lib/calculations'

interface PositionChartProps {
  position: PositionWithLive
}

const INTERVALS: { value: TimeInterval; label: string }[] = [
  { value: '5m', label: '5분' },
  { value: '15m', label: '15분' },
  { value: '1h', label: '1시간' },
  { value: '4h', label: '4시간' },
  { value: '1d', label: '일봉' },
]

export default function PositionChart({ position }: PositionChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<any>(null)
  const [interval, setInterval_] = useState<TimeInterval>('1h')
  const [loading, setLoading] = useState(true)
  const [priceStats, setPriceStats] = useState<{ max: number; min: number; change: number } | null>(null)

  useEffect(() => {
    if (!chartContainerRef.current) return

    let isMounted = true

    const initChart = async () => {
      setLoading(true)

      // Calculate time range
      const entryTime = new Date(position.entryTime).getTime()
      const now = Date.now()
      const startTime = Math.min(entryTime, now)
      // Get enough candles before entry for context
      const contextBefore = entryTime - (24 * 60 * 60 * 1000) // 1 day before

      try {
        const res = await fetch(
          `/api/klines?symbol=${position.symbol}&interval=${interval}&limit=500&startTime=${contextBefore}`
        )
        const klines = await res.json()

        if (!isMounted || klines.length === 0) return

        // Dynamically import lightweight-charts
        const { createChart, CandlestickSeries, LineSeries } = await import('lightweight-charts')

        // Clear existing chart
        if (chartRef.current) {
          chartRef.current.remove()
          chartRef.current = null
        }

        const chart = createChart(chartContainerRef.current!, {
          layout: {
            background: { color: '#11141A' },
            textColor: '#818693',
            fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif',
          },
          grid: {
            vertLines: { color: '#202125' },
            horzLines: { color: '#202125' },
          },
          crosshair: {
            mode: 0,
            vertLine: { color: '#474D57', style: 2 },
            horzLine: { color: '#474D57', style: 2 },
          },
          rightPriceScale: {
            borderColor: '#303238',
            scaleMargins: { top: 0.1, bottom: 0.2 },
          },
          timeScale: {
            borderColor: '#303238',
            timeVisible: true,
            secondsVisible: false,
          },
          width: chartContainerRef.current!.clientWidth,
          height: chartContainerRef.current!.clientHeight || 400,
        })

        // Candlestick series
        const candleSeries = chart.addSeries(CandlestickSeries, {
          upColor: '#00BF75',
          downColor: '#FF3D55',
          borderUpColor: '#00BF75',
          borderDownColor: '#FF3D55',
          wickUpColor: '#00BF75',
          wickDownColor: '#FF3D55',
        })

        const candleData = klines.map((k: any) => ({
          time: k.time,
          open: k.open,
          high: k.high,
          low: k.low,
          close: k.close,
        }))

        candleSeries.setData(candleData)

        // Entry price line
        const entryLine = {
          price: position.entryPrice,
          color: position.side === 'LONG' ? '#00BF75' : '#FF3D55',
          lineWidth: 2 as const,
          lineStyle: 0 as const,
          axisLabelVisible: true,
          title: `진입: ${formatPrice(position.entryPrice)}`,
        }

        // TP line
        const tpLine = position.takeProfit ? {
          price: position.takeProfit,
          color: '#00BF75',
          lineWidth: 1 as const,
          lineStyle: 2 as const,
          axisLabelVisible: true,
          title: `TP: ${formatPrice(position.takeProfit)}`,
        } : null

        // SL line
        const slLine = position.stopLoss ? {
          price: position.stopLoss,
          color: '#FF3D55',
          lineWidth: 1 as const,
          lineStyle: 2 as const,
          axisLabelVisible: true,
          title: `SL: ${formatPrice(position.stopLoss)}`,
        } : null

        // Liquidation line
        const margin = (position.amount) / position.leverage
        const maintenanceRate = 0.005
        let liqPrice: number
        if (position.side === 'LONG') {
          liqPrice = position.entryPrice * (1 - (1 / position.leverage) + maintenanceRate)
        } else {
          liqPrice = position.entryPrice * (1 + (1 / position.leverage) - maintenanceRate)
        }
        const liqLine = {
          price: liqPrice,
          color: '#FF3D55',
          lineWidth: 1 as const,
          lineStyle: 1 as const,
          axisLabelVisible: true,
          title: `청산: ${formatPrice(liqPrice)}`,
        }

        candleSeries.createPriceLine(entryLine)
        if (tpLine) candleSeries.createPriceLine(tpLine)
        if (slLine) candleSeries.createPriceLine(slLine)
        if (position.leverage > 1) candleSeries.createPriceLine(liqLine)

        // Fit to visible range
        chart.timeScale().fitContent()

        chartRef.current = chart

        // Calculate stats
        const prices = klines.map((k: any) => k.close)
        const highs = klines.map((k: any) => k.high)
        const lows = klines.map((k: any) => k.low)
        setPriceStats({
          max: Math.max(...highs),
          min: Math.min(...lows),
          change: prices.length > 1 ? prices[prices.length - 1] - prices[0] : 0,
        })
      } catch (error) {
        console.error('Chart init error:', error)
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    initChart()

    // Resize handler
    const handleResize = () => {
      if (chartRef.current && chartContainerRef.current) {
        chartRef.current.applyOptions({
          width: chartContainerRef.current.clientWidth,
          height: chartContainerRef.current.clientHeight || 400,
        })
      }
    }

    window.addEventListener('resize', handleResize)

    return () => {
      isMounted = false
      window.removeEventListener('resize', handleResize)
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
      }
    }
  }, [position, interval])

  return (
    <div className="bg-binance-card flex flex-col h-full overflow-hidden">
      {/* Chart Header */}
      <div className="flex items-center justify-between p-4 border-b border-binance-border">
        <div className="flex items-center gap-3">
          <h3 className="font-bold text-binance-text">
            {position.symbol.replace('USDT', '')}/USDT
          </h3>
          <span className={`px-2 py-0.5 rounded text-xs font-bold ${
            position.side === 'LONG' ? 'bg-binance-green/10 text-binance-green' : 'bg-binance-red/10 text-binance-red'
          }`}>
            {position.side} {position.leverage}x
          </span>
        </div>

        {/* Interval Selector */}
        <div className="flex gap-1">
          {INTERVALS.map(iv => (
            <button
              key={iv.value}
              onClick={() => setInterval_(iv.value)}
              className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                interval === iv.value
                  ? 'bg-binance-yellow text-binance-bg'
                  : 'bg-binance-bg text-binance-text-dim hover:text-binance-text'
              }`}
            >
              {iv.label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Stats */}
      {priceStats && (
        <div className="flex items-center gap-6 px-4 py-2 bg-binance-bg/50 text-xs">
          <span className="text-binance-text-dim">
            최고: <span className="text-binance-green font-mono">{formatPrice(priceStats.max)}</span>
          </span>
          <span className="text-binance-text-dim">
            최저: <span className="text-binance-red font-mono">{formatPrice(priceStats.min)}</span>
          </span>
        </div>
      )}

      {/* Chart */}
      <div className="relative">
        {loading && (
          <div className="absolute inset-0 flex items-center justify-center bg-binance-card/80 z-10">
            <div className="flex items-center gap-2 text-binance-text-dim">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
              차트 로딩 중...
            </div>
          </div>
        )}
        <div ref={chartContainerRef} className="w-full flex-1" style={{ minHeight: 300 }} />
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 px-4 py-2 border-t border-binance-border text-xs text-binance-text-dim">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 inline-block" style={{ backgroundColor: position.side === 'LONG' ? '#00BF75' : '#FF3D55' }}></span>
          진입가
        </span>
        {position.takeProfit && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block border-b border-dashed border-binance-green"></span>
            TP
          </span>
        )}
        {position.stopLoss && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block border-b border-dashed border-binance-red"></span>
            SL
          </span>
        )}
        {position.leverage > 1 && (
          <span className="flex items-center gap-1">
            <span className="w-3 h-0.5 inline-block border-b border-dotted border-binance-red"></span>
            청산가
          </span>
        )}
      </div>
    </div>
  )
}
