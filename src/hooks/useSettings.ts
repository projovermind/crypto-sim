'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { applyTemplate } from '@/hooks/useDashboard'

// ─── Default templates ────────────────────────────────────────
export const DEFAULT_TEMPLATES = {
  teledditTemplate: '🟢 {{symbol}} {{side}} {{leverage}}x | 진입 ${{entryPrice}}',
  teledditLongTemplate: '🟢 {{symbol}} LONG {{leverage}}x | 진입 ${{entryPrice}}',
  teledditShortTemplate: '🔴 {{symbol}} SHORT {{leverage}}x | 진입 ${{entryPrice}}',
  teleditPreEntryTemplate: '⏳ {{symbol}} {{side}} {{leverage}}x | 진입 예정 ${{entryPrice}}',
  teleditPostEntryTemplate: '📊 {{symbol}} {{side}} {{leverage}}x | 진입 완료 ${{entryPrice}}',
  teleditPreCloseTemplate: '⏳ {{symbol}} {{side}} | 청산 예정 PnL {{pnl}}USDT ({{roe}}%)',
  teleditCloseTemplate: '🔴 {{symbol}} {{side}} 청산 | PnL {{pnl}}USDT ({{roe}}%)',
  teleditProfitTemplate: '💰 수익 인증\n{{symbol}} {{side}} {{leverage}}x\n진입 ${{entryPrice}} → 청산 ${{closePrice}}\nPnL {{pnl}}USDT ({{roe}}%)',
  teleditProfitTemplate2: '📈 수익 인증\n{{symbol}} {{side}} {{leverage}}x\nPnL {{pnl}}USDT ({{roe}}%)',
} as const

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES

// ─── Default enabled states ───────────────────────────────────
export const DEFAULT_ENABLED: Record<TemplateKey, boolean> = {
  teledditTemplate: true,
  teledditLongTemplate: true,
  teledditShortTemplate: true,
  teleditPreEntryTemplate: true,
  teleditPostEntryTemplate: true,
  teleditPreCloseTemplate: true,
  teleditCloseTemplate: true,
  teleditProfitTemplate: true,
  teleditProfitTemplate2: true,
}

// ─── Mock data for preview ────────────────────────────────────
export const MOCK_ENTRY = {
  symbol: 'BTCUSDT', side: 'LONG', leverage: 10, entryPrice: 65000, amount: 100, pnl: null, closedPrice: null,
  inputPrice: 64800, quantity: 0.00154, marginMode: 'ISOLATED', takeProfit: 67000, stopLoss: 63000,
} as any

export const MOCK_CLOSE = {
  symbol: 'BTCUSDT', side: 'LONG', leverage: 10, entryPrice: 65000, amount: 100, pnl: 12.5, roeLive: 12.5, closedPrice: 66200,
  inputPrice: 64800, quantity: 0.00154, marginMode: 'ISOLATED', takeProfit: 67000, stopLoss: 63000,
} as any

// ─── Template variable groups ─────────────────────────────────
export const ENTRY_VARS = ['symbol', 'side', 'leverage', 'entryPrice', 'amount']
export const CLOSE_VARS = ['symbol', 'side', 'leverage', 'entryPrice', 'closePrice', 'pnl', 'roe']

