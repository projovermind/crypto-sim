'use client'

import { useState } from 'react'
import { PositionWithLive } from '@/types'
import PositionRow from './PositionRow'
import SharePopup from '@/components/SharePopup'

interface PositionTableProps {
  positions: PositionWithLive[]
  onClose: (id: string, options?: number | { closeMargin?: number; closeQuantity?: number }) => void
  onEdit: (id: string, data: { takeProfit?: number | null; stopLoss?: number | null; leverage?: number }) => void
  onSelect: (position: PositionWithLive) => void
  selectedId?: string
  isPopup?: boolean
  onTeledditToggle?: (position: PositionWithLive, checked: boolean) => void
}

/*
 * 탭비트 방식: table-layout: fixed + colgroup으로 각 컬럼 정확한 px 지정
 * table width는 colgroup 합(1607px)으로 명시 — width: 100% 쓰면 비율 확대되어 간격 불균일
 * 모든 셀에 px-2(8px) 균일 패딩 → 컬럼 간 간격 = 16px로 완전 동일
 */
const COL_WIDTHS = [125, 200, 95, 85, 95, 190, 65, 95, 115, 310, 52, 140, 40]

const TABLE_HEADERS = (
  <thead>
    <tr className="text-binance-text-dim border-b border-binance-border" style={{ fontSize: 12 }}>
      <th className="text-left py-2.5 pl-3 pr-2 font-normal">Pair</th>
      <th className="text-left py-2.5 px-2 font-normal">Available/Holding</th>
      <th className="text-left py-2.5 px-2 font-normal">Entry Price</th>
      <th className="text-left py-2.5 px-2 font-normal">Margin</th>
      <th className="text-left py-2.5 px-2 font-normal">Mark Price</th>
      <th className="text-left py-2.5 px-2 font-normal underline decoration-dashed decoration-binance-text-dim underline-offset-4">Unrealized PNL (ROE)</th>
      <th className="text-left py-2.5 px-2 font-normal">Realized PNL</th>
      <th className="text-left py-2.5 px-2 font-normal">Liq. Price</th>
      <th className="text-left py-2.5 px-2 font-normal">Market</th>
      <th className="text-left py-2.5 px-2 font-normal">Operation</th>
      <th className="text-left py-2.5 px-2 font-normal">TP/SL</th>
      <th className="text-left py-2.5 px-2 font-normal">Position TP/SL</th>
      <th className="text-left py-2.5 px-2 font-normal">ADL</th>
    </tr>
  </thead>
)

export default function PositionTable({ positions, onClose, onEdit, onSelect, selectedId, isPopup = false, onTeledditToggle }: PositionTableProps) {
  const [hideOtherPairs, setHideOtherPairs] = useState(false)
  const [sharePosition, setSharePosition] = useState<PositionWithLive | null>(null)

  const openPositions = positions.filter(p => p.status === 'OPEN')

  const openInNewWindow = () => {
    window.open('/dashboard/positions', '_blank', 'width=1650,height=500,scrollbars=yes,resizable=no')
  }

  return (
    <div className="bg-binance-card border-t border-binance-border">
      {/* Header row */}
      <div className="flex items-center px-4 py-0 border-b border-binance-border max-w-[1607px] mx-auto">
        <span className="px-3 py-2 text-xs font-medium text-binance-text border-b-2 border-white">
          Positions ({openPositions.length})
        </span>
        {!isPopup && (
          <div className="ml-auto flex items-center gap-3">
            <button
              onClick={openInNewWindow}
              className="text-[10px] text-binance-text-dim hover:text-binance-text transition-colors"
              title="새창에서 보기"
            >
              &#x2197; 새창
            </button>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={hideOtherPairs}
                onChange={e => setHideOtherPairs(e.target.checked)}
                className="w-3 h-3 rounded border-binance-border accent-binance-yellow"
              />
              <span className="text-[10px] text-binance-text-dim">다른 페어 숨기기</span>
            </label>
            <span
              className="text-xs text-binance-red cursor-pointer hover:underline"
              onClick={() => { if (confirm('모든 포지션을 청산하시겠습니까?')) openPositions.forEach(p => onClose(p.id)) }}
            >
              전체 청산
            </span>
          </div>
        )}
      </div>

      {/* Position list */}
      <div className="overflow-x-auto px-2">
        {openPositions.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-binance-text-dim">
            열린 포지션 없음
          </div>
        ) : (
          <div>
            <table style={{ tableLayout: 'fixed', width: COL_WIDTHS.reduce((a, b) => a + b, 0), whiteSpace: 'nowrap', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
              <colgroup>
                {COL_WIDTHS.map((w, i) => (
                  <col key={i} style={{ width: w }} />
                ))}
              </colgroup>
              {TABLE_HEADERS}
              <tbody>
                {openPositions.map(p => (
                  <PositionRow
                    key={p.id}
                    position={p}
                    isSelected={selectedId === p.id}
                    onSelect={onSelect}
                    onClose={onClose}
                    onEdit={onEdit}
                    onShare={setSharePosition}
                    onTeledditToggle={onTeledditToggle}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {sharePosition && (
        <SharePopup position={sharePosition} onClose={() => setSharePosition(null)} />
      )}
    </div>
  )
}
