'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { Position } from '@/types'
import { calculatePnL, formatPrice, formatPnL, formatNumber } from '@/lib/calculations'
import HistoryRow from './HistoryRow'

type SortKey = 'createdAt' | 'pnlAmount' | 'pnlPercent' | 'entryTime'
type SortDir = 'asc' | 'desc'
type Tab = 'history' | 'trash'

interface PositionHistoryProps {
  positions: Position[]
  onEditHistory: (id: string, data: {
    entryPrice?: number
    closedPrice?: number
    amount?: number
    leverage?: number
    entryTime?: string
    closedAt?: string
  }) => void
  onDeleteHistory: (ids: string[]) => void
  onDeleteAllHistory: () => void
  onShareHistory: (position: Position) => void
  onTeledditToggle?: (position: Position, checked: boolean) => void
  onMemoEdit?: (position: Position, field: 'memo1' | 'memo2' | 'memo3') => void
  onRefresh?: () => void
}

function getPnl(p: Position) {
  const cp = p.closedPrice || p.entryPrice
  return calculatePnL(p.side, p.entryPrice, cp, p.leverage, p.amount, p.quantity, p.entryFee)
}

function formatDateTime(dateStr: string | null) {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}

function daysUntilPurge(deletedAt: string): number {
  const deleted = new Date(deletedAt).getTime()
  const purgeAt = deleted + 7 * 24 * 60 * 60 * 1000
  return Math.max(0, Math.ceil((purgeAt - Date.now()) / (24 * 60 * 60 * 1000)))
}

