import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PositionWithLive, Position } from '@/types'
import { usePriceStore, subscribeSymbols } from '@/lib/hooks'
import { calculatePnL, checkTPSL } from '@/lib/calculations'
import { entrySound, closeSound } from '@/lib/sounds'

const DEFAULT_TEMPLATE = '🟢 {{symbol}} {{side}} {{leverage}}x | 진입 ${{entryPrice}}'

export { DEFAULT_TEMPLATE }

export function applyTemplate(template: string, position: PositionWithLive | Position): string {
  return template
    .replace(/\{\{symbol\}\}/g, position.symbol)
    .replace(/\{\{side\}\}/g, position.side)
    .replace(/\{\{leverage\}\}/g, String(position.leverage))
    .replace(/\{\{entryPrice\}\}/g, String(position.entryPrice))
    .replace(/\{\{amount\}\}/g, String(position.amount))
    .replace(/\{\{pnl\}\}/g, position.pnl != null ? position.pnl.toFixed(2) : 'N/A')
}

export interface UseDashboardReturn {
  // Session & routing
  session: ReturnType<typeof useSession>['data']
  status: ReturnType<typeof useSession>['status']

  // State
  positions: Position[]
  symbol: string
  selectedPosition: PositionWithLive | null
  loading: boolean
  marketData: any
  sharePosition: PositionWithLive | null
  teledditTemplate: string
  showSettings: boolean
  templateInput: string
  savingTemplate: boolean
  currentPw: string
  newPw: string
  newPwConfirm: string
  pwMsg: string
  savingPw: boolean

  // Computed
  positionsWithLive: PositionWithLive[]
  currentPrice: number

  // State setters (for settings modal)
  setShowSettings: (v: boolean) => void
  setTemplateInput: (v: string) => void
  setCurrentPw: (v: string) => void
  setNewPw: (v: string) => void
  setNewPwConfirm: (v: string) => void

  // Handlers
  fetchPositions: () => Promise<void>
  handleCreatePosition: (data: any) => Promise<void>
  handleClosePosition: (id: string, partialMargin?: number) => Promise<void>
  handleEditPosition: (id: string, data: { takeProfit?: number | null; stopLoss?: number | null }) => Promise<void>
  handleEditHistory: (id: string, data: { entryPrice?: number; closedPrice?: number; amount?: number; leverage?: number; entryTime?: string; closedAt?: string }) => Promise<void>
  handleDeleteHistory: (ids: string[]) => Promise<void>
  handleDeleteAllHistory: () => Promise<void>
  handleShareHistory: (position: Position) => void
  handleTeledditToggle: (position: PositionWithLive | Position, checked: boolean) => Promise<void>
  handleChangePassword: () => Promise<void>
  handleSaveTemplate: () => Promise<void>
  handleSelectPosition: (position: PositionWithLive) => void
  handleSymbolChange: (newSymbol: string) => void
  setSharePosition: (v: PositionWithLive | null) => void
}

