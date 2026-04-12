'use client'

import { forwardRef } from 'react'
import { PositionWithLive } from '@/types'
import { formatPrice, formatNumber, calculatePnL } from '@/lib/calculations'

export interface ProfitCardProps {
  position: PositionWithLive
  bgIndex: number
  hideProfit: boolean
}

export const PROFIT_CARD_BACKGROUNDS = [
  { id: 'bg1', url: '/posters/bg1.png' },
  { id: 'bg2', url: '/posters/bg2.png' },
  { id: 'bg3', url: '/posters/bg3.png' },
]

// Tapbit candle icon (from their HTML base64)
const PERPETUAL_ICON = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACgAAAAoCAYAAACM/rhtAAAACXBIWXMAABYlAAAWJQFJUiTwAAAAAXNSR0IArs4c6QAAAARnQU1BAACxjwv8YQUAAAHmSURBVHgB7ZcxS8NAFMdfRCGgSEZdSscKFTuKiGQR6ib4BZzEQVwcHMW5i6OjiEPHjo6OHTt2DCLoGApCwCG+Ry/4cvWSS5q7iuQHjyTNvd4/9969uwOomQ8HLBLHsYeXc7QIre84zkeezxLYZRfNRfPEfS62BboF21sXWBgtgZg7LlpH5JBVljXbHaO16AZFPmByB2AJXYEb7F57FMWIewpfikqTt//tw3UFFgY79/HiZzRpCeM+VHYoQlHym8lJ4kNxKFIp0UYEVjmZrJSZw6MTWFndVFrw+qb0nclB/Hqq8HKV5yPSFfmVEKI96yxbZUiNoJhVXSGIG8eV3pHPKRhCDnHZ3HFNFXFlmQnDCVxd3ygdd7a34PLiDEyjFjgJ4fGpr3Q82N+zIvDPbxaMrSScTrud+d5bX1O+syKw17uFshgJMdZEqo0RlCPkDyZzcCB3lgN90Iu8ozEWYuxojJcx/w1rJe0rO+JxhG0Gef+jFNhsNODr8x0WTZUhLptzmcgCKSRF8iZhyDeZVZIKMXWCeXIP0w0APyJ22fMILWDvQpNnlJkcFCMhJ7cPPwIDbDMCS/yPc/EisS1wCNNJSGmklSZW1uIEcSy4K+JTh3hedAXyIlymkJuFDkS00IsjaU1NlXwDc0KDXXaFRUEAAAAASUVORK5CYII='