export default function PositionHistory({ positions, onEditHistory, onDeleteHistory, onDeleteAllHistory, onShareHistory, onTeledditToggle, onMemoEdit, onRefresh }: PositionHistoryProps) {
  const [tab, setTab] = useState<Tab>('history')
  const [sortKey, setSortKey] = useState<SortKey>('createdAt')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [trashItems, setTrashItems] = useState<Position[]>([])
  const [trashLoading, setTrashLoading] = useState(false)

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const closedPositions = useMemo(() => {
    const filtered = positions.filter(p => p.status !== 'OPEN')
    const mul = sortDir === 'desc' ? -1 : 1

    return filtered.sort((a, b) => {
      switch (sortKey) {
        case 'createdAt': {
          const tA = new Date(a.createdAt).getTime()
          const tB = new Date(b.createdAt).getTime()
          return (tA - tB) * mul
        }
        case 'entryTime': {
          const tA = new Date(a.entryTime).getTime()
          const tB = new Date(b.entryTime).getTime()
          return (tA - tB) * mul
        }
        case 'pnlAmount': {
          const pA = getPnl(a).pnl
          const pB = getPnl(b).pnl
          return (pA - pB) * mul
        }
        case 'pnlPercent': {
          const rA = getPnl(a).roe
          const rB = getPnl(b).roe
          return (rA - rB) * mul
        }
        default:
          return 0
      }
    })
  }, [positions, sortKey, sortDir])

  // 휴지통 데이터 로드
  const fetchTrash = useCallback(async () => {
    setTrashLoading(true)
    try {
      const res = await fetch('/api/positions/trash')
      if (res.ok) setTrashItems(await res.json())
    } catch {}
    setTrashLoading(false)
  }, [])

  useEffect(() => {
    if (tab === 'trash') fetchTrash()
  }, [tab, fetchTrash])

  const handleRestore = async (id: string) => {
    const res = await fetch('/api/positions/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'restore', ids: [id] }),
    })
    if (res.ok) {
      fetchTrash()
      onRefresh?.()
    }
  }

  const handleEmptyTrash = async () => {
    if (!confirm(`휴지통의 ${trashItems.length}건을 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.`)) return
    const res = await fetch('/api/positions/trash', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'empty' }),
    })
    if (res.ok) setTrashItems([])
  }

  const handleDeleteOne = (id: string) => {
    onDeleteHistory([id])
  }

  const handleDeleteAll = () => {
    if (!confirm(`거래 내역 ${closedPositions.length}건을 모두 삭제하시겠습니까?`)) return
    onDeleteAllHistory()
  }

  const SortHeader = ({ label, sortKeyName, className }: { label: string; sortKeyName: SortKey; className?: string }) => {
    const active = sortKey === sortKeyName
    return (
      <th
        className={`text-left py-1.5 px-2 font-normal cursor-pointer select-none hover:text-binance-text transition-colors ${className || ''} ${active ? 'text-binance-yellow' : ''}`}
        onClick={() => toggleSort(sortKeyName)}
      >
        {label}
        {active && (
          <span className="ml-0.5 text-[9px]">{sortDir === 'desc' ? '▼' : '▲'}</span>
        )}
      </th>
    )
  }

  return (
    <div className="bg-binance-card border-t border-binance-border h-full overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
      <style>{`.pos-history-scroll::-webkit-scrollbar{display:none}`}</style>
      {/* Tabs + Actions */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-binance-border sticky top-0 bg-binance-card z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setTab('history')}
            className={`text-xs font-medium transition-colors ${
              tab === 'history' ? 'text-binance-text border-b-2 border-white pb-0.5' : 'text-binance-text-dim hover:text-binance-text'
            }`}
          >
            거래 내역 ({closedPositions.length})
          </button>
          <button
            onClick={() => setTab('trash')}
            className={`text-xs font-medium transition-colors ${
              tab === 'trash' ? 'text-binance-text border-b-2 border-white pb-0.5' : 'text-binance-text-dim hover:text-binance-text'
            }`}
          >
            휴지통 {trashItems.length > 0 && `(${trashItems.length})`}
          </button>
        </div>
        {tab === 'history' && closedPositions.length > 0 && (
          <button
            onClick={handleDeleteAll}
            className="text-[10px] text-binance-red hover:underline"
          >
            전체 삭제
          </button>
        )}
        {tab === 'trash' && trashItems.length > 0 && (
          <button
            onClick={handleEmptyTrash}
            className="text-[10px] text-binance-red hover:underline"
          >
            휴지통 비우기
          </button>
        )}
      </div>

      {/* Content */}
      <div>
        {tab === 'history' ? (
          /* 거래 내역 */
          closedPositions.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-binance-text-dim">
              거래 내역 없음
            </div>
          ) : (
            <table style={{ tableLayout: 'fixed', width: '100%', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
              <colgroup>
                <col style={{ width: '3.5%' }} />   {/* # */}
                <col style={{ width: '6%' }} />     {/* 생성 */}
                <col style={{ width: '5.5%' }} />   {/* 페어 */}
                <col style={{ width: '10%' }} />    {/* 진입가 */}
                <col style={{ width: '6%' }} />     {/* 청산가 */}
                <col style={{ width: '5%' }} />     {/* 수량 */}
                <col style={{ width: '3.5%' }} />   {/* 배율 */}
                <col style={{ width: '6%' }} />     {/* 규모 */}
                <col style={{ width: '9%' }} />     {/* 손익 */}
                <col style={{ width: '6%' }} />     {/* 진입시간 */}
                <col style={{ width: '20%' }} />    {/* 청산시간 */}
                <col style={{ width: '10.5%' }} />  {/* 포지션 관리 */}
                <col style={{ width: '9%' }} />     {/* Teledit */}
              </colgroup>
              <thead>
                <tr className="text-binance-text-dim border-b border-binance-border" style={{ fontSize: 12 }}>
                  <th className="text-left py-1.5 pl-3 pr-1 font-normal">#</th>
                  <SortHeader label="생성" sortKeyName="createdAt" className="pl-1 pr-1" />
                  <th className="text-left py-1.5 px-1 font-normal">페어</th>
                  <th className="text-left py-1.5 px-1 font-normal">진입가(입력/체결)</th>
                  <th className="text-left py-1.5 px-1 font-normal">청산가</th>
                  <th className="text-left py-1.5 px-2 font-normal">수량</th>
                  <th className="text-left py-1.5 px-2 font-normal">배율</th>
                  <th className="text-left py-1.5 px-2 font-normal">규모</th>
                  <SortHeader label="손익" sortKeyName="pnlAmount" />
                  <SortHeader label="진입" sortKeyName="entryTime" />
                  <th className="text-left py-1.5 px-1 font-normal">청산</th>
                  <th className="text-right py-1.5 pr-1 font-normal">포지션 관리</th>
                  <th className="text-center py-1.5 pr-3 font-normal">Teledit</th>
                </tr>
              </thead>
              <tbody>
                {closedPositions.map(p => (
                  <HistoryRow
                    key={p.id}
                    position={p}
                    onEditHistory={onEditHistory}
                    onDelete={handleDeleteOne}
                    onShare={onShareHistory}
                    onTeledditToggle={(_, checked) => {
                      onTeledditToggle?.(p, checked)
                    }}
                    onMemoEdit={onMemoEdit ? (_, field) => onMemoEdit(p, field) : undefined}
                  />
                ))}
              </tbody>
            </table>
          )
        ) : (
          /* 휴지통 */
          trashLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-binance-text-dim">
              로딩 중...
            </div>
          ) : trashItems.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-binance-text-dim">
              휴지통이 비어있습니다
            </div>
          ) : (
            <table style={{ tableLayout: 'fixed', width: '100%', fontSize: 12, fontFamily: 'Inter, sans-serif' }}>
              <colgroup>
                <col style={{ width: 90 }} />
                <col style={{ width: 115 }} />
                <col style={{ width: 85 }} />
                <col style={{ width: 65 }} />
                <col style={{ width: 50 }} />
                <col style={{ width: 70 }} />
                <col style={{ width: 100 }} />
                <col style={{ width: 90 }} />
                <col style={{ width: 100 }} />
              </colgroup>
              <thead>
                <tr className="text-binance-text-dim border-b border-binance-border" style={{ fontSize: 12 }}>
                  <th className="text-left py-1.5 pl-3 pr-2 font-normal">페어</th>
                  <th className="text-left py-1.5 px-2 font-normal">진입가(입력/체결)</th>
                  <th className="text-left py-1.5 px-2 font-normal">청산가</th>
                  <th className="text-left py-1.5 px-2 font-normal">수량(USDT)</th>
                  <th className="text-left py-1.5 px-2 font-normal">배율</th>
                  <th className="text-left py-1.5 px-2 font-normal">규모</th>
                  <th className="text-left py-1.5 px-2 font-normal">손익</th>
                  <th className="text-left py-1.5 px-2 font-normal">남은 기간</th>
                  <th className="text-left py-1.5 px-2 font-normal"></th>
                </tr>
              </thead>
              <tbody>
                {trashItems.map(p => {
                  const cp = p.closedPrice || p.entryPrice
                  const pnlData = calculatePnL(p.side, p.entryPrice, cp, p.leverage, p.amount, p.quantity, p.entryFee)
                  const pnlColor = pnlData.pnl >= 0 ? 'text-binance-green' : 'text-binance-red'
                  const sideColor = p.side === 'LONG' ? 'text-binance-green' : 'text-binance-red'
                  const base = p.symbol.replace('USDT', '')
                  const remaining = p.deletedAt ? daysUntilPurge(p.deletedAt) : 0

                  return (
                    <tr key={p.id} className="border-b border-binance-border/50 hover:bg-binance-border/20 transition-colors opacity-60">
                      <td className="py-2 pl-3 pr-2">
                        <div className="flex items-center gap-1">
                          <span className={`font-bold ${sideColor}`}>{p.side}</span>
                          <span className="text-binance-text font-bold">{base}</span>
                          <span className="text-binance-text-dim text-[11px]">{p.leverage}x</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-binance-text">{formatPrice(p.entryPrice)}</td>
                      <td className="py-2 px-2 text-binance-text">{formatPrice(cp)}</td>
                      <td className="py-2 px-2 text-binance-text">{formatNumber(p.amount / p.leverage)}</td>
                      <td className="py-2 px-2 text-binance-text">{p.leverage}x</td>
                      <td className="py-2 px-2 text-binance-text">{formatNumber(p.amount)}</td>
                      <td className="py-2 px-2">
                        <div className="flex flex-col" style={{ lineHeight: '16px' }}>
                          <span className={pnlColor} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 12 }}>{formatPnL(pnlData.pnl)}</span>
                          <span className={pnlColor} style={{ fontVariantNumeric: 'tabular-nums', fontSize: 11 }}>({formatNumber(pnlData.roe)}%)</span>
                        </div>
                      </td>
                      <td className="py-2 px-2 text-[11px] text-binance-text-dim">
                        {remaining}일 후 삭제
                      </td>
                      <td className="py-1 px-2">
                        <button
                          onClick={() => handleRestore(p.id)}
                          className="px-2.5 py-1 text-[12px] text-binance-yellow hover:bg-binance-yellow/10 rounded font-medium"
                        >
                          복원
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  )
}
