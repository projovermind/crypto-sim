'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Position, PositionWithLive } from '@/types'
import { usePriceStore, subscribeSymbols } from '@/lib/hooks'
import { calculatePnL, checkTPSL } from '@/lib/calculations'
import PositionTable from '@/components/position/PositionTable'
import ProfitCard from '@/components/ProfitCard'

export default function PositionsPopupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [positions, setPositions] = useState<Position[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const prices = usePriceStore(s => s.prices)
  const connect = usePriceStore(s => s.connect)
  const disconnect = usePriceStore(s => s.disconnect)

  // ── 자동 캡처용 ──────────────────────────────────────────────────────────────
  const [capturePos, setCapturePos] = useState<PositionWithLive | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    document.title = 'Tap PO(NEW)'
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  useEffect(() => {
    connect()
    return () => { disconnect() }
  }, [connect, disconnect])

  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/positions')
      if (res.ok) setPositions(await res.json())
    } catch {}
  }, [])

  useEffect(() => {
    if (session) {
      fetchPositions()
      const interval = setInterval(fetchPositions, 10000)
      return () => clearInterval(interval)
    }
  }, [session, fetchPositions])

  useEffect(() => {
    const openSymbols = positions.filter(p => p.status === 'OPEN').map(p => p.symbol)
    if (openSymbols.length > 0) subscribeSymbols(openSymbols)
  }, [positions])

  // ── capturePos가 세팅되면 ProfitCard 렌더 후 자동 캡처 ───────────────────────
  useEffect(() => {
    if (!capturePos) return
    let cancelled = false

    const doCapture = async () => {
      // 배경 이미지/폰트 로드 대기
      await document.fonts.ready
      await new Promise(r => setTimeout(r, 800))
      if (cancelled || !cardRef.current) return

      try {
        const { toPng } = await import('html-to-image')
        const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
        await fetch(`/api/profit-card/${capturePos.id}/image`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl }),
        })
      } catch (e) {
        console.error('[ProfitCard] 자동 캡처 실패:', e)
      } finally {
        if (!cancelled) setCapturePos(null)
      }
    }

    doCapture()
    return () => { cancelled = true }
  }, [capturePos])

  const positionsWithLive: PositionWithLive[] = positions
    .filter(p => p.status === 'OPEN')
    .map(p => {
      const currentPrice = prices[p.symbol] || p.entryPrice
      const pnl = calculatePnL(p.side, p.entryPrice, currentPrice, p.leverage, p.amount, p.quantity)
      const tpsl = checkTPSL(p.side, p.entryPrice, currentPrice, p.takeProfit, p.stopLoss)
      return { ...p, currentPrice, pnlLive: pnl.pnl, roeLive: pnl.roe, liquidationPrice: pnl.liquidationPrice, hitTP: tpsl.hitTP, hitSL: tpsl.hitSL }
    })

  const handleClose = async (id: string, options?: number | { closeMargin?: number; closeQuantity?: number }) => {
    // 종료 전 현재 라이브 데이터 저장 (캡처용)
    const posWithLive = positionsWithLive.find(p => p.id === id)

    try {
      let res: Response
      const opts = typeof options === 'number' ? { closeMargin: options } : options
      if (opts && (opts.closeMargin != null || opts.closeQuantity != null)) {
        const body: Record<string, unknown> = { action: 'partialClose' }
        if (opts.closeQuantity != null) body.closeQuantity = opts.closeQuantity
        if (opts.closeMargin != null) body.closeMargin = opts.closeMargin
        res = await fetch(`/api/positions/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })
      } else {
        res = await fetch(`/api/positions/${id}`, { method: 'DELETE' })
      }
      if (res.ok) {
        fetchPositions()
        // 전체 종료일 때만 수익카드 자동 캡처
        if (!opts && posWithLive) {
          setCapturePos(posWithLive)
        }
      } else {
        const err = await res.json()
        alert(err.error || '청산 실패')
      }
    } catch {}
  }

  const handleEdit = async (id: string, data: { takeProfit?: number | null; stopLoss?: number | null; leverage?: number }) => {
    try {
      const res = await fetch(`/api/positions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (res.ok) fetchPositions()
    } catch {}
  }

  if (status === 'loading') return null

  return (
    <div className="bg-binance-bg min-h-screen min-w-[1607px] overflow-x-auto">
      <PositionTable
        positions={positionsWithLive}
        onClose={handleClose}
        onEdit={handleEdit}
        onSelect={(p) => setSelectedId(p.id)}
        selectedId={selectedId}
        isPopup
      />

      {/* 자동 캡처용 숨겨진 ProfitCard — 화면 밖에 렌더링 */}
      {capturePos && (
        <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', pointerEvents: 'none', zIndex: -1 }}>
          <ProfitCard ref={cardRef} position={capturePos} bgIndex={0} hideProfit={false} />
        </div>
      )}
    </div>
  )
}
