'use client'

import { signOut } from 'next-auth/react'
import { useDashboard } from '@/hooks/useDashboard'
import NavBar from '@/components/NavBar'
import MarketHeader from '@/components/MarketHeader'
import TradePanel from '@/components/trade/TradePanel'
import PositionTable from '@/components/position/PositionTable'
import PositionHistory from '@/components/position/PositionHistory'
import SharePopup from '@/components/SharePopup'
import ProfitCard from '@/components/ProfitCard'

export default function DashboardPage() {
  const d = useDashboard()

  // Loading
  if (d.status === 'loading' || d.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-binance-bg">
        <div className="flex items-center gap-3 text-binance-text-dim">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          로딩 중...
        </div>
      </div>
    )
  }

  if (!d.session) return null

  return (
    <div className="h-screen flex flex-col bg-binance-bg overflow-auto" style={{ minHeight: 600 }}>
      <NavBar
        session={d.session}
        onLogout={() => signOut({ callbackUrl: '/login' })}
      />

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
        <div className="flex min-h-0 overflow-hidden flex-1">
          {/* Left: Trade Panel */}
          <div className="w-[360px] shrink-0 flex flex-col border-r border-binance-border overflow-y-auto">
            <TradePanel
              symbol={d.symbol}
              currentPrice={d.currentPrice}
              onSubmit={d.handleCreatePosition}
            />
          </div>

          {/* Right: MarketHeader + History */}
          <div className="flex-1 flex flex-col min-w-0">
            <MarketHeader symbol={d.symbol} onSymbolChange={d.handleSymbolChange} marketData={d.marketData} />
            <div className="flex-1 overflow-auto">
              <PositionHistory
                positions={d.positions}
                onEditHistory={d.handleEditHistory}
                onDeleteHistory={d.handleDeleteHistory}
                onDeleteAllHistory={d.handleDeleteAllHistory}
                onShareHistory={d.handleShareHistory}
                onTeledditToggle={d.handleTeledditToggle}
                onRefresh={d.fetchPositions}
              />
            </div>
          </div>
        </div>

        {/* Bottom: Current Positions */}
        <div className="overflow-hidden border-t border-binance-border" style={{ height: '40%' }}>
          <PositionTable
            positions={d.positionsWithLive}
            onClose={d.handleClosePosition}
            onEdit={d.handleEditPosition}
            onSelect={d.handleSelectPosition}
            selectedId={d.selectedPosition?.id}
            onTeledditToggle={d.handleTeledditToggle}
          />
        </div>
      </div>

      {d.sharePosition && (
        <SharePopup position={d.sharePosition} onClose={() => d.setSharePosition(null)} />
      )}

      {/* 자동 캡처용 숨겨진 ProfitCard */}
      {d.capturePos && (
        <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', pointerEvents: 'none', zIndex: -1 }}>
          <ProfitCard ref={d.cardRef} position={d.capturePos} bgIndex={0} hideProfit={true} />
        </div>
      )}
    </div>
  )
}
