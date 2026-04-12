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

  // ── 자동 캡처 ────────────────────────────────────────────────────────────────
  const [capturePos, setCapturePos] = useState<PositionWithLive | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const captureQueue  = useRef<PositionWithLive[]>([])
  const isCapturing   = useRef(false)        // 진행 중 여부 (ref → stale closure 방지)
  const processedIds  = useRef<Set<string>>(new Set()) // 세션 내 중복 방지
  const batchStarted  = useRef(false)        // 최초 1회만 배치 시작

  useEffect(() => { document.title = 'Tap PO(NEW)' }, [])
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

  // ── 헬퍼: 다음 캡처 시작 ─────────────────────────────────────────────────────
  const startNextCapture = useCallback(() => {
    const next = captureQueue.current.shift()
    if (next) {
      isCapturing.current = true
      setCapturePos(next)
    } else {
      isCapturing.current = false
      setCapturePos(null)
    }
  }, [])

  // ── 첫 positions 로드 시 배치 큐 구성 (1회만) ────────────────────────────────
  useEffect(() => {
    if (!session || positions.length === 0 || batchStarted.current) return

    const needCapture = positions.filter(
      p => p.status !== 'OPEN' && !p.deletedAt && !p.shareImageUrl
    )
    if (needCapture.length === 0) { batchStarted.current = true; return }

    console.log(`[ProfitCard] 배치 캡처 시작: ${needCapture.length}개`)
    batchStarted.current = true

    captureQueue.current = needCapture.map(p => ({
      ...p,
      currentPrice: p.closedPrice ?? p.entryPrice,
      pnlLive: p.pnl ?? 0,
      roeLive: 0,
      liquidationPrice: 0,
      hitTP: false,
      hitSL: false,
    }))
    needCapture.forEach(p => processedIds.current.add(p.id))

    startNextCapture()
  }, [positions, session, startNextCapture])

  // ── capturePos → 렌더 대기 → 캡처 → 업로드 → 다음 ───────────────────────────
  useEffect(() => {
    if (!capturePos) return
    let cancelled = false

    const doCapture = async () => {
      await document.fonts.ready
      await new Promise(r => setTimeout(r, 1000))
      if (cancelled || !cardRef.current) {
        console.warn('[ProfitCard] 캡처 취소됨:', capturePos.id, { cancelled, hasRef: !!cardRef.current })
        return
      }

      try {
        console.log('[ProfitCard] 캡처 중:', capturePos.id)
        const { toPng } = await import('html-to-image')
        const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true })
        const res = await fetch(`/api/profit-card/${capturePos.id}/image`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl }),
        })
        if (res.ok) {
          console.log('[ProfitCard] 업로드 완료:', capturePos.id)
        } else {
          const err = await res.text()
          console.error('[ProfitCard] 업로드 실패:', capturePos.id, res.status, err)
        }
      } catch (e) {
        console.error('[ProfitCard] 캡처 오류:', capturePos.id, e)
      } finally {
        if (!cancelled) startNextCapture()
      }
    }

    doCapture()
    return () => { cancelled = true }
  }, [capturePos, startNextCapture])

  const positionsWithLive: PositionWithLive[] = positions
    .filter(p => p.status === 'OPEN')
    .map(p => {
      const currentPrice = prices[p.symbol] || p.entryPrice
      const pnl = calculatePnL(p.side, p.entryPrice, currentPrice, p.leverage, p.amount, p.quantity)
      const tpsl = checkTPSL(p.side, p.entryPrice, currentPrice, p.takeProfit, p.stopLoss)
      return { ...p, currentPrice, pnlLive: pnl.pnl, roeLive: pnl.roe, liquidationPrice: pnl.liquidationPrice, hitTP: tpsl.hitTP, hitSL: tpsl.hitSL }
    })

  const handleClose = async (id: string, options?: number | { closeMargin?: number; closeQuantity?: number }) => {
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
        // 전체 종료 시 즉시 캡처 (중복 체크)
        if (!opts && posWithLive && !processedIds.current.has(id)) {
          processedIds.current.add(id)
          if (!isCapturing.current) {
            isCapturing.current = true
            setCapturePos(posWithLive)
          } else {
            captureQueue.current.push(posWithLive)
          }
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

      {/* 자동 캡처용 숨겨진 ProfitCard */}
      {capturePos && (
        <div style={{ position: 'fixed', top: '-9999px', left: '-9999px', pointerEvents: 'none', zIndex: -1 }}>
          <ProfitCard ref={cardRef} position={capturePos} bgIndex={0} hideProfit={true} />
        </div>
      )}
    </div>
  )
}
