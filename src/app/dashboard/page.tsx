'use client'

import { useState, useCallback } from 'react'
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
  const [memoModal, setMemoModal] = useState<{ posId: string; field: 'memo1' | 'memo2' | 'memo3'; value: string } | null>(null)

  const handleMemoEdit = useCallback((pos: any, field: 'memo1' | 'memo2' | 'memo3') => {
    setMemoModal({ posId: pos.id, field, value: pos[field] || '' })
  }, [])

  const handleMemoSave = useCallback(async () => {
    if (!memoModal) return
    try {
      await fetch(`/api/positions/${memoModal.posId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [memoModal.field]: memoModal.value }),
      })
      d.fetchPositions()
      setMemoModal(null)
    } catch { }
  }, [memoModal, d])

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
                onMemoEdit={handleMemoEdit}
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
            onMemoEdit={handleMemoEdit}
          />
        </div>
      </div>

      {d.sharePosition && (
        <SharePopup position={d.sharePosition} onClose={() => d.setSharePosition(null)} />
      )}

      {/* 메모 편집 모달 */}
      {memoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={() => setMemoModal(null)}>
          <div className="bg-binance-card rounded-lg p-4 w-80 shadow-xl" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-bold text-binance-text mb-2">
              {memoModal.field.replace('memo', '메모 ')} 편집
            </h3>
            <textarea
              className="w-full h-32 bg-binance-bg border border-binance-border rounded p-2 text-sm text-binance-text resize-none focus:outline-none focus:border-binance-yellow"
              value={memoModal.value}
              onChange={e => setMemoModal(prev => prev ? { ...prev, value: e.target.value } : null)}
              placeholder="메모를 입력하세요 (줄바꿈 가능)"
              autoFocus
            />
            <div className="flex justify-between mt-2">
              <button onClick={async () => {
                if (!memoModal) return
                await fetch(`/api/positions/${memoModal.posId}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ [memoModal.field]: '' }),
                })
                d.fetchPositions()
                setMemoModal(null)
              }} className="text-xs text-binance-red hover:text-binance-red/80 px-3 py-1">삭제</button>
              <div className="flex gap-2">
                <button onClick={() => setMemoModal(null)} className="text-xs text-binance-text-dim hover:text-binance-text px-3 py-1">취소</button>
                <button onClick={handleMemoSave} className="text-xs bg-binance-yellow text-black font-bold px-3 py-1 rounded hover:opacity-90">저장</button>
              </div>
            </div>
          </div>
        </div>
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
