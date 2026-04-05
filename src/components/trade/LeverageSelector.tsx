'use client'

import { LEVERAGES } from '@/types'

interface LeverageSelectorProps {
  leverage: number
  setLeverage: (l: number) => void
  marginMode: 'CROSS' | 'ISOLATED'
  setMarginMode: (m: 'CROSS' | 'ISOLATED') => void
  showLeverage: boolean
  setShowLeverage: (v: boolean) => void
}

export default function LeverageSelector({
  leverage, setLeverage, marginMode, setMarginMode, showLeverage, setShowLeverage,
}: LeverageSelectorProps) {
  return (
    <div className="flex items-center justify-between px-3 py-1.5">
      <div className="flex items-center gap-0.5">
        {(['CROSS', 'ISOLATED'] as const).map(mode => (
          <button
            key={mode}
            onClick={() => setMarginMode(mode)}
            className={`px-2 py-1 rounded text-xs font-medium transition-all ${
              marginMode === mode
                ? 'bg-binance-yellow text-binance-bg'
                : 'text-binance-text-dim hover:text-binance-text'
            }`}
          >
            {mode === 'CROSS' ? 'Cross' : 'Isolated'}
          </button>
        ))}
      </div>
      <div className="relative">
        <button
          onClick={() => setShowLeverage(!showLeverage)}
          className="flex items-center gap-1.5"
        >
          <span className="text-xs font-bold text-binance-yellow">{leverage}X</span>
          <span className="text-binance-text-dim text-xs">&rsaquo;</span>
        </button>
        {showLeverage && (
          <div className="absolute top-full right-0 mt-1 bg-binance-card border border-binance-border rounded-lg shadow-xl z-50 p-2 w-48">
            <div className="flex flex-wrap gap-1">
              {LEVERAGES.map(l => (
                <button
                  key={l}
                  onClick={() => { setLeverage(l); setShowLeverage(false) }}
                  className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                    leverage === l
                      ? 'bg-binance-yellow text-binance-bg'
                      : 'bg-binance-bg text-binance-text-dim hover:text-binance-text border border-binance-border'
                  }`}
                >
                  {l}x
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
