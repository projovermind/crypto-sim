'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Position, PositionWithLive } from '@/types'
import { usePriceStore, subscribeSymbols } from '@/lib/hooks'
import { calculatePnL, checkTPSL } from '@/lib/calculations'
import PositionTable from '@/components/position/PositionTable'

export default function PositionsPopupPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [positions, setPositions] = useState<Position[]>([])
  const [selectedId, setSelectedId] = useState<string | undefined>()
  const prices = usePriceStore(s => s.prices)
  const connect = usePriceStore(s => s.connect)
  const disconnect = usePriceStore(s => s.disconnect)

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

  const positionsWithLive: PositionWithLive[] = positions
    .filter(p => p.status === 'OPEN')
    .map(p => {
      const currentPrice = prices[p.symbol] || p.entryPrice
      const pnl = calculatePnL(p.side, p.entryPrice, currentPrice, p.leverage, p.amount, p.quantity)
      const tpsl = checkTPSL(p.side, p.entryPrice, currentPrice, p.takeProfit, p.stopLoss)
      return { ...p, currentPrice, pnlLive: pnl.pnl, roeLive: pnl.roe, liquidationPrice: pnl.liquidationPrice, hitTP: tpsl.hitTP, hitSL: tpsl.hitSL }
    })

  const handleClose = async (id: string, options?: number | { closeMargin?: number; closeQuantity?: number }) => {
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

  const handleReverse = async (id: string) => {
    try {
      const res = await fetch(`/api/positions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reverse' }),
      })
      if (res.ok) {
        fetchPositions()
      } else {
        const err = await res.json()
        alert(err.error || '리버스 실패')
      }
    } catch {}
  }

  if (status === 'loading') return null

  return (
    <div className="bg-binance-bg min-h-screen">
      <PositionTable
        positions={positionsWithLive}
        onClose={handleClose}
        onEdit={handleEdit}
        onSelect={(p) => setSelectedId(p.id)}
        selectedId={selectedId}
        isPopup
        onReverse={handleReverse}
      />
    </div>
  )
}
