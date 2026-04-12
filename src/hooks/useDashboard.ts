import { useState, useEffect, useCallback, useMemo, useRef, RefObject } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { PositionWithLive, Position } from '@/types'
import { usePriceStore, subscribeSymbols } from '@/lib/hooks'
import { calculatePnL, checkTPSL } from '@/lib/calculations'


const DEFAULT_TEMPLATE = '🟢 {{symbol}} {{side}} {{leverage}}x | 진입 ${{entryPrice}}'
const DEFAULT_CLOSE_TEMPLATE = '🔴 {{symbol}} {{side}} 청산 | PnL {{pnl}}USDT ({{roe}}%)'
const DEFAULT_PROFIT_TEMPLATE = '💰 수익 인증\n{{symbol}} {{side}} {{leverage}}x\n진입 ${{entryPrice}} → 청산 ${{closePrice}}\nPnL {{pnl}}USDT ({{roe}}%)'

export { DEFAULT_TEMPLATE, DEFAULT_CLOSE_TEMPLATE, DEFAULT_PROFIT_TEMPLATE }

// ─── Teledit Auth Helpers (module-level) ────────────────
let _teleditToken: string | null = null

async function teleditLogin(baseUrl: string, email?: string, password?: string): Promise<string> {
  const _email = email || process.env.NEXT_PUBLIC_TELEDIT_EMAIL
  const _password = password || process.env.NEXT_PUBLIC_TELEDIT_PASSWORD
  if (!_email || !_password) throw new Error('Teledit 인증 정보가 설정되지 않았습니다.')

  const res = await fetch(`${baseUrl}/api/extension/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: _email, password: _password }),
  })
  if (!res.ok) throw new Error('Teledit 로그인 실패')
  const data = await res.json()
  _teleditToken = data.token
  return _teleditToken!
}

async function teleditFetch(
  url: string,
  options: RequestInit = {},
  baseUrl: string,
  email?: string,
  password?: string,
): Promise<Response> {
  if (!_teleditToken) await teleditLogin(baseUrl, email, password)

  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
    Authorization: `Bearer ${_teleditToken}`,
  }

  let res = await fetch(url, { ...options, headers })

  // 401 → 토큰 재발급 후 1회 retry
  if (res.status === 401) {
    _teleditToken = null
    await teleditLogin(baseUrl, email, password)
    headers.Authorization = `Bearer ${_teleditToken}`
    res = await fetch(url, { ...options, headers })
  }

  return res
}

export function applyTemplate(
  template: string,
  position: PositionWithLive | Position,
  options?: { roundEnabled?: boolean; roundDecimals?: number }
): string {
  const { roundEnabled = false, roundDecimals = 2 } = options ?? {}
  const fmt = (val: number): string =>
    roundEnabled ? val.toFixed(roundDecimals) : String(val)
  const fmtN = (val: number | null | undefined): string =>
    val != null ? fmt(val) : 'N/A'

  const roe = 'roeLive' in position && position.roeLive != null ? position.roeLive.toFixed(2) : 'N/A'
  const pnlValue = position.pnl != null
    ? position.pnl
    : ('pnlLive' in position && position.pnlLive != null ? position.pnlLive : null)
  return template
    .replace(/\{\{symbol\}\}/g, position.symbol)
    .replace(/\{\{side\}\}/g, position.side)
    .replace(/\{\{leverage\}\}/g, String(position.leverage))
    .replace(/\{\{entryPrice\}\}/g, fmt(position.entryPrice))
    .replace(/\{\{inputPrice\}\}/g, fmtN(position.inputPrice))
    .replace(/\{\{amount\}\}/g, fmt(position.amount))
    .replace(/\{\{quantity\}\}/g, fmt(position.quantity))
    .replace(/\{\{marginMode\}\}/g, position.marginMode)
    .replace(/\{\{takeProfit\}\}/g, fmtN(position.takeProfit))
    .replace(/\{\{stopLoss\}\}/g, fmtN(position.stopLoss))
    .replace(/\{\{pnl\}\}/g, pnlValue != null ? pnlValue.toFixed(2) : 'N/A')
    .replace(/\{\{roe\}\}/g, roe)
    .replace(/\{\{closePrice\}\}/g, fmtN(position.closedPrice))
}

// ─── Teledit Delayed Message Helper ────────────────────────
async function scheduleTeleditMessage(
  baseUrl: string,
  email: string | undefined,
  password: string | undefined,
  template: string,
  position: Position,
  delayMs: number,
  formatOptions?: { roundEnabled?: boolean; roundDecimals?: number },
): Promise<void> {
  await new Promise(resolve => setTimeout(resolve, delayMs))
  try {
    const chRes = await teleditFetch(`${baseUrl}/api/telegram/channels`, {}, baseUrl, email, password)
    if (!chRes.ok) return
    const channels = await chRes.json()
    if (!Array.isArray(channels) || channels.length === 0) return
    const content = applyTemplate(template, position, formatOptions)
    for (const channel of channels) {
      await teleditFetch(`${baseUrl}/api/telegram/overrides`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ positionId: position.id, channelId: channel.id, content, active: true }),
      }, baseUrl, email, password)
    }
  } catch {
    // silent — 딜레이 메시지 실패는 무시
  }
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
  teleditApiUrl: string
  teleditEmail: string
  teleditPassword: string
  savingTeledit: boolean
  teleditMsg: string
  closeTemplateInput: string
  profitTemplateInput: string

  // Computed
  positionsWithLive: PositionWithLive[]
  currentPrice: number

  // State setters (for settings modal)
  setShowSettings: (v: boolean) => void
  setTemplateInput: (v: string) => void
  setCurrentPw: (v: string) => void
  setNewPw: (v: string) => void
  setNewPwConfirm: (v: string) => void
  setTeleditApiUrl: (v: string) => void
  setTeleditEmail: (v: string) => void
  setTeleditPassword: (v: string) => void
  setCloseTemplateInput: (v: string) => void
  setProfitTemplateInput: (v: string) => void

  // 자동 캡처
  capturePos: PositionWithLive | null
  cardRef: RefObject<HTMLDivElement | null>

  // Handlers
  fetchPositions: () => Promise<void>
  handleCreatePosition: (data: any) => Promise<void>
  handleClosePosition: (id: string, options?: number | { closeMargin?: number; closeQuantity?: number }) => Promise<void>
  handleEditPosition: (id: string, data: { takeProfit?: number | null; stopLoss?: number | null }) => Promise<void>
  handleReversePosition: (id: string) => Promise<void>
  handleEditHistory: (id: string, data: { entryPrice?: number; closedPrice?: number; amount?: number; leverage?: number; entryTime?: string; closedAt?: string }) => Promise<void>
  handleDeleteHistory: (ids: string[]) => Promise<void>
  handleDeleteAllHistory: () => Promise<void>
  handleShareHistory: (position: Position) => void
  handleTeledditToggle: (position: PositionWithLive | Position, checked: boolean) => Promise<void>
  handleChangePassword: () => Promise<void>
  handleSaveTemplate: () => Promise<void>
  handleSaveTeledit: () => Promise<void>
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
  const [teleditApiUrl, setTeleditApiUrl] = useState('')
  const [teleditEmail, setTeleditEmail] = useState('')
  const [teleditPassword, setTeleditPassword] = useState('')
  const [savingTeledit, setSavingTeledit] = useState(false)
  const [teleditMsg, setTeleditMsg] = useState('')
  const [closeTemplateInput, setCloseTemplateInput] = useState(DEFAULT_CLOSE_TEMPLATE)
  const [profitTemplateInput, setProfitTemplateInput] = useState(DEFAULT_PROFIT_TEMPLATE)
  const [teleditPreEntryTemplate, setTeleditPreEntryTemplate] = useState('⏳ {{symbol}} {{side}} {{leverage}}x | 진입 예정 ${{entryPrice}}')
  const [teleditPreCloseTemplate, setTeleditPreCloseTemplate] = useState('⏳ {{symbol}} {{side}} | 청산 예정 PnL {{pnl}}USDT ({{roe}}%)')
  const [preEntryMinSec, setPreEntryMinSec] = useState(60)
  const [preEntryMaxSec, setPreEntryMaxSec] = useState(120)
  const [preCloseMinSec, setPreCloseMinSec] = useState(60)
  const [preCloseMaxSec, setPreCloseMaxSec] = useState(120)
  const [varRoundEnabled, setVarRoundEnabled] = useState(false)
  const [varRoundDecimals, setVarRoundDecimals] = useState(2)

  // ── 자동 캡처 ────────────────────────────────────────────────────────────────
  const [capturePos, setCapturePos] = useState<PositionWithLive | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const captureQueue  = useRef<PositionWithLive[]>([])
  const isCapturing   = useRef(false)
  const processedIds  = useRef<Set<string>>(new Set())
  const batchStarted  = useRef(false)

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

  // ─── useEffect 5.5: REST fallback for missing/stale prices ────
  useEffect(() => {
    const openPositions = positions.filter(p => p.status === 'OPEN')
    if (openPositions.length === 0) return

    const fetchMissing = () => {
      const currentPrices = usePriceStore.getState().prices
      const missingSymbols = openPositions
        .map(p => p.symbol)
        .filter((sym, i, arr) => arr.indexOf(sym) === i && !currentPrices[sym])

      if (missingSymbols.length === 0) return

      missingSymbols.forEach(async sym => {
        try {
          const res = await fetch(`/api/price/${sym}`)
          const data = await res.json()
          if (data?.price) {
            usePriceStore.getState().setPrice(sym, data.price)
          }
        } catch {
          // silent — WebSocket may catch up later
        }
      })
    }

    // 즉시 실행
    fetchMissing()
    // 3초 후 재시도 (WebSocket이 아직 연결 안 됐을 때)
    const timer = setTimeout(fetchMissing, 3000)
    return () => clearTimeout(timer)
  }, [positions])

  // ─── useEffect 6: Load account info (teledditTemplate + teledit) ──
  useEffect(() => {
    if (!session) return
    fetch('/api/account').then(r => r.ok ? r.json() : null).then(data => {
      if (!data) return
      if (data.teledditTemplate) {
        setTeledditTemplate(data.teledditTemplate)
        setTemplateInput(data.teledditTemplate)
      }
      if (data.teleditApiUrl) setTeleditApiUrl(data.teleditApiUrl)
      if (data.teleditEmail) setTeleditEmail(data.teleditEmail)
      if (data.teleditPassword) setTeleditPassword(data.teleditPassword)
      if (data.teleditCloseTemplate) setCloseTemplateInput(data.teleditCloseTemplate)
      if (data.teleditProfitTemplate) setProfitTemplateInput(data.teleditProfitTemplate)
      if (data.teleditPreEntryTemplate) setTeleditPreEntryTemplate(data.teleditPreEntryTemplate)
      if (data.teleditPreCloseTemplate) setTeleditPreCloseTemplate(data.teleditPreCloseTemplate)
      if (data.preEntryMinSec != null) setPreEntryMinSec(data.preEntryMinSec)
      if (data.preEntryMaxSec != null) setPreEntryMaxSec(data.preEntryMaxSec)
      if (data.preCloseMinSec != null) setPreCloseMinSec(data.preCloseMinSec)
      if (data.preCloseMaxSec != null) setPreCloseMaxSec(data.preCloseMaxSec)
      if (data.varRoundEnabled != null) setVarRoundEnabled(data.varRoundEnabled)
      if (data.varRoundDecimals != null) setVarRoundDecimals(data.varRoundDecimals)
    }).catch(() => {})
  }, [session])

  // ─── Subscribe to open position symbols ─────────────────
  useEffect(() => {
    const openSymbols = positions.filter(p => p.status === 'OPEN').map(p => p.symbol)
    if (openSymbols.length > 0) subscribeSymbols(openSymbols)
  }, [positions])

  // ─── Ref: positionsWithLive (stale-closure 방지용) ───────
  const positionsWithLiveRef = useRef<PositionWithLive[]>([])

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

  // ─── Sync ref ────────────────────────────────────────────
  positionsWithLiveRef.current = positionsWithLive

  // ─── Computed: currentPrice ─────────────────────────────
  const currentPrice = prices[symbol] || marketData?.price || 0

  // ── 헬퍼: 다음 캡처 시작 ─────────────────────────────────────────────────────
  const startNextCapture = useCallback(() => {
    const next = captureQueue.current.shift()
    if (next) {
      isCapturing.current = true
      setCapturePos(next)
    } else {
      isCapturing.current = false
      setCapturePos(null)
      // 배치 완료 → 업그레이드 플래그 세팅 (이후 재방문 시 null만 캡처)
      if (typeof window !== 'undefined') {
        localStorage.setItem('profitcard_upgraded_v1', '1')
      }
    }
  }, [])

  // ── 첫 positions 로드 시 배치 큐 구성 (1회만) ────────────────────────────────
  // localStorage 'profitcard_upgraded_v1': 최초 1회 전체 재캡처 후 세팅 → 이후 null만 캡처
  useEffect(() => {
    if (!session || positions.length === 0 || batchStarted.current) return
    const upgraded = typeof window !== 'undefined' && !!localStorage.getItem('profitcard_upgraded_v1')
    const needCapture = positions.filter(
      p => p.status !== 'OPEN' && !p.deletedAt && (!upgraded || !p.shareImageUrl)
    )
    if (needCapture.length === 0) { batchStarted.current = true; return }
    console.log(`[ProfitCard] 배치 캡처 시작: ${needCapture.length}개 (upgraded=${upgraded})`)
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
        console.warn('[ProfitCard] 캡처 취소됨:', capturePos.id)
        return
      }
      try {
        console.log('[ProfitCard] 캡처 중:', capturePos.id)
        const { toPng } = await import('html-to-image')

        // html-to-image 자동 @font-face 스캔은 Next.js 환경에서 불안정 → 직접 embed
        const toB64 = async (url: string): Promise<string> => {
          const res = await fetch(url)
          const buf = await res.arrayBuffer()
          const bytes = new Uint8Array(buf)
          let binary = ''
          for (let i = 0; i < bytes.length; i += 8192) {
            binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
          }
          return btoa(binary)
        }
        const [r400, r600, r700] = await Promise.all([
          toB64('/fonts/Inter-Regular.woff2'),
          toB64('/fonts/Inter-SemiBold.woff2'),
          toB64('/fonts/Inter-Bold.woff2'),
        ])
        const fontEmbedCSS = [
          `@font-face{font-family:'Inter';src:url('data:font/woff2;base64,${r400}')format('woff2');font-weight:400;font-style:normal;}`,
          `@font-face{font-family:'Inter';src:url('data:font/woff2;base64,${r600}')format('woff2');font-weight:600;font-style:normal;}`,
          `@font-face{font-family:'Inter';src:url('data:font/woff2;base64,${r700}')format('woff2');font-weight:700;font-style:normal;}`,
        ].join('')

        const dataUrl = await toPng(cardRef.current, { pixelRatio: 2, cacheBust: true, fontEmbedCSS })
        const res = await fetch(`/api/profit-card/${capturePos.id}/image`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ dataUrl }),
        })
        if (res.ok) {
          console.log('[ProfitCard] 업로드 완료:', capturePos.id)
        } else {
          console.error('[ProfitCard] 업로드 실패:', capturePos.id, res.status)
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

  // ─── Handler: save teledit settings ─────────────────────
  const handleSaveTeledit = useCallback(async () => {
    setSavingTeledit(true)
    setTeleditMsg('')
    try {
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          teleditApiUrl: teleditApiUrl || null,
          teleditEmail: teleditEmail || null,
          teleditPassword: teleditPassword || null,
          teledditTemplate: templateInput,
          teleditCloseTemplate: closeTemplateInput || null,
          teleditProfitTemplate: profitTemplateInput || null,
        }),
      })
      if (!res.ok) throw new Error('저장 실패')
      setTeledditTemplate(templateInput)
      setTeleditMsg('저장되었습니다.')
      setTimeout(() => setTeleditMsg(''), 3000)
    } catch (err) {
      setTeleditMsg(`오류: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingTeledit(false)
    }
  }, [teleditApiUrl, teleditEmail, teleditPassword, templateInput, closeTemplateInput, profitTemplateInput])

  // ─── Handler: create position ───────────────────────────
  const handleCreatePosition = useCallback(async (data: any) => {
    const res = await fetch('/api/positions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) {
      const newPosition = await res.json()
      fetchPositions()
      const baseUrl = teleditApiUrl || process.env.NEXT_PUBLIC_TELEDIT_API_URL
      if (baseUrl && teleditPreEntryTemplate && newPosition?.id) {
        const range = Math.max(0, preEntryMaxSec - preEntryMinSec)
        const delayMs = (preEntryMinSec + Math.random() * range) * 1000
        scheduleTeleditMessage(baseUrl, teleditEmail || undefined, teleditPassword || undefined, teleditPreEntryTemplate, newPosition, delayMs, { roundEnabled: varRoundEnabled, roundDecimals: varRoundDecimals })
      }
    } else {
      const err = await res.json()
      alert(err.error || 'Position creation failed')
    }
  }, [fetchPositions, teleditApiUrl, teleditEmail, teleditPassword, teleditPreEntryTemplate, preEntryMinSec, preEntryMaxSec])

  // ─── Handler: close position (전체/부분 익절) ────────────
  const handleClosePosition = useCallback(async (id: string, options?: number | { closeMargin?: number; closeQuantity?: number }) => {
    // preClose 메시지용 포지션 스냅샷 (청산 전에 캡처)
    const positionSnap = positionsWithLiveRef.current.find(p => p.id === id)

    let res: Response
    // 정방향 호환: 숫자면 closeMargin으로 처리
    const opts = typeof options === 'number' ? { closeMargin: options } : options
    if (opts && (opts.closeMargin != null || opts.closeQuantity != null)) {
      // 부분 익절: PATCH + action=partialClose
      const body: Record<string, unknown> = { action: 'partialClose' }
      if (opts.closeQuantity != null) body.closeQuantity = opts.closeQuantity
      if (opts.closeMargin != null) body.closeMargin = opts.closeMargin
      res = await fetch(`/api/positions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    } else {
      // 전체 청산: DELETE
      res = await fetch(`/api/positions/${id}`, { method: 'DELETE' })
    }
    if (res.ok) {
      fetchPositions()
      setSelectedPosition(prev => prev?.id === id ? null : prev)

      // 전체 청산 시 이미지 자동 캡처 (중복 체크)
      if (!opts && positionSnap && !processedIds.current.has(id)) {
        processedIds.current.add(id)
        if (!isCapturing.current) {
          isCapturing.current = true
          setCapturePos(positionSnap)
        } else {
          captureQueue.current.push(positionSnap)
        }
      }

      const baseUrl = teleditApiUrl || process.env.NEXT_PUBLIC_TELEDIT_API_URL
      if (baseUrl && positionSnap && teleditPreCloseTemplate) {
        const range = Math.max(0, preCloseMaxSec - preCloseMinSec)
        const delayMs = (preCloseMinSec + Math.random() * range) * 1000
        scheduleTeleditMessage(baseUrl, teleditEmail || undefined, teleditPassword || undefined, teleditPreCloseTemplate, positionSnap, delayMs, { roundEnabled: varRoundEnabled, roundDecimals: varRoundDecimals })
      }
    } else {
      const err = await res.json()
      alert(err.error || '청산 실패')
    }
  }, [fetchPositions, teleditApiUrl, teleditEmail, teleditPassword, teleditPreCloseTemplate, preCloseMinSec, preCloseMaxSec])

  // ─── Handler: edit position ─────────────────────────────
  const handleEditPosition = useCallback(async (id: string, data: { takeProfit?: number | null; stopLoss?: number | null }) => {
    const res = await fetch(`/api/positions/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) fetchPositions()
  }, [fetchPositions])

  // ─── Handler: reverse position (청산 + 반대 진입) ────────
  const handleReversePosition = useCallback(async (id: string) => {
    try {
      const res = await fetch(`/api/positions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reverse' }),
      })
      if (res.ok) {
        fetchPositions()
        setSelectedPosition(null)
      } else {
        const err = await res.json()
        alert(err.error || '리버스 실패')
      }
    } catch {
      alert('리버스 중 오류가 발생했습니다.')
    }
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
    const baseUrl = teleditApiUrl || process.env.NEXT_PUBLIC_TELEDIT_API_URL
    if (!baseUrl) {
      alert('TELEDIT_API_URL이 설정되지 않았습니다.')
      return
    }
    const _email = teleditEmail || undefined
    const _password = teleditPassword || undefined

    try {
      const chRes = await teleditFetch(`${baseUrl}/api/telegram/channels`, {}, baseUrl, _email, _password)
      if (!chRes.ok) throw new Error('채널 목록 조회 실패')
      const data = await chRes.json()
      const channelId = data?.channels?.[0]?.dbId
      if (!channelId) throw new Error('연결된 텔레그램 채널이 없습니다.')

      if (checked) {
        const content = applyTemplate(teledditTemplate, position, { roundEnabled: varRoundEnabled, roundDecimals: varRoundDecimals })
        const res = await teleditFetch(`${baseUrl}/api/telegram/overrides`, {
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
        }, baseUrl, _email, _password)
        if (!res.ok) throw new Error('Teledit INSERT 실패')
      } else {
        const res = await teleditFetch(`${baseUrl}/api/telegram/overrides/${position.id}`, {
          method: 'DELETE',
        }, baseUrl, _email, _password)
        if (!res.ok) throw new Error('Teledit DELETE 실패')
      }
    } catch (err) {
      alert(`Teledit 오류: ${err instanceof Error ? err.message : String(err)}`)
    }
  }, [teledditTemplate, teleditApiUrl, teleditEmail, teleditPassword])

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

    // 자동 캡처
    capturePos,
    cardRef,

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
    teleditApiUrl,
    teleditEmail,
    teleditPassword,
    savingTeledit,
    teleditMsg,
    closeTemplateInput,
    profitTemplateInput,

    // Computed
    positionsWithLive,
    currentPrice,

    // State setters (for settings modal)
    setShowSettings,
    setTemplateInput,
    setCurrentPw,
    setNewPw,
    setNewPwConfirm,
    setTeleditApiUrl,
    setTeleditEmail,
    setTeleditPassword,
    setCloseTemplateInput,
    setProfitTemplateInput,

    // Handlers
    fetchPositions,
    handleCreatePosition,
    handleClosePosition,
    handleEditPosition,
    handleReversePosition,
    handleEditHistory,
    handleDeleteHistory,
    handleDeleteAllHistory,
    handleShareHistory,
    handleTeledditToggle,
    handleChangePassword,
    handleSaveTemplate,
    handleSaveTeledit,
    handleSelectPosition,
    handleSymbolChange,
    setSharePosition,
  }
}
