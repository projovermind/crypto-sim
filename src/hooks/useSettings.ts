'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { applyTemplate } from '@/hooks/useDashboard'

// ─── Default templates ────────────────────────────────────────
export const DEFAULT_TEMPLATES = {
  teledditTemplate: '🟢 {{symbol}} {{side}} {{leverage}}x | 진입 ${{entryPrice}}',
  teleditPreEntryTemplate: '⏳ {{symbol}} {{side}} {{leverage}}x | 진입 예정 ${{entryPrice}}',
  teleditPostEntry1Template: '📊 {{symbol}} {{side}} {{leverage}}x | 진입 완료 ${{entryPrice}} (1분 후)',
  teleditPostEntry2Template: '📊 {{symbol}} {{side}} {{leverage}}x | 진입 완료 ${{entryPrice}} (5분 후)',
  teleditPostEntry3Template: '📊 {{symbol}} {{side}} {{leverage}}x | 진입 완료 ${{entryPrice}} (15분 후)',
  teleditCloseTemplate: '🔴 {{symbol}} {{side}} 청산 | PnL {{pnl}}USDT ({{roe}}%)',
  teleditPreCloseTemplate: '⏳ {{symbol}} {{side}} | 청산 예정 PnL {{pnl}}USDT ({{roe}}%)',
  teleditPostClose1Template: '📊 {{symbol}} {{side}} | 청산 완료 PnL {{pnl}}USDT ({{roe}}%) (1분 후)',
  teleditPostClose2Template: '📊 {{symbol}} {{side}} | 청산 완료 PnL {{pnl}}USDT ({{roe}}%) (5분 후)',
  teleditPostClose3Template: '📊 {{symbol}} {{side}} | 청산 완료 PnL {{pnl}}USDT ({{roe}}%) (15분 후)',
  teleditProfitTemplate: '💰 수익 인증\n{{symbol}} {{side}} {{leverage}}x\n진입 ${{entryPrice}} → 청산 ${{closePrice}}\nPnL {{pnl}}USDT ({{roe}}%)',
} as const

export type TemplateKey = keyof typeof DEFAULT_TEMPLATES

// ─── Mock data for preview ────────────────────────────────────
export const MOCK_ENTRY = {
  symbol: 'BTCUSDT', side: 'LONG', leverage: 10, entryPrice: 65000, amount: 100, pnl: null, closedPrice: null,
} as any

export const MOCK_CLOSE = {
  symbol: 'BTCUSDT', side: 'LONG', leverage: 10, entryPrice: 65000, amount: 100, pnl: 12.5, roeLive: 12.5, closedPrice: 66200,
} as any

// ─── Template variable groups ─────────────────────────────────
export const ENTRY_VARS = ['symbol', 'side', 'leverage', 'entryPrice', 'amount']
export const CLOSE_VARS = ['symbol', 'side', 'leverage', 'entryPrice', 'closePrice', 'pnl', 'roe']

// ─── Hook ─────────────────────────────────────────────────────
export function useSettings() {
  const { data: session, status } = useSession()
  const router = useRouter()

  // Loading
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

  // Timing settings (seconds)
  const [preEntryMinSec, setPreEntryMinSec] = useState(60)
  const [preEntryMaxSec, setPreEntryMaxSec] = useState(120)
  const [preCloseMinSec, setPreCloseMinSec] = useState(60)
  const [preCloseMaxSec, setPreCloseMaxSec] = useState(120)

  // Templates
  const [templates, setTemplates] = useState<Record<TemplateKey, string>>({ ...DEFAULT_TEMPLATES })
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
          teleditPreEntryTemplate: data.teleditPreEntryTemplate || DEFAULT_TEMPLATES.teleditPreEntryTemplate,
          teleditPostEntry1Template: data.teleditPostEntry1Template || DEFAULT_TEMPLATES.teleditPostEntry1Template,
          teleditPostEntry2Template: data.teleditPostEntry2Template || DEFAULT_TEMPLATES.teleditPostEntry2Template,
          teleditPostEntry3Template: data.teleditPostEntry3Template || DEFAULT_TEMPLATES.teleditPostEntry3Template,
          teleditCloseTemplate: data.teleditCloseTemplate || DEFAULT_TEMPLATES.teleditCloseTemplate,
          teleditPreCloseTemplate: data.teleditPreCloseTemplate || DEFAULT_TEMPLATES.teleditPreCloseTemplate,
          teleditPostClose1Template: data.teleditPostClose1Template || DEFAULT_TEMPLATES.teleditPostClose1Template,
          teleditPostClose2Template: data.teleditPostClose2Template || DEFAULT_TEMPLATES.teleditPostClose2Template,
          teleditPostClose3Template: data.teleditPostClose3Template || DEFAULT_TEMPLATES.teleditPostClose3Template,
          teleditProfitTemplate: data.teleditProfitTemplate || DEFAULT_TEMPLATES.teleditProfitTemplate,
        }))
        if (data.teleditApiUrl) setTeleditApiUrl(data.teleditApiUrl)
        if (data.teleditEmail) setTeleditEmail(data.teleditEmail)
        if (data.teleditPassword) setTeleditPassword(data.teleditPassword)
        if (data.preEntryMinSec != null) setPreEntryMinSec(data.preEntryMinSec)
        if (data.preEntryMaxSec != null) setPreEntryMaxSec(data.preEntryMaxSec)
        if (data.preCloseMinSec != null) setPreCloseMinSec(data.preCloseMinSec)
        if (data.preCloseMaxSec != null) setPreCloseMaxSec(data.preCloseMaxSec)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [session])

  // ─── Update single template ──────────────────────────────
  const updateTemplate = useCallback((key: TemplateKey, value: string) => {
    setTemplates(prev => ({ ...prev, [key]: value }))
  }, [])

  // ─── Reset single template to default ────────────────────
  const resetTemplate = useCallback((key: TemplateKey) => {
    setTemplates(prev => ({ ...prev, [key]: DEFAULT_TEMPLATES[key] }))
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
          preEntryMinSec,
          preEntryMaxSec,
          preCloseMinSec,
          preCloseMaxSec,
          ...templates,
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
  }, [teleditApiUrl, teleditEmail, teleditPassword, templates])

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
    // Timing
    preEntryMinSec, setPreEntryMinSec,
    preEntryMaxSec, setPreEntryMaxSec,
    preCloseMinSec, setPreCloseMinSec,
    preCloseMaxSec, setPreCloseMaxSec,
    savingTeledit, teleditMsg,
    handleSaveTeledit,
  }
}
