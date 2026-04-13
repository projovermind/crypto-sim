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
  onMemoEdit?: (position: PositionWithLive, field: 'memo1' | 'memo2' | 'memo3') => void
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

export default function PositionTable({ positions, onClose, onEdit, onSelect, selectedId, isPopup = false, onTeledditToggle, onMemoEdit }: PositionTableProps) {
  const [hideOtherPairs, setHideOtherPairs] = useState(false)
  const [sharePosition, setSharePosition] = useState<PositionWithLive | null>(null)
  // unchecked 셋: 기본 체크 상태 → 해제된 것만 추적
  const [tdUnchecked, setTdUnchecked] = useState<Set<string>>(new Set())

  const openPositions = positions.filter(p => p.status === 'OPEN')

  const openInNewWindow = () => {
    window.open('/dashboard/positions', '_blank', 'width=1650,height=500,scrollbars=yes,resizable=no')
  }

  return (
    <div className="bg-binance-card border-t border-binance-border flex flex-nowrap overflow-hidden" style={{ width: '100%' }}>
      {/* Left: main table area */}
      <div style={{ width: 1607, flexShrink: 0 }}>
        {/* Header row */}
        <div className="flex items-center px-4 border-b border-binance-border" style={{ width: 1607, height: 37 }}>
          <span className="px-3 text-xs font-medium text-binance-text border-b-2 border-white">
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
        <div className={isPopup ? 'px-2' : 'overflow-x-auto'}>
          {openPositions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-binance-text-dim">
              열린 포지션 없음
            </div>
          ) : (
            <div>
              <table style={{ tableLayout: 'fixed', borderCollapse: 'collapse', width: COL_WIDTHS.reduce((a, b) => a + b, 0), whiteSpace: 'nowrap', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
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
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Right: Teledit sidebar (only in non-popup) */}
      {!isPopup && (
        <div className="border-l border-binance-border flex flex-col" style={{ flex: '1 1 0%', minWidth: 0, overflow: 'hidden' }}>
          {/* 1행: Teledit 라벨 — 컨트롤바와 동일 높이 */}
          <div className="flex items-center justify-center px-4 border-b border-binance-border" style={{ height: 37 }}>
            <span className="text-xs font-medium text-binance-text">Teledit</span>
          </div>
          {openPositions.length > 0 && (
            <>
              {/* 2행: 컬럼 헤더 */}
              <div className="flex items-center border-b border-binance-border" style={{ fontSize: 11, height: 39 }}>
                <div className="flex-1 text-center text-binance-text-dim border-r border-binance-border/50">포지션 자동입력</div>
                <div className="flex-1 text-center text-binance-text-dim">포지션 메모</div>
              </div>
              {/* 3행: 체크박스 | M1 M2 M3 — 구분선 */}
              {openPositions.map(p => (
                <div key={p.id} className="flex items-center border-b border-binance-border/50" style={{ height: 59 }}>
                  <div className="flex-1 flex items-center justify-center gap-1.5 border-r border-binance-border/50">
                    <input
                      type="checkbox"
                      checked={!tdUnchecked.has(p.id)}
                      onChange={() => {
                        setTdUnchecked(prev => {
                          const next = new Set(prev)
                          if (next.has(p.id)) {
                            next.delete(p.id)
                            onTeledditToggle?.(p, true)
                          } else {
                            next.add(p.id)
                            onTeledditToggle?.(p, false)
                          }
                          return next
                        })
                      }}
                      className="w-3.5 h-3.5 rounded border-binance-border accent-binance-yellow"
                    />
                    <span className="text-[11px] text-binance-text-dim truncate">#{p.positionNumber ?? '-'}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center gap-1">
                    {onMemoEdit && (['memo1', 'memo2', 'memo3'] as const).map(f => (
                      <button
                        key={f}
                        onClick={() => onMemoEdit(p, f)}
                        className={`text-[9px] px-1.5 py-1 rounded ${(p as any)[f] ? 'bg-binance-yellow/20 text-binance-yellow' : 'bg-binance-border/30 text-binance-text-dim'} hover:opacity-80`}
                        title={(p as any)[f] || `${f} 입력`}
                      >
                        {f.replace('memo', 'M')}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {sharePosition && (
        <SharePopup position={sharePosition} onClose={() => setSharePosition(null)} />
      )}
    </div>
  )
}