export function useDashboard(): UseDashboardReturn {
  const { data: session, status } = useSession()
  const router = useRouter()

  // 15 useState
  const [positions, setPositions] = useState<Position[]>([])
  const [symbol, setSymbol] = useState('BTCUSDT')
  const [selectedPosition, setSelectedPosition] = useState<PositionWithLive | null>(null)
  const [loading, setLoading] = useState(true)
  const [marketData, setMarketData] = useState<any>(null)
  const [sharePosition, setSharePosition] = useState<PositionWithLive | null>(null)
  const [teledditTemplate, setTeledditTemplate] = useState(DEFAULT_TEMPLATE)
  const [showSettings, setShowSettings] = useState(false)
  const [templateInput, setTemplateInput] = useState(DEFAULT_TEMPLATE)
  const [savingTemplate, setSavingTemplate] = useState(false)
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  // Price store
  const prices = usePriceStore(s => s.prices)
  const connect = usePriceStore(s => s.connect)
  const disconnect = usePriceStore(s => s.disconnect)

  // ─── useEffect 1: Auth guard ────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // ─── useEffect 2: WebSocket connect ─────────────────────
  useEffect(() => {
    connect()
    return () => { disconnect() }
  }, [connect, disconnect])

  // ─── useEffect 3: Subscribe to selected symbol ──────────
  useEffect(() => {
    subscribeSymbols([symbol])
  }, [symbol])

  // ─── useEffect 4: Fetch market data ─────────────────────
  useEffect(() => {
    let isMounted = true
    const fetchMarket = async () => {
      try {
        const res = await fetch(`/api/price/${symbol}`)
        const data = await res.json()
        if (isMounted) setMarketData(data)
      } catch {}
    }
    fetchMarket()
    const interval = setInterval(fetchMarket, 5000)
    return () => { isMounted = false; clearInterval(interval) }
  }, [symbol])

  // ─── fetchPositions (callback) ──────────────────────────
  const fetchPositions = useCallback(async () => {
    try {
      const res = await fetch('/api/positions')
      if (res.ok) setPositions(await res.json())
    } catch (e) {
      console.error('Fetch positions error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  // ─── useEffect 5: Fetch positions on session ────────────
  useEffect(() => {
    if (session) fetchPositions()
  }, [session, fetchPositions])

  // ─── useEffect 6: Load account info (teledditTemplate) ──
  useEffect(() => {
    if (!session) return
    fetch('/api/account').then(r => r.ok ? r.json() : null).then(data => {
      if (data?.teledditTemplate) {
        setTeledditTemplate(data.teledditTemplate)
        setTemplateInput(data.teledditTemplate)
      }
    }).catch(() => {})
  }, [session])

  // ─── Subscribe to open position symbols ─────────────────
  useEffect(() => {
    const openSymbols = positions.filter(p => p.status === 'OPEN').map(p => p.symbol)
    if (openSymbols.length > 0) subscribeSymbols(openSymbols)
  }, [positions])

  // ─── Computed: positionsWithLive ────────────────────────
  const positionsWithLive: PositionWithLive[] = useMemo(() =>
    positions.map(p => {
      const currentPrice = prices[p.symbol] || p.entryPrice
      const pnl = calculatePnL(p.side, p.entryPrice, currentPrice, p.leverage, p.amount, p.quantity)
      const tpsl = checkTPSL(p.side, p.entryPrice, currentPrice, p.takeProfit, p.stopLoss)
      return {
        ...p,
        currentPrice,
        pnlLive: pnl.pnl,
        roeLive: pnl.roe,
        liquidationPrice: pnl.liquidationPrice,
        hitTP: tpsl.hitTP,
        hitSL: tpsl.hitSL,
      }
    }),
    [positions, prices]
  )

  // ─── Computed: currentPrice ─────────────────────────────
  const currentPrice = prices[symbol] || marketData?.price || 0

  // ─── Handler: change password ───────────────────────────
  const handleChangePassword = useCallback(async () => {
    setPwMsg('')
    if (!currentPw || !newPw) { setPwMsg('모든 필드를 입력해주세요.'); return }
    if (newPw.length < 4) { setPwMsg('새 비밀번호는 4자 이상이어야 합니다.'); return }
    if (newPw !== newPwConfirm) { setPwMsg('새 비밀번호가 일치하지 않습니다.'); return }
    setSavingPw(true)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword: currentPw, newPassword: newPw }),
      })
      const data = await res.json()
      if (res.ok) {
        setPwMsg('비밀번호가 변경되었습니다.')
        setCurrentPw(''); setNewPw(''); setNewPwConfirm('')
      } else {
        setPwMsg(data.error || '변경 실패')
      }
    } catch {
      setPwMsg('오류가 발생했습니다.')
    } finally {
      setSavingPw(false)
    }
  }, [currentPw, newPw, newPwConfirm])

  // ─── Handler: save template ─────────────────────────────
  const handleSaveTemplate = useCallback(async () => {
    setSavingTemplate(true)
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teledditTemplate: templateInput }),
      })
      if (!res.ok) throw new Error('저장 실패')
      setTeledditTemplate(templateInput)
      setShowSettings(false)
    } catch (err) {
      alert(`템플릿 저장 오류: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingTemplate(false)
    }
  }, [templateInput])

  // ─── Handler: create position ───────────────────────────
  const handleCreatePosition = useCallback(async (data: any) => {
    const res = await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      entrySound()
      fetchPositions()
    } else {
      const err = await res.json()
      alert(err.error || 'Position creation failed')
    }
  }, [fetchPositions])

  // ─── Handler: close position (전체/부분 익절) ────────────
  const handleClosePosition = useCallback(async (id: string, partialMargin?: number) => {
    let res: Response
    if (partialMargin != null && partialMargin > 0) {
      // 부분 익절: PATCH + action=partialClose
      res = await fetch(`/api/positions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'partialClose', closeMargin: partialMargin }),
      })
    } else {
      // 전체 청산: DELETE
      res = await fetch(`/api/positions/${id}`, { method: 'DELETE' })
    }
    if (res.ok) {
      closeSound()
      fetchPositions()
      setSelectedPosition(prev => prev?.id === id ? null : prev)
    } else {
      const err = await res.json()
      alert(err.error || '청산 실패')
    }
  }, [fetchPositions])

  // ─── Handler: edit position ─────────────────────────────
  const handleEditPosition = useCallback(async (id: string, data: { takeProfit?: number | null; stopLoss?: number | null }) => {
    const res = await fetch(`/api/positions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) fetchPositions()
  }, [fetchPositions])

  // ─── Handler: edit history ──────────────────────────────
  const handleEditHistory = useCallback(async (id: string, data: { entryPrice?: number; closedPrice?: number; amount?: number; leverage?: number; entryTime?: string; closedAt?: string }) => {
    const res = await fetch(`/api/positions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) fetchPositions()
  }, [fetchPositions])

  // ─── Handler: delete history ────────────────────────────
  const handleDeleteHistory = useCallback(async (ids: string[]) => {
    const res = await fetch('/api/positions/delete-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    if (res.ok) fetchPositions()
  }, [fetchPositions])

  // ─── Handler: delete all history ────────────────────────
  const handleDeleteAllHistory = useCallback(async () => {
    const res = await fetch('/api/positions/delete-history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ all: true }),
    })
    if (res.ok) fetchPositions()
  }, [fetchPositions])

  // ─── Handler: share history ─────────────────────────────
  const handleShareHistory = useCallback((position: Position) => {
    const cp = position.closedPrice || position.entryPrice
    setSharePosition({
      ...position,
      currentPrice: cp,
      pnlLive: 0,
      roeLive: 0,
      liquidationPrice: 0,
      hitTP: false,
      hitSL: false,
    })
  }, [])

  // ─── Handler: teleddit toggle ───────────────────────────
  const handleTeledditToggle = useCallback(async (position: PositionWithLive | Position, checked: boolean) => {
    const baseUrl = process.env.NEXT_PUBLIC_TELEDIT_API_URL
    if (!baseUrl) {
      alert('TELEDIT_API_URL이 설정되지 않았습니다.')
      return
    }

    try {
      const chRes = await fetch(`${baseUrl}/api/telegram/channels`)
      if (!chRes.ok) throw new Error('채널 목록 조회 실패')
      const channels = await chRes.json()
      const channelId = channels?.[0]?.id
      if (!channelId) throw new Error('연결된 텔레그램 채널이 없습니다.')

      if (checked) {
        const content = applyTemplate(teledditTemplate, position)
        const res = await fetch(`${baseUrl}/api/telegram/overrides`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'INSERT',
            channelId,
            content,
            senderName: 'CryptoSim',
            insertAt: position.entryTime,
            positionId: position.id,
          }),
        })
        if (!res.ok) throw new Error('Teledit INSERT 실패')
      } else {
        const res = await fetch(`${baseUrl}/api/telegram/overrides/${position.id}`, {
          method: 'DELETE',
        })
        if (!res.ok) throw new Error('Teledit DELETE 실패')
      }
    } catch (err) {
      alert(`Teledit 오류: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [teledditTemplate])

  // ─── Handler: select position ───────────────────────────
  const handleSelectPosition = useCallback((position: PositionWithLive) => {
    setSelectedPosition(prev => prev?.id === position.id ? null : position)
    setSymbol(prev => position.symbol !== prev ? position.symbol : prev)
  }, [])

  // ─── Handler: symbol change ─────────────────────────────
  const handleSymbolChange = useCallback((newSymbol: string) => {
    setSymbol(newSymbol)
    setSelectedPosition(null)
  }, [])

  return {
    // Session & routing
    session,
    status,

    // State
    positions,
    symbol,
    selectedPosition,
    loading,
    marketData,
    sharePosition,
    teledditTemplate,
    showSettings,
    templateInput,
    savingTemplate,
    currentPw,
    newPw,
    newPwConfirm,
    pwMsg,
    savingPw,

    // Computed
    positionsWithLive,
    currentPrice,

    // State setters (for settings modal)
    setShowSettings,
    setTemplateInput,
    setCurrentPw,
    setNewPw,
    setNewPwConfirm,

    // Handlers
    fetchPositions,
    handleCreatePosition,
    handleClosePosition,
    handleEditPosition,
    handleEditHistory,
    handleDeleteHistory,
    handleDeleteAllHistory,
    handleShareHistory,
    handleTeledditToggle,
    handleChangePassword,
    handleSaveTemplate,
    handleSelectPosition,
    handleSymbolChange,
    setSharePosition,
  }
}