const ProfitCard = forwardRef<HTMLDivElement, ProfitCardProps>(
  ({ position, bgIndex, hideProfit }, ref) => {
    const symbol = position.symbol
    const pnlData = calculatePnL(
      position.side, position.entryPrice, position.currentPrice,
      position.leverage, position.amount, position.quantity, position.entryFee
    )
    const isProfit = pnlData.pnl >= 0
    const pnlColor = isProfit ? '#00ff85' : '#ff3d55'
    const sideColor = position.side === 'LONG' ? '#00ff85' : '#ff3d55'

    const now = new Date()
    const pad = (n: number) => n.toString().padStart(2, '0')
    const dateStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`

    const currentBg = PROFIT_CARD_BACKGROUNDS[bgIndex] ?? PROFIT_CARD_BACKGROUNDS[0]
    const bgStyle = {
      backgroundImage: `url(${currentBg.url})`,
      backgroundSize: 'cover' as const,
      backgroundPosition: 'center bottom',
      backgroundRepeat: 'no-repeat' as const,
      backgroundColor: 'rgb(2, 5, 13)',
    }

    return (
      <div
        ref={ref}
        className="relative overflow-hidden"
        style={{ ...bgStyle, width: 362, height: 500, borderRadius: 12, fontFamily: 'var(--font-inter), Inter, -apple-system, BlinkMacSystemFont, sans-serif' }}
      >
        {/* Header: 60px */}
        <div className="relative flex items-center" style={{ height: 60, padding: '0 20px' }}>
          <img src="/tapbit-logo.png" alt="TAPBIT" style={{ height: 20 }} />

          {/* Perpetual mark — exact Tapbit style with candle icon */}
          <div
            className="absolute flex items-center"
            style={{
              top: -1, right: -1, height: 38,
              padding: '0 20px',
              background: 'linear-gradient(90deg, transparent 0%, rgba(19,21,29,0.7) 20%, rgba(19,21,29,0.9) 100%)',
              color: '#888',
            }}
          >
            <img
              src={PERPETUAL_ICON}
              alt=""
              style={{ width: 20, height: 20, marginRight: 8 }}
            />
            <span style={{ height: 20, lineHeight: '20px', fontSize: 14, fontWeight: 600 }}>
              Perpetual
            </span>
          </div>

          {/* Bottom border */}
          <div className="absolute" style={{ left: 20, right: 20, bottom: 0, height: 1, background: '#1b1e25' }} />
        </div>

        {/* Symbol + Tags */}
        <div className="flex" style={{ padding: '12px 20px 20px' }}>
          <div className="flex items-center" style={{ fontSize: 14, fontWeight: 600, lineHeight: '18px' }}>
            <span style={{ color: '#fff' }}>{symbol}</span>
            <div className="flex">
              <div className="flex items-center">
                <i style={{ margin: '1px 12px', width: 1, height: 16, background: 'hsla(0,0%,100%,.2)', display: 'block' }} />
                <span style={{ color: sideColor }}>
                  {position.side === 'LONG' ? 'Long' : 'Short'}
                </span>
              </div>
              <div className="flex items-center">
                <i style={{ margin: '1px 12px', width: 1, height: 16, background: 'hsla(0,0%,100%,.2)', display: 'block' }} />
                <span style={{ color: '#fff' }}>{position.leverage}X</span>
              </div>
            </div>
          </div>
        </div>

        {/* ROE + PNL (vertical) */}
        <div style={{ margin: '0 20px' }}>
          <div className="flex flex-col">
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, lineHeight: '16px', color: '#fff', opacity: 0.8, marginBottom: 0 }}>ROE</div>
              <div style={{ fontSize: 44, lineHeight: '44px', color: pnlColor, fontWeight: 600 }}>
                {`${isProfit ? '+' : ''}${formatNumber(pnlData.roe)}%`}
              </div>
            </div>
            {!hideProfit && (
              <div style={{ marginBottom: 20 }}>
                <div style={{ fontSize: 12, lineHeight: '16px', color: '#fff', opacity: 0.8, marginBottom: 0 }}>PNL(USDT)</div>
                <div style={{ fontSize: 44, lineHeight: '44px', color: pnlColor, fontWeight: 600 }}>
                  {`${isProfit ? '+' : ''}${formatNumber(pnlData.pnl)}`}
                </div>
              </div>
            )}
          </div>
          {/* Entry Price */}
          <div style={{ fontSize: 12, lineHeight: '14px', color: '#fff', marginBottom: 6 }}>
            <span style={{ opacity: 0.8 }}>Entry Price: </span>
            <span style={{ fontWeight: 600 }}>{formatPrice(position.entryPrice)}</span>
          </div>
          {/* Last Price */}
          <div style={{ fontSize: 12, lineHeight: '14px', color: '#fff' }}>
            <span style={{ opacity: 0.8 }}>Last Price: </span>
            <span style={{ fontWeight: 600 }}>{formatPrice(position.currentPrice)}</span>
          </div>
        </div>

        {/* Timestamp */}
        <div className="absolute" style={{ bottom: 16, left: 20, fontSize: 12, lineHeight: '14px', color: '#94979e' }}>
          {dateStr}
        </div>
      </div>
    )
  }
)

ProfitCard.displayName = 'ProfitCard'
export default ProfitCard