// ─── Hook ─────────────────────────────────────────────────────
export function useSettings() {
  const { data: session, status } = useSession()
  const router = useRouter()

  const [loading, setLoading] = useState(true)

  // Password form
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [savingPw, setSavingPw] = useState(false)

  // Teledit connection
  const [teleditApiUrl, setTeleditApiUrl] = useState('')
  const [teleditEmail, setTeleditEmail] = useState('')
  const [teleditPassword, setTeleditPassword] = useState('')

  // Comment count settings
  const [preEntryCommentMin, setPreEntryCommentMin] = useState(0)
  const [preEntryCommentMax, setPreEntryCommentMax] = useState(0)
  const [longCommentMin, setLongCommentMin] = useState(0)
  const [longCommentMax, setLongCommentMax] = useState(0)
  const [shortCommentMin, setShortCommentMin] = useState(0)
  const [shortCommentMax, setShortCommentMax] = useState(0)
  const [postEntryCommentMin, setPostEntryCommentMin] = useState(0)
  const [postEntryCommentMax, setPostEntryCommentMax] = useState(0)
  const [preCloseCommentMin, setPreCloseCommentMin] = useState(0)
  const [preCloseCommentMax, setPreCloseCommentMax] = useState(0)
  const [closeCommentMin, setCloseCommentMin] = useState(0)
  const [closeCommentMax, setCloseCommentMax] = useState(0)
  const [profit1CommentMin, setProfit1CommentMin] = useState(0)
  const [profit1CommentMax, setProfit1CommentMax] = useState(0)
  const [profit2CommentMin, setProfit2CommentMin] = useState(0)
  const [profit2CommentMax, setProfit2CommentMax] = useState(0)

  // Timing settings (seconds)
  const [preEntryMinSec, setPreEntryMinSec] = useState(60)
  const [preEntryMaxSec, setPreEntryMaxSec] = useState(120)
  const [postEntryMinSec, setPostEntryMinSec] = useState(30)
  const [postEntryMaxSec, setPostEntryMaxSec] = useState(60)
  const [preCloseMinSec, setPreCloseMinSec] = useState(60)
  const [preCloseMaxSec, setPreCloseMaxSec] = useState(120)
  const [profit1MinSec, setProfit1MinSec] = useState(30)
  const [profit1MaxSec, setProfit1MaxSec] = useState(60)
  const [varRoundEnabled, setVarRoundEnabled] = useState(false)
  const [varRoundDecimals, setVarRoundDecimals] = useState(2)
  const [profit2MinSec, setProfit2MinSec] = useState(30)
  const [profit2MaxSec, setProfit2MaxSec] = useState(60)

  // Templates
  const [templates, setTemplates] = useState<Record<TemplateKey, string>>({ ...DEFAULT_TEMPLATES })
  const [templateEnabled, setTemplateEnabled] = useState<Record<TemplateKey, boolean>>({ ...DEFAULT_ENABLED })
  const [savingTeledit, setSavingTeledit] = useState(false)
  const [teleditMsg, setTeleditMsg] = useState('')

  // ─── Auth guard ───────────────────────────────────────────
  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
  }, [status, router])

  // ─── Load account data ───────────────────────────────────
  useEffect(() => {
    if (!session) return
    setLoading(true)
    fetch('/api/account')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data) return
        setTemplates(prev => ({
          ...prev,
          teledditTemplate: data.teledditTemplate || DEFAULT_TEMPLATES.teledditTemplate,
          teledditLongTemplate: data.teledditLongTemplate || DEFAULT_TEMPLATES.teledditLongTemplate,
          teledditShortTemplate: data.teledditShortTemplate || DEFAULT_TEMPLATES.teledditShortTemplate,
          teleditPreEntryTemplate: data.teleditPreEntryTemplate || DEFAULT_TEMPLATES.teleditPreEntryTemplate,
          // migration: teleditPostEntry1Template → teleditPostEntryTemplate
          teleditPostEntryTemplate: data.teleditPostEntryTemplate || data.teleditPostEntry1Template || DEFAULT_TEMPLATES.teleditPostEntryTemplate,
          teleditPreCloseTemplate: data.teleditPreCloseTemplate || DEFAULT_TEMPLATES.teleditPreCloseTemplate,
          teleditCloseTemplate: data.teleditCloseTemplate || DEFAULT_TEMPLATES.teleditCloseTemplate,
          teleditProfitTemplate: data.teleditProfitTemplate || DEFAULT_TEMPLATES.teleditProfitTemplate,
          teleditProfitTemplate2: data.teleditProfitTemplate2 || DEFAULT_TEMPLATES.teleditProfitTemplate2,
        }))
        if (data.teleditApiUrl) setTeleditApiUrl(data.teleditApiUrl)
        if (data.teleditEmail) setTeleditEmail(data.teleditEmail)
        if (data.teleditPassword) setTeleditPassword(data.teleditPassword)
        if (data.preEntryCommentMin != null) setPreEntryCommentMin(data.preEntryCommentMin)
        if (data.preEntryCommentMax != null) setPreEntryCommentMax(data.preEntryCommentMax)
        if (data.longCommentMin != null) setLongCommentMin(data.longCommentMin)
        if (data.longCommentMax != null) setLongCommentMax(data.longCommentMax)
        if (data.shortCommentMin != null) setShortCommentMin(data.shortCommentMin)
        if (data.shortCommentMax != null) setShortCommentMax(data.shortCommentMax)
        if (data.postEntryCommentMin != null) setPostEntryCommentMin(data.postEntryCommentMin)
        if (data.postEntryCommentMax != null) setPostEntryCommentMax(data.postEntryCommentMax)
        if (data.preCloseCommentMin != null) setPreCloseCommentMin(data.preCloseCommentMin)
        if (data.preCloseCommentMax != null) setPreCloseCommentMax(data.preCloseCommentMax)
        if (data.closeCommentMin != null) setCloseCommentMin(data.closeCommentMin)
        if (data.closeCommentMax != null) setCloseCommentMax(data.closeCommentMax)
        if (data.profit1CommentMin != null) setProfit1CommentMin(data.profit1CommentMin)
        if (data.profit1CommentMax != null) setProfit1CommentMax(data.profit1CommentMax)
        if (data.profit2CommentMin != null) setProfit2CommentMin(data.profit2CommentMin)
        if (data.profit2CommentMax != null) setProfit2CommentMax(data.profit2CommentMax)
        if (data.preEntryMinSec != null) setPreEntryMinSec(data.preEntryMinSec)
        if (data.preEntryMaxSec != null) setPreEntryMaxSec(data.preEntryMaxSec)
        if (data.postEntryMinSec != null) setPostEntryMinSec(data.postEntryMinSec)
        if (data.postEntryMaxSec != null) setPostEntryMaxSec(data.postEntryMaxSec)
        if (data.preCloseMinSec != null) setPreCloseMinSec(data.preCloseMinSec)
        if (data.preCloseMaxSec != null) setPreCloseMaxSec(data.preCloseMaxSec)
        if (data.profit1MinSec != null) setProfit1MinSec(data.profit1MinSec)
        if (data.profit1MaxSec != null) setProfit1MaxSec(data.profit1MaxSec)
        if (data.varRoundEnabled != null) setVarRoundEnabled(data.varRoundEnabled)
        if (data.varRoundDecimals != null) setVarRoundDecimals(data.varRoundDecimals)
        if (data.profit2MinSec != null) setProfit2MinSec(data.profit2MinSec)
        if (data.profit2MaxSec != null) setProfit2MaxSec(data.profit2MaxSec)
        // Load enabled states
        const enabledUpdate: Partial<Record<TemplateKey, boolean>> = {}
        for (const key of Object.keys(DEFAULT_ENABLED) as TemplateKey[]) {
          const apiKey = key.replace('Template', 'Enabled')
          if (data[apiKey] != null) enabledUpdate[key] = data[apiKey]
        }
        if (Object.keys(enabledUpdate).length > 0) {
          setTemplateEnabled(prev => ({ ...prev, ...enabledUpdate }))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  // ─── Update / reset / toggle template ────────────────────
  const updateTemplate = useCallback((key: TemplateKey, value: string) => {
    setTemplates(prev => ({ ...prev, [key]: value }))
  }, [])

  const resetTemplate = useCallback((key: TemplateKey) => {
    setTemplates(prev => ({ ...prev, [key]: DEFAULT_TEMPLATES[key] }))
  }, [])

  const updateEnabled = useCallback((key: TemplateKey, value: boolean) => {
    setTemplateEnabled(prev => ({ ...prev, [key]: value }))
  }, [])

  // ─── Change password ─────────────────────────────────────
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
        setCurrentPw('')
        setNewPw('')
        setNewPwConfirm('')
      } else {
        setPwMsg(data.error || '변경 실패')
      }
    } catch {
      setPwMsg('오류가 발생했습니다.')
    } finally {
      setSavingPw(false)
    }
  }, [currentPw, newPw, newPwConfirm])

  // ─── Save all teledit settings ───────────────────────────
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
          preEntryCommentMin, preEntryCommentMax,
          longCommentMin, longCommentMax,
          shortCommentMin, shortCommentMax,
          postEntryCommentMin, postEntryCommentMax,
          preCloseCommentMin, preCloseCommentMax,
          closeCommentMin, closeCommentMax,
          profit1CommentMin, profit1CommentMax,
          profit2CommentMin, profit2CommentMax,
          preEntryMinSec,
          preEntryMaxSec,
          postEntryMinSec,
          postEntryMaxSec,
          preCloseMinSec,
          preCloseMaxSec,
          profit1MinSec,
          profit1MaxSec,
          profit2MinSec,
          varRoundEnabled,
          varRoundDecimals,
          profit2MaxSec,
          ...templates,
          ...Object.fromEntries(
            (Object.entries(templateEnabled) as [TemplateKey, boolean][])
              .map(([k, v]) => [k.replace('Template', 'Enabled'), v])
          ),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || '저장 실패')
      }
      setTeleditMsg('저장되었습니다.')
      setTimeout(() => setTeleditMsg(''), 3000)
    } catch (err) {
      setTeleditMsg(`오류: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      setSavingTeledit(false)
    }
  }, [
    teleditApiUrl, teleditEmail, teleditPassword,
    preEntryCommentMin, preEntryCommentMax,
    longCommentMin, longCommentMax,
    shortCommentMin, shortCommentMax,
    postEntryCommentMin, postEntryCommentMax,
    preCloseCommentMin, preCloseCommentMax,
    closeCommentMin, closeCommentMax,
    profit1CommentMin, profit1CommentMax,
    profit2CommentMin, profit2CommentMax,
    preEntryMinSec, preEntryMaxSec,
    postEntryMinSec, postEntryMaxSec,
    preCloseMinSec, preCloseMaxSec,
    profit1MinSec, profit1MaxSec,
    profit2MinSec, profit2MaxSec,
    varRoundEnabled, varRoundDecimals,
    templates, templateEnabled,
  ])

  return {
    session,
    status,
    loading,
    // Password
    currentPw, setCurrentPw,
    newPw, setNewPw,
    newPwConfirm, setNewPwConfirm,
    pwMsg, savingPw,
    handleChangePassword,
    // Teledit connection
    teleditApiUrl, setTeleditApiUrl,
    teleditEmail, setTeleditEmail,
    teleditPassword, setTeleditPassword,
    // Templates
    templates, updateTemplate, resetTemplate,
    templateEnabled, updateEnabled,
    // Comment counts
    preEntryCommentMin, setPreEntryCommentMin,
    preEntryCommentMax, setPreEntryCommentMax,
    longCommentMin, setLongCommentMin,
    longCommentMax, setLongCommentMax,
    shortCommentMin, setShortCommentMin,
    shortCommentMax, setShortCommentMax,
    postEntryCommentMin, setPostEntryCommentMin,
    postEntryCommentMax, setPostEntryCommentMax,
    preCloseCommentMin, setPreCloseCommentMin,
    preCloseCommentMax, setPreCloseCommentMax,
    closeCommentMin, setCloseCommentMin,
    closeCommentMax, setCloseCommentMax,
    profit1CommentMin, setProfit1CommentMin,
    profit1CommentMax, setProfit1CommentMax,
    profit2CommentMin, setProfit2CommentMin,
    profit2CommentMax, setProfit2CommentMax,
    // Timing
    preEntryMinSec, setPreEntryMinSec,
    preEntryMaxSec, setPreEntryMaxSec,
    postEntryMinSec, setPostEntryMinSec,
    postEntryMaxSec, setPostEntryMaxSec,
    preCloseMinSec, setPreCloseMinSec,
    preCloseMaxSec, setPreCloseMaxSec,
    profit1MinSec, setProfit1MinSec,
    profit1MaxSec, setProfit1MaxSec,
    profit2MinSec, setProfit2MinSec,
    profit2MaxSec, setProfit2MaxSec,
    varRoundEnabled, setVarRoundEnabled,
    varRoundDecimals, setVarRoundDecimals,
    savingTeledit, teleditMsg,
    handleSaveTeledit,
  }
}
