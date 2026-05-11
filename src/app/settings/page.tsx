'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { signOut } from 'next-auth/react'
import { useSettings } from '@/hooks/useSettings'
import NavBar from '@/components/NavBar'
import TemplateSection from '@/components/settings/TemplateSection'
import type { TemplateKey } from '@/hooks/useSettings'

const inputCls =
  'w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50'

const timingInputCls =
  'w-16 bg-binance-bg border border-binance-border rounded px-2 py-1 text-xs text-binance-text text-center focus:outline-none focus:border-binance-yellow/50'

type TabKey = 'account' | 'teledit' | 'messages' | 'guide'

// ─── TeleditMessage type ──────────────────────────────────────
interface TeleditMsg {
  id: string
  messageNumber: number
  content: string
  imageUrl: string | null
  commentMin: number
  commentMax: number
  heartMin: number
  heartMax: number
  thumbMin: number
  thumbMax: number
  fireMin: number
  fireMax: number
  sendTime: string
  visible: boolean
}

// ─── TimingRow: inline timing min/max input ───────────────────
function TimingRow({
  prefix, suffix,
  minVal, onMin,
  maxVal, onMax,
}: {
  prefix: string
  suffix?: string
  minVal: number; onMin: (v: number) => void
  maxVal: number; onMax: (v: number) => void
}) {
  return (
    <div className="mb-3 px-3 py-2.5 bg-binance-bg rounded border border-binance-border/50">
      <div className="flex items-center gap-1.5 text-[11px] text-binance-text-dim">
        <span>{prefix}{suffix ? ` ${suffix}` : ''}</span>
        <input
          type="number" min={0} value={minVal}
          onChange={e => onMin(Number(e.target.value))}
          className={timingInputCls}
        />
        <span>초 ~</span>
        <input
          type="number" min={0} value={maxVal}
          onChange={e => onMax(Number(e.target.value))}
          className={timingInputCls}
        />
        <span>초 사이 난수로 발송</span>
      </div>
    </div>
  )
}

const commentInputCls =
  'w-14 bg-binance-bg border border-binance-border rounded px-2 py-1 text-xs text-binance-text text-center focus:outline-none focus:border-binance-yellow/50'

// ─── CommentRow: comment count min/max input ─────────────────
function CommentRow({
  minVal, onMin,
  maxVal, onMax,
}: {
  minVal: number; onMin: (v: number) => void
  maxVal: number; onMax: (v: number) => void
}) {
  const isEmpty = minVal === 0 && maxVal === 0
  return (
    <div className="mb-3 px-3 py-2.5 bg-binance-bg rounded border border-binance-border/50">
      <div className="flex items-center gap-1.5 text-[11px] text-binance-text-dim">
        <span>댓글</span>
        <input
          type="number" min={0} max={110} value={minVal}
          onChange={e => onMin(Math.min(Number(e.target.value), 110))}
          className={commentInputCls}
        />
        <span>개 ~</span>
        <input
          type="number" min={0} max={110} value={maxVal}
          onChange={e => onMax(Math.min(Number(e.target.value), 110))}
          className={commentInputCls}
        />
        <span>개</span>
        {isEmpty && <span className="text-binance-text-dim/50">(댓글 없음)</span>}
      </div>
    </div>
  )
}

const rxInputCls = 'w-11 bg-binance-bg border border-binance-border rounded px-1 py-1 text-[10px] text-binance-text text-center focus:outline-none focus:border-binance-yellow/50'

// ─── ReactionRow: ❤️👍🔥 min~max per message type ──────────
function ReactionRow({
  msgType, settings, onUpdate,
}: {
  msgType: string
  settings: { heart: [number, number]; thumb: [number, number]; fire: [number, number] }
  onUpdate: (msgType: string, emoji: 'heart' | 'thumb' | 'fire', idx: 0 | 1, val: number) => void
}) {
  const emojis = [
    { key: 'heart' as const, icon: '❤️' },
    { key: 'thumb' as const, icon: '👍' },
    { key: 'fire' as const, icon: '🔥' },
  ]
  return (
    <div className="mb-3 px-3 py-2 bg-binance-bg rounded border border-binance-border/50">
      <div className="flex items-center gap-3 text-[10px] text-binance-text-dim">
        {emojis.map(e => (
          <div key={e.key} className="flex items-center gap-0.5">
            <span>{e.icon}</span>
            <input type="number" min={0} max={999} value={settings[e.key][0]}
              onChange={ev => onUpdate(msgType, e.key, 0, Math.min(Number(ev.target.value), 999))}
              className={rxInputCls} />
            <span>~</span>
            <input type="number" min={0} max={999} value={settings[e.key][1]}
              onChange={ev => onUpdate(msgType, e.key, 1, Math.min(Number(ev.target.value), 999))}
              className={rxInputCls} />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── MessageCard: wrapper for each template card ─────────────
function MessageCard({ children, title, accent }: {
  children: React.ReactNode
  title: string
  accent: 'green' | 'red' | 'yellow'
}) {
  const accentCls = accent === 'green'
    ? 'border-l-green-500'
    : accent === 'red'
    ? 'border-l-red-500'
    : 'border-l-yellow-500'

  return (
    <div className={`bg-binance-card border border-binance-border rounded-lg p-4 border-l-[3px] ${accentCls}`}>
      <p className="text-xs font-bold text-binance-text mb-3">{title}</p>
      {children}
    </div>
  )
}

// ─── VarReferencePanel: unified variable reference ────────────
const VAR_CATEGORIES: { label: string; vars: { key: string; desc: string }[] }[] = [
  { label: '포지션 기본', vars: [
    { key: 'symbol',       desc: '코인명' },
    { key: 'side',         desc: 'LONG/SHORT' },
    { key: 'leverage',     desc: '레버리지' },
    { key: 'marginMode',   desc: '마진모드(EN)' },
    { key: 'marginModeKR', desc: '마진모드(KR)' },
  ]},
  { label: '가격', vars: [
    { key: 'entryPrice',   desc: '체결가' },
    { key: 'inputPrice',   desc: '입력가' },
    { key: 'closePrice',   desc: '청산가' },
    { key: 'takeProfit',   desc: 'TP' },
    { key: 'stopLoss',     desc: 'SL' },
  ]},
  { label: '규모 / 손익', vars: [
    { key: 'amount',       desc: '투자금' },
    { key: 'quantity',     desc: '수량' },
    { key: 'pnl',          desc: '손익 USDT' },
    { key: 'roe',          desc: '수익률 %' },
  ]},
  { label: '메모', vars: [
    { key: 'memo1',        desc: '메모 1' },
    { key: 'memo2',        desc: '메모 2' },
    { key: 'memo3',        desc: '메모 3' },
  ]},
  { label: '유저 정보', vars: [
    { key: 'name',         desc: '이름' },
    { key: 'nickname1',    desc: '별명 1' },
    { key: 'nickname2',    desc: '별명 2' },
  ]},
]

function VarReferencePanel() {
  const [copied, setCopied] = useState<string | null>(null)

  const handleCopy = (v: string) => {
    navigator.clipboard.writeText(`{{${v}}}`).then(() => {
      setCopied(v)
      setTimeout(() => setCopied(null), 1500)
    }).catch(() => {})
  }

  return (
    <div className="rounded-lg border border-binance-border overflow-hidden text-[12px]">
      <div className="px-3 py-2.5 bg-binance-card border-b border-binance-border">
        <p className="font-semibold text-binance-text text-[13px]">변수 레퍼런스</p>
        <p className="text-binance-text-dim/70 mt-0.5 text-[11px]">클릭하면 복사됩니다 · 숫자는 가격 크기에 따라 자동 포맷</p>
      </div>
      {VAR_CATEGORIES.map(cat => (
        <div key={cat.label}>
          <div className="px-3 py-1.5 bg-binance-bg/50 border-b border-binance-border/30 text-[10px] font-semibold text-binance-text-dim uppercase tracking-wider">
            {cat.label}
          </div>
          <div className="divide-y divide-binance-border/20">
            {cat.vars.map(({ key, desc }) => {
              const isCopied = copied === key
              return (
                <div
                  key={key}
                  className="flex items-stretch hover:bg-binance-border/20 transition-colors cursor-pointer"
                  onClick={() => handleCopy(key)}
                  title={`클릭하여 {{${key}}} 복사`}
                >
                  <div className="px-3 py-1.5 flex-1 flex items-center">
                    <code className={`font-mono transition-colors ${isCopied ? 'text-green-400' : 'text-binance-yellow'}`}>
                      {isCopied ? '복사됨!' : `{{${key}}}`}
                    </code>
                  </div>
                  <div className="px-3 py-1.5 text-binance-text-dim border-l border-binance-border/30 flex items-center w-[100px] shrink-0">
                    {desc}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function SettingsPage() {
  const s = useSettings()
  const [activeTab, setActiveTab] = useState<TabKey>('account')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

  // ── Custom Messages State ──
  const [cmList, setCmList] = useState<TeleditMsg[]>([])
  const [cmLoading, setCmLoading] = useState(false)
  const [cmEditingId, setCmEditingId] = useState<string | null>(null) // null = 신규, id = 수정
  const [cmForm, setCmForm] = useState({
    content: '', sendTime: '', imageUrl: null as string | null,
    commentMin: 0, commentMax: 0,
    heartMin: null as number | null, heartMax: null as number | null, thumbMin: null as number | null, thumbMax: null as number | null, fireMin: null as number | null, fireMax: null as number | null,
  })
  const [cmImageUploading, setCmImageUploading] = useState(false)
  const cmImageRef = useRef<HTMLInputElement>(null)

  const fetchCmList = useCallback(async () => {
    setCmLoading(true)
    try {
      const res = await fetch('/api/teledit-messages')
      if (res.ok) setCmList(await res.json())
    } catch {} finally { setCmLoading(false) }
  }, [])

  useEffect(() => { if (activeTab === 'messages') fetchCmList() }, [activeTab, fetchCmList])

  const handleCmSave = async () => {
    if (!cmForm.sendTime) { alert('전송 시간을 입력하세요'); return }
    if (!cmForm.content.trim() && !cmForm.imageUrl) { alert('메시지 내용 또는 이미지를 입력하세요'); return }
    const body: any = { ...cmForm }
    if (cmEditingId) body.id = cmEditingId
    const method = cmEditingId ? 'PATCH' : 'POST'
    await fetch('/api/teledit-messages', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    setCmEditingId(null)
    setCmForm({ content: '', sendTime: '', imageUrl: null as string | null, commentMin: 0, commentMax: 0, heartMin: null as number | null, heartMax: null as number | null, thumbMin: null as number | null, thumbMax: null as number | null, fireMin: null as number | null, fireMax: null as number | null })
    fetchCmList()
  }

  const handleCmDelete = async (id: string) => {
    if (!confirm('삭제하시겠습니까?')) return
    await fetch(`/api/teledit-messages?id=${id}`, { method: 'DELETE' })
    fetchCmList()
  }

  const handleCmToggle = async (id: string, visible: boolean) => {
    await fetch('/api/teledit-messages', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, visible }) })
    setCmList(prev => prev.map(m => m.id === id ? { ...m, visible } : m))
  }

  const handleCmImageUpload = async (file: File) => {
    if (file.size > 10 * 1024 * 1024) { alert('최대 10MB'); return }
    setCmImageUploading(true)
    try {
      const fd = new FormData(); fd.append('file', file)
      const res = await fetch('/api/teledit-messages/image', { method: 'POST', body: fd })
      if (res.ok) { const d = await res.json(); setCmForm(prev => ({ ...prev, imageUrl: d.url })) }
    } catch {} finally { setCmImageUploading(false) }
  }

  const handleAvatarUpload = async (file: File) => {
    if (file.size > 2 * 1024 * 1024) {
      alert('최대 2MB까지 업로드 가능합니다')
      return
    }
    setAvatarUploading(true)
    setAvatarError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/user/channel-avatar', { method: 'POST', body: fd })
      if (!res.ok) throw new Error('업로드 실패')
      const data = await res.json()
      s.setChannelAvatarUrl(data.url)
    } catch {
      setAvatarError('이미지 업로드에 실패했습니다')
    } finally {
      setAvatarUploading(false)
    }
  }

  if (s.status === 'loading' || s.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-binance-bg">
        <div className="flex items-center gap-3 text-binance-text-dim">
          <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          로딩 중...
        </div>
      </div>
    )
  }

  if (!s.session) return null

  return (
    <div className="h-screen flex flex-col bg-binance-bg overflow-hidden">
      <NavBar
        session={s.session}
        onLogout={() => signOut({ callbackUrl: '/login' })}
      />

      <div className="flex-1 flex min-h-0">
        {/* ─── Left Sidebar ─── */}
        <div className="w-[200px] shrink-0 border-r border-binance-border flex flex-col">
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="flex items-center gap-2 px-4 py-3 text-xs text-binance-text-dim hover:text-binance-yellow transition-colors border-b border-binance-border"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            대시보드로 돌아가기
          </button>

          <nav className="flex-1 py-2">
            {(['account', 'teledit', 'messages', 'guide'] as TabKey[]).map(tab => {
              const labels: Record<TabKey, string> = {
                account: '계정 관리',
                teledit: '텔레딧 관리',
                messages: '메시지 삽입',
                guide: '텔레딧 가이드',
              }
              const icons: Record<TabKey, React.ReactNode> = {
                account: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                  </svg>
                ),
                teledit: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                    <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767A2 2 0 0011 16h2l3 3v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-2z" />
                  </svg>
                ),
                messages: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z" />
                    <path fillRule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clipRule="evenodd" />
                  </svg>
                ),
                guide: (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                ),
              }
              return (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                    activeTab === tab
                      ? 'text-binance-yellow bg-binance-yellow/5 border-r-2 border-binance-yellow'
                      : 'text-binance-text-dim hover:text-binance-text hover:bg-binance-hover/10'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {icons[tab]}
                    {labels[tab]}
                  </div>
                </button>
              )
            })}
          </nav>
        </div>

        {/* ─── Content Area ─── */}
        <div className="flex-1 overflow-y-auto">
          <div className={`mx-auto p-6 ${activeTab === 'messages' ? 'max-w-6xl' : 'max-w-3xl'}`}>

            {/* ── Account Management Tab ── */}
            {activeTab === 'account' && (
              <div className="animate-fade-in">
                <h2 className="text-sm font-bold text-binance-text mb-5">계정 관리</h2>

                {/* ── Profile Info ── */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 mb-4">
                  <h3 className="text-xs font-medium text-binance-text-dim mb-3">프로필 정보</h3>
                  <div className="space-y-2.5 max-w-md">
                    <div>
                      <label className="block text-[11px] text-binance-text-dim mb-1">이름 <span className="text-red-400">*</span></label>
                      <input
                        type="text"
                        value={s.name}
                        onChange={e => s.setName(e.target.value)}
                        placeholder="이름"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-binance-text-dim mb-1">별명 1</label>
                      <input
                        type="text"
                        value={s.nickname1}
                        onChange={e => s.setNickname1(e.target.value)}
                        placeholder="별명1 (선택)"
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-binance-text-dim mb-1">별명 2</label>
                      <input
                        type="text"
                        value={s.nickname2}
                        onChange={e => s.setNickname2(e.target.value)}
                        placeholder="별명2 (선택)"
                        className={inputCls}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={s.handleSaveProfile}
                      disabled={s.savingProfile}
                      className="px-4 py-2 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {s.savingProfile ? '저장 중...' : '프로필 저장'}
                    </button>
                    {s.profileMsg && (
                      <span className={`text-[11px] ${s.profileMsg.includes('저장되었') ? 'text-green-400' : 'text-red-400'}`}>
                        {s.profileMsg}
                      </span>
                    )}
                  </div>
                </div>

                {/* ── Password Change ── */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5">
                  <h3 className="text-xs font-medium text-binance-text-dim mb-3">비밀번호 변경</h3>
                  <div className="space-y-2.5 max-w-md">
                    <input
                      type="password"
                      value={s.currentPw}
                      onChange={e => s.setCurrentPw(e.target.value)}
                      placeholder="현재 비밀번호"
                      className={inputCls}
                    />
                    <input
                      type="password"
                      value={s.newPw}
                      onChange={e => s.setNewPw(e.target.value)}
                      placeholder="새 비밀번호 (4자 이상)"
                      className={inputCls}
                    />
                    <input
                      type="password"
                      value={s.newPwConfirm}
                      onChange={e => s.setNewPwConfirm(e.target.value)}
                      placeholder="새 비밀번호 확인"
                      className={inputCls}
                    />
                  </div>
                  <div className="flex items-center gap-3 mt-4">
                    <button
                      onClick={s.handleChangePassword}
                      disabled={s.savingPw}
                      className="px-4 py-2 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {s.savingPw ? '변경 중...' : '비밀번호 변경'}
                    </button>
                    {s.pwMsg && (
                      <span className={`text-[11px] ${s.pwMsg.includes('변경되었') ? 'text-green-400' : 'text-red-400'}`}>
                        {s.pwMsg}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Teledit Management Tab ── */}
            {activeTab === 'teledit' && (
              <div className="animate-fade-in">
                <h2 className="text-sm font-bold text-binance-text mb-5">텔레딧 관리</h2>
                <div className="flex gap-5 items-start">
                {/* ── Left: message cards ── */}
                <div className="flex-1 min-w-0 space-y-6">

                {/* ── Channel Info ── */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5">
                  <h3 className="text-xs font-medium text-binance-text-dim mb-3">채널 정보</h3>
                  <div className="space-y-2.5 max-w-lg">
                    <div>
                      <label className="block text-[11px] text-binance-text-dim mb-1">채널명</label>
                      <input
                        type="text"
                        value={s.channelName}
                        onChange={e => s.setChannelName(e.target.value)}
                        placeholder="채널명"
                        className={inputCls}
                      />
                      {s.channelName && (
                        <p className="text-[10px] text-binance-text-dim mt-1">
                          미리보기: <span className="text-binance-text">{s.channelName}{s.channelGeneration != null ? ` ${s.channelGeneration}기` : ''}</span>
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] text-binance-text-dim mb-1">기수</label>
                      <div className="flex items-center gap-3">
                        <input
                          type="number" min={0}
                          value={s.channelGeneration ?? ''}
                          onChange={e => s.setChannelGeneration(e.target.value === '' ? null : Number(e.target.value))}
                          placeholder="미입력 시 표시안함"
                          className={inputCls + ' w-20'}
                        />
                        <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-binance-text-dim">
                          <input
                            type="checkbox"
                            checked={s.genAutoIncrement}
                            onChange={e => s.setGenAutoIncrement(e.target.checked)}
                            className="accent-binance-yellow w-3.5 h-3.5"
                          />
                          매월 1일 자동 +1
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] text-binance-text-dim mb-1">구독자수</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={0}
                          value={s.subscriberCount}
                          onChange={e => { s.setSubscriberCount(Number(e.target.value) || 0); s.setSubscriberDirty(true) }}
                          className={inputCls + ' w-20'}
                        />
                        <span className="text-[11px] text-binance-text-dim">명</span>
                        <button
                          type="button"
                          onClick={() => { s.setSubscriberCount(800 + Math.floor(Math.random() * 301)); s.setSubscriberDirty(true) }}
                          className="px-2 py-1 text-[10px] bg-binance-bg border border-binance-border rounded text-binance-yellow hover:bg-binance-border/30"
                        >
                          초기화 (800~1100)
                        </button>
                      </div>
                      <p className="text-[10px] text-binance-text-dim/60 mt-1">매월 1일 자동 초기화 (800~1100 랜덤) · 매일 12시 +17~31명 자동 증가</p>
                    </div>
                    <div>
                      <label className="block text-[11px] text-binance-text-dim mb-1.5">채널 아바타</label>
                      <div className="flex items-center gap-3">
                        {s.channelAvatarUrl ? (
                          <img
                            src={s.channelAvatarUrl}
                            alt="채널 아바타"
                            className="w-12 h-12 rounded-full object-cover border border-binance-border"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-binance-bg border border-binance-border flex items-center justify-center">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-binance-text-dim/40" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                            </svg>
                          </div>
                        )}
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0]
                            if (file) handleAvatarUpload(file)
                            e.target.value = ''
                          }}
                        />
                        <button
                          type="button"
                          disabled={avatarUploading}
                          onClick={() => avatarInputRef.current?.click()}
                          className="px-3 py-1.5 text-[11px] bg-binance-bg border border-binance-border rounded text-binance-yellow hover:bg-binance-border/30 transition-colors disabled:opacity-50"
                        >
                          {avatarUploading ? 'loading...' : '이미지 업로드'}
                        </button>
                        {s.channelAvatarUrl && (
                          <button
                            type="button"
                            onClick={() => s.setChannelAvatarUrl('')}
                            className="px-3 py-1.5 text-[11px] bg-binance-bg border border-binance-border rounded text-binance-red hover:bg-binance-red/10 transition-colors"
                          >
                            삭제
                          </button>
                        )}
                      </div>
                      {avatarError && (
                        <p className="text-[11px] text-red-400 mt-1.5">{avatarError}</p>
                      )}
                    </div>
                  </div>
                </div>

                {/* ── Flat card list: individual messages ── */}
                <div className="space-y-3">

                  {/* 1) 포지션 진입 전 */}
                  <MessageCard title="포지션 진입 전" accent="green">
                    <TimingRow
                      prefix="진입" suffix="전"
                      minVal={s.preEntryMinSec} onMin={s.setPreEntryMinSec}
                      maxVal={s.preEntryMaxSec} onMax={s.setPreEntryMaxSec}
                    />
                    <ReactionRow msgType="preEntry" settings={s.reactionSettings.preEntry} onUpdate={s.updateReaction} />
                    <CommentRow
                      minVal={s.preEntryCommentMin} onMin={s.setPreEntryCommentMin}
                      maxVal={s.preEntryCommentMax} onMax={s.setPreEntryCommentMax}
                    />
                    <TemplateSection
                      title="템플릿"
                      templateKey="teleditPreEntryTemplate"
                      value={s.templates.teleditPreEntryTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="entry"
                      enabled={s.templateEnabled.teleditPreEntryTemplate}
                      onToggleEnabled={s.updateEnabled}
                      imageUrl={s.teleditTemplateImages?.['teleditPreEntryTemplate']}
                      onImageChange={s.updateTemplateImage}
                      onImageRemove={s.removeTemplateImage}
                    />
                  </MessageCard>

                  {/* 2) 포지션 진입 (LONG + SHORT 통합) */}
                  <MessageCard title="포지션 진입" accent="green">
                    <TemplateSection
                      title="LONG"
                      templateKey="teledditLongTemplate"
                      value={s.templates.teledditLongTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="entry"
                      enabled={s.templateEnabled.teledditLongTemplate}
                      onToggleEnabled={s.updateEnabled}
                      imageUrl={s.teleditTemplateImages?.['teledditLongTemplate']}
                      onImageChange={s.updateTemplateImage}
                      onImageRemove={s.removeTemplateImage}
                    />
                    <ReactionRow msgType="long" settings={s.reactionSettings.long} onUpdate={s.updateReaction} />
                    <CommentRow
                      minVal={s.longCommentMin} onMin={s.setLongCommentMin}
                      maxVal={s.longCommentMax} onMax={s.setLongCommentMax}
                    />
                    <div className="my-3 border-t border-binance-border/40" />
                    <TemplateSection
                      title="SHORT"
                      templateKey="teledditShortTemplate"
                      value={s.templates.teledditShortTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="entry"
                      enabled={s.templateEnabled.teledditShortTemplate}
                      onToggleEnabled={s.updateEnabled}
                      imageUrl={s.teleditTemplateImages?.['teledditShortTemplate']}
                      onImageChange={s.updateTemplateImage}
                      onImageRemove={s.removeTemplateImage}
                    />
                    <ReactionRow msgType="short" settings={s.reactionSettings.short} onUpdate={s.updateReaction} />
                    <CommentRow
                      minVal={s.shortCommentMin} onMin={s.setShortCommentMin}
                      maxVal={s.shortCommentMax} onMax={s.setShortCommentMax}
                    />
                  </MessageCard>

                  {/* 4) 포지션 진입 후 */}
                  <MessageCard title="포지션 진입 후" accent="green">
                    <TimingRow
                      prefix="진입 후"
                      minVal={s.postEntryMinSec} onMin={s.setPostEntryMinSec}
                      maxVal={s.postEntryMaxSec} onMax={s.setPostEntryMaxSec}
                    />
                    <ReactionRow msgType="postEntry" settings={s.reactionSettings.postEntry} onUpdate={s.updateReaction} />
                    <CommentRow
                      minVal={s.postEntryCommentMin} onMin={s.setPostEntryCommentMin}
                      maxVal={s.postEntryCommentMax} onMax={s.setPostEntryCommentMax}
                    />
                    <TemplateSection
                      title="템플릿"
                      templateKey="teleditPostEntryTemplate"
                      value={s.templates.teleditPostEntryTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="entry"
                      enabled={s.templateEnabled.teleditPostEntryTemplate}
                      onToggleEnabled={s.updateEnabled}
                      imageUrl={s.teleditTemplateImages?.['teleditPostEntryTemplate']}
                      onImageChange={s.updateTemplateImage}
                      onImageRemove={s.removeTemplateImage}
                    />
                  </MessageCard>

                  {/* 5) 포지션 종료 전 */}
                  <MessageCard title="포지션 종료 전" accent="red">
                    <TimingRow
                      prefix="종료" suffix="전"
                      minVal={s.preCloseMinSec} onMin={s.setPreCloseMinSec}
                      maxVal={s.preCloseMaxSec} onMax={s.setPreCloseMaxSec}
                    />
                    <ReactionRow msgType="preClose" settings={s.reactionSettings.preClose} onUpdate={s.updateReaction} />
                    <CommentRow
                      minVal={s.preCloseCommentMin} onMin={s.setPreCloseCommentMin}
                      maxVal={s.preCloseCommentMax} onMax={s.setPreCloseCommentMax}
                    />
                    <TemplateSection
                      title="템플릿"
                      templateKey="teleditPreCloseTemplate"
                      value={s.templates.teleditPreCloseTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="close"
                      enabled={s.templateEnabled.teleditPreCloseTemplate}
                      onToggleEnabled={s.updateEnabled}
                      imageUrl={s.teleditTemplateImages?.['teleditPreCloseTemplate']}
                      onImageChange={s.updateTemplateImage}
                      onImageRemove={s.removeTemplateImage}
                    />
                  </MessageCard>

                  {/* 6) 포지션 종료 */}
                  <MessageCard title="포지션 종료" accent="red">
                    <ReactionRow msgType="close" settings={s.reactionSettings.close} onUpdate={s.updateReaction} />
                    <CommentRow
                      minVal={s.closeCommentMin} onMin={s.setCloseCommentMin}
                      maxVal={s.closeCommentMax} onMax={s.setCloseCommentMax}
                    />
                    <TemplateSection
                      title="템플릿"
                      templateKey="teleditCloseTemplate"
                      value={s.templates.teleditCloseTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="close"
                      enabled={s.templateEnabled.teleditCloseTemplate}
                      onToggleEnabled={s.updateEnabled}
                      imageUrl={s.teleditTemplateImages?.['teleditCloseTemplate']}
                      onImageChange={s.updateTemplateImage}
                      onImageRemove={s.removeTemplateImage}
                    />
                  </MessageCard>

                  {/* 7) 수익 인증 1 (자동 생성) */}
                  <MessageCard title="수익 인증 1" accent="yellow">
                    <TimingRow
                      prefix="종료 후"
                      minVal={s.profit1MinSec} onMin={s.setProfit1MinSec}
                      maxVal={s.profit1MaxSec} onMax={s.setProfit1MaxSec}
                    />
                    <ReactionRow msgType="profit1" settings={s.reactionSettings.profit1} onUpdate={s.updateReaction} />
                    <CommentRow
                      minVal={s.profit1CommentMin} onMin={s.setProfit1CommentMin}
                      maxVal={s.profit1CommentMax} onMax={s.setProfit1CommentMax}
                    />
                    <div className="flex items-center gap-2 mb-2.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-binance-border/60 text-binance-text-dim">자동 생성</span>
                    </div>
                    <div className="flex gap-2.5 items-start">
                      <div className="flex-1 p-3 rounded bg-binance-bg border border-binance-border/50">
                        <p className="text-[11px] text-binance-text-dim leading-relaxed">
                          포지션 종료 시 <span className="text-binance-text">랜덤 배경 카드 이미지</span>가 자동으로 생성됩니다.
                          수익/손실 정보가 포함된 카드 이미지로 별도 템플릿 설정이 없습니다.
                        </p>
                      </div>
                      <div className="shrink-0 w-[120px] h-[60px] rounded border border-binance-border/50 bg-gradient-to-br from-binance-yellow/10 to-binance-green/10 flex items-center justify-center">
                        <span className="text-[10px] text-binance-text-dim">카드 이미지</span>
                      </div>
                    </div>
                  </MessageCard>

                  {/* 8) 수익 인증 2 */}
                  <MessageCard title="수익 인증 2" accent="yellow">
                    <TimingRow
                      prefix="수익인증 1 이후"
                      minVal={s.profit2MinSec} onMin={s.setProfit2MinSec}
                      maxVal={s.profit2MaxSec} onMax={s.setProfit2MaxSec}
                    />
                    <ReactionRow msgType="profit2" settings={s.reactionSettings.profit2} onUpdate={s.updateReaction} />
                    <CommentRow
                      minVal={s.profit2CommentMin} onMin={s.setProfit2CommentMin}
                      maxVal={s.profit2CommentMax} onMax={s.setProfit2CommentMax}
                    />
                    <TemplateSection
                      title="템플릿"
                      templateKey="teleditProfitTemplate2"
                      value={s.templates.teleditProfitTemplate2}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="close"
                      enabled={s.templateEnabled.teleditProfitTemplate2}
                      onToggleEnabled={s.updateEnabled}
                      imageUrl={s.teleditTemplateImages?.['teleditProfitTemplate2']}
                      onImageChange={s.updateTemplateImage}
                      onImageRemove={s.removeTemplateImage}
                    />
                  </MessageCard>

                </div>

                </div>{/* end left */}
                {/* ── Right: variable reference panel ── */}
                <div className="w-[280px] shrink-0 sticky top-6 space-y-3">
                  <VarReferencePanel />

                  <button
                    onClick={s.handleSaveTeledit}
                    disabled={s.savingTeledit}
                    className="w-full px-4 py-2.5 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {s.savingTeledit ? '저장 중...' : '모든 설정 저장'}
                  </button>
                  {s.teleditMsg && (
                    <p className={`text-xs text-center ${s.teleditMsg.includes('실패') ? 'text-binance-red' : 'text-green-400'}`}>
                      {s.teleditMsg}
                    </p>
                  )}
                </div>
                </div>{/* end flex */}
              </div>
            )}

            {/* ── Messages Tab ── */}
            {activeTab === 'messages' && (
              <div className="animate-fade-in">
                <h2 className="text-sm font-bold text-binance-text mb-5">텔레딧 메시지 삽입</h2>
                <div className="flex gap-5 items-start">

                  {/* ── 왼쪽: 메시지 입력 ── */}
                  <div className="w-[300px] shrink-0 sticky top-6">
                    <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-3">
                      <div className="flex items-center justify-between">
                        <h3 className="text-xs font-bold text-binance-yellow">{cmEditingId ? '메시지 수정' : '새 메시지'}</h3>
                        {cmEditingId && (
                          <button onClick={() => { setCmEditingId(null); setCmForm({ content: '', sendTime: '', imageUrl: null as string | null, commentMin: 0, commentMax: 0, heartMin: null as number | null, heartMax: null as number | null, thumbMin: null as number | null, thumbMax: null as number | null, fireMin: null as number | null, fireMax: null as number | null }) }} className="text-[10px] text-binance-text-dim hover:text-binance-text">취소</button>
                        )}
                      </div>

                      {/* 내용 */}
                      <div>
                        <label className="text-[11px] text-binance-text-dim block mb-1">내용</label>
                        <textarea
                          value={cmForm.content}
                          onChange={e => setCmForm(prev => ({ ...prev, content: e.target.value }))}
                          className={inputCls + ' h-24 resize-none'}
                          placeholder="이미지만 보낼 경우 비워두세요"
                        />
                      </div>

                      {/* 이미지 */}
                      <div>
                        <label className="text-[11px] text-binance-text-dim block mb-1">이미지</label>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => cmImageRef.current?.click()}
                            disabled={cmImageUploading}
                            className="px-3 py-1.5 bg-binance-bg border border-binance-border rounded text-xs text-binance-text-dim hover:text-binance-text disabled:opacity-50"
                          >
                            {cmImageUploading ? '업로드 중...' : '선택'}
                          </button>
                          <input ref={cmImageRef} type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleCmImageUpload(e.target.files[0]) }} />
                          {cmForm.imageUrl && (
                            <div className="flex items-center gap-2">
                              <img src={cmForm.imageUrl} alt="" className="h-10 w-10 object-cover rounded border border-binance-border" />
                              <button onClick={() => setCmForm(prev => ({ ...prev, imageUrl: null }))} className="text-[10px] text-binance-red hover:underline">제거</button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 전송 시간 */}
                      <div>
                        <label className="text-[11px] text-binance-text-dim block mb-1">전송 시간 (한국 시간)</label>
                        <div className="flex items-center gap-2">
                          <input
                            type="datetime-local"
                            value={(() => {
                              if (!cmForm.sendTime) return ''
                              const d = new Date(cmForm.sendTime)
                              if (isNaN(d.getTime())) return ''
                              // UTC → 로컬(KST) YYYY-MM-DDTHH:MM
                              const offset = d.getTimezoneOffset() * 60000
                              return new Date(d.getTime() - offset).toISOString().slice(0, 16)
                            })()}
                            onChange={e => setCmForm(prev => ({ ...prev, sendTime: e.target.value ? new Date(e.target.value).toISOString() : '' }))}
                            onClick={e => { try { (e.target as any).showPicker() } catch {} }}
                            className={inputCls + ' cursor-pointer flex-1'}
                            style={{ colorScheme: 'dark' }}
                          />
                          <button
                            type="button"
                            onClick={() => setCmForm(prev => ({ ...prev, sendTime: new Date().toISOString() }))}
                            className="px-2.5 py-2 text-[10px] bg-binance-bg border border-binance-border rounded text-binance-yellow hover:bg-binance-border/30 whitespace-nowrap"
                          >지금</button>
                        </div>
                      </div>

                      {/* 반응 개수 */}
                      <div>
                        <label className="text-[11px] text-binance-text-dim block mb-1">반응 <span className="text-binance-text-dim/60">(비우면 20~30 랜덤)</span></label>
                        <div className="space-y-1">
                          {([
                            { label: '❤️', key: 'heart' as const },
                            { label: '👍', key: 'thumb' as const },
                            { label: '🔥', key: 'fire' as const },
                          ]).map(r => {
                            const val = cmForm[`${r.key}Min` as keyof typeof cmForm] as number | null
                            return (
                              <div key={r.key} className="flex items-center gap-1.5 text-[11px] text-binance-text-dim">
                                <span className="w-5">{r.label}</span>
                                <input type="number" min={0} max={999}
                                  value={val != null ? val : ''}
                                  placeholder="랜덤"
                                  onChange={e => { const v = e.target.value === '' ? null : Math.min(Number(e.target.value), 999); setCmForm(prev => ({ ...prev, [`${r.key}Min`]: v, [`${r.key}Max`]: v })) }}
                                  className="flex-1 bg-binance-bg border border-binance-border rounded px-2 py-1 text-[11px] text-binance-text text-center focus:outline-none focus:border-binance-yellow/50"
                                />
                              </div>
                            )
                          })}
                        </div>
                      </div>

                      {/* 댓글 수 */}
                      <div>
                        <label className="text-[11px] text-binance-text-dim block mb-1">댓글 수</label>
                        <div className="flex items-center gap-1.5">
                          <input
                            type="number" min={0} max={110}
                            value={cmForm.commentMin}
                            onChange={e => { const v = Math.min(Number(e.target.value), 110); setCmForm(prev => ({ ...prev, commentMin: v, commentMax: v })) }}
                            className="w-16 bg-binance-bg border border-binance-border rounded px-2 py-2 text-xs text-binance-text text-center focus:outline-none focus:border-binance-yellow/50"
                          />
                          <span className="text-[11px] text-binance-text-dim">개</span>
                        </div>
                      </div>

                      <button onClick={handleCmSave} className="w-full px-4 py-2.5 bg-binance-yellow text-binance-bg text-xs font-bold rounded hover:bg-binance-yellow/90 mt-1">
                        {cmEditingId ? '수정 저장' : '등록'}
                      </button>
                    </div>
                  </div>

                  {/* ── 오른쪽: 등록된 메시지 테이블 ── */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-bold text-binance-text mb-3">등록된 메시지 ({cmList.length})</h3>
                    {cmLoading ? (
                      <div className="text-center text-xs text-binance-text-dim py-10">로딩 중...</div>
                    ) : cmList.length === 0 ? (
                      <div className="text-center text-xs text-binance-text-dim py-10 bg-binance-card border border-binance-border rounded-lg">
                        등록된 메시지가 없습니다
                      </div>
                    ) : (
                      <div className="bg-binance-card border border-binance-border rounded-lg overflow-hidden">
                        <table className="w-full text-xs table-fixed">
                          <colgroup>
                            <col style={{ width: '36px' }} />
                            <col style={{ width: '42px' }} />
                            <col style={{ width: '110px' }} />
                            <col style={{ width: '30%' }} />
                            <col style={{ width: '28px' }} />
                            <col style={{ width: '28px' }} />
                            <col style={{ width: '90px' }} />
                            <col style={{ width: '95px' }} />
                          </colgroup>
                          <thead>
                            <tr className="border-b border-binance-border bg-binance-bg/50">
                              <th className="px-2 py-2 text-left text-[10px] font-semibold text-binance-text-dim">표시</th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold text-binance-text-dim">#</th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold text-binance-text-dim">시간</th>
                              <th className="px-2 py-2 text-left text-[10px] font-semibold text-binance-text-dim">내용</th>
                              <th className="px-1 py-2 text-center text-[10px] font-semibold text-binance-text-dim">🖼</th>
                              <th className="px-1 py-2 text-center text-[10px] font-semibold text-binance-text-dim">💬</th>
                              <th className="px-1 py-2 text-center text-[10px] font-semibold text-binance-text-dim">반응</th>
                              <th className="px-2 py-2 text-right text-[10px] font-semibold text-binance-text-dim"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {[...cmList].sort((a, b) => new Date(a.sendTime).getTime() - new Date(b.sendTime).getTime()).map(m => (
                              <tr
                                key={m.id}
                                className={`border-b border-binance-border/50 last:border-b-0 hover:bg-binance-bg/30 transition-colors ${!m.visible ? 'opacity-40' : ''} ${cmEditingId === m.id ? 'bg-binance-yellow/5' : ''}`}
                              >
                                <td className="px-2 py-2">
                                  <input
                                    type="checkbox"
                                    checked={m.visible}
                                    onChange={e => handleCmToggle(m.id, e.target.checked)}
                                    className="accent-binance-yellow w-3.5 h-3.5 cursor-pointer"
                                  />
                                </td>
                                <td className="px-2 py-2 font-bold text-binance-yellow">#{m.messageNumber}</td>
                                <td className="px-2 py-2 text-binance-text-dim whitespace-nowrap">
                                  {new Date(m.sendTime).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Seoul' })}
                                </td>
                                <td className="px-2 py-2 overflow-hidden text-ellipsis whitespace-nowrap text-binance-text">
                                  {m.content || <span className="text-binance-text-dim italic">(이미지)</span>}
                                </td>
                                <td className="px-1 py-2 text-center">
                                  {m.imageUrl && <span className="text-blue-400">🖼</span>}
                                </td>
                                <td className="px-1 py-2 text-center text-binance-text-dim">
                                  {m.commentMin > 0 ? m.commentMin : ''}
                                </td>
                                <td className="px-1 py-2 text-center text-[10px] text-binance-text-dim whitespace-nowrap">
                                  {m.heartMin != null && m.heartMin > 0 && <span>❤️{m.heartMin} </span>}
                                  {m.thumbMin != null && m.thumbMin > 0 && <span>👍{m.thumbMin} </span>}
                                  {m.fireMin != null && m.fireMin > 0 && <span>🔥{m.fireMin}</span>}
                                </td>
                                <td className="px-2 py-2">
                                  <div className="flex items-center justify-end gap-1.5">
                                    <button
                                      onClick={() => {
                                        setCmEditingId(m.id)
                                        setCmForm({ content: m.content, sendTime: m.sendTime, imageUrl: m.imageUrl, commentMin: m.commentMin, commentMax: m.commentMax, heartMin: m.heartMin ?? 20, heartMax: m.heartMax ?? 30, thumbMin: m.thumbMin ?? 20, thumbMax: m.thumbMax ?? 30, fireMin: m.fireMin ?? 20, fireMax: m.fireMax ?? 30 })
                                      }}
                                      className="px-2 py-0.5 text-[10px] text-binance-text-dim hover:text-binance-yellow bg-binance-bg border border-binance-border rounded hover:border-binance-yellow/50 whitespace-nowrap"
                                    >수정</button>
                                    <button
                                      onClick={() => handleCmDelete(m.id)}
                                      className="px-2 py-0.5 text-[10px] text-binance-text-dim hover:text-binance-red bg-binance-bg border border-binance-border rounded hover:border-binance-red/50 whitespace-nowrap"
                                    >삭제</button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            )}

            {/* ── Guide Tab ── */}
            {activeTab === 'guide' && (
              <div className="animate-fade-in space-y-4">
                <h2 className="text-sm font-bold text-binance-text mb-4">텔레딧 사용 가이드</h2>

                {/* 소개 */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-3">
                  <h3 className="text-xs font-bold text-binance-yellow">Teledit이란?</h3>
                  <p className="text-xs text-binance-text-dim leading-relaxed">Teledit은 CryptoSim의 가상 포지션을 Telegram 채널에 실제 채널 포스트처럼 삽입하는 Chrome 확장 프로그램입니다.</p>
                  <p className="text-xs text-binance-text-dim leading-relaxed">삽입된 포지션은 리액션, 댓글 수, 수익인증 이미지까지 포함되어 실제 채널 포스트와 구분할 수 없습니다.</p>

                  {/* Telegram 다크 UI 목업 */}
                  <div className="mt-3 rounded-xl overflow-hidden border border-[#2b3a4a] bg-[#17212b] p-3 select-none">
                    {/* 채널 헤더 */}
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b border-[#2b3a4a]">
                      <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#5288c1] to-[#2b5278] flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0">C</div>
                      <div>
                        <div className="text-[11px] font-semibold text-white leading-none">Crypto Signals</div>
                        <div className="text-[10px] text-[#6d8099] mt-0.5">4,821 subscribers</div>
                      </div>
                    </div>
                    {/* 포스트 버블 */}
                    <div className="bg-[#182533] rounded-xl rounded-tl-sm px-3 py-2.5 max-w-[92%]">
                      <div className="text-[11px] text-[#e8f4fd] leading-relaxed whitespace-pre-line">{`📊 BTCUSDT LONG 10x\n진입가: 95,420\nTP: 100,000\nSL: 93,000\n\n#BTC #롱포지션`}</div>
                      {/* 이미지 첨부 미리보기 */}
                      <div className="mt-2 rounded-lg overflow-hidden bg-[#0d1117] border border-[#2b3a4a] flex items-center justify-center h-14">
                        <div className="text-center">
                          <div className="text-[18px] mb-0.5">📈</div>
                          <div className="text-[9px] text-[#5288c1]">수익인증 이미지</div>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-2">
                          <span className="flex items-center gap-0.5 text-[10px] text-[#6d8099] bg-[#1e2f3d] rounded-full px-2 py-0.5">🔥 <span className="text-[#e8f4fd]">24</span></span>
                          <span className="flex items-center gap-0.5 text-[10px] text-[#6d8099] bg-[#1e2f3d] rounded-full px-2 py-0.5">❤️ <span className="text-[#e8f4fd]">51</span></span>
                          <span className="flex items-center gap-0.5 text-[10px] text-[#6d8099] bg-[#1e2f3d] rounded-full px-2 py-0.5">👍 <span className="text-[#e8f4fd]">18</span></span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-[#6d8099]">
                          <svg className="w-2.5 h-2.5" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zm0 2.5a1.5 1.5 0 1 1 0 3 1.5 1.5 0 0 1 0-3zm0 9a5.5 5.5 0 0 1-4.33-2.1c.022-.96 2.9-1.49 4.33-1.49s4.308.53 4.33 1.49A5.5 5.5 0 0 1 8 12.5z"/></svg>
                          <span>47</span>
                          <span className="ml-1">2:34 PM</span>
                          <svg className="w-3 h-2.5 text-[#5288c1]" viewBox="0 0 16 11" fill="currentColor"><path d="M11 1L5.5 6.5 3 4M14 1L8.5 6.5"/><path d="M11.5 1l-6 6-2.5-2.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M14.5 1l-6 6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>
                        </div>
                      </div>
                    </div>
                    <div className="mt-1.5 text-[9px] text-[#4a6278] text-right">실제 채널 포스트처럼 표시됩니다</div>
                  </div>
                </div>

                {/* K버전 전환 방법 */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-2">
                  <h3 className="text-xs font-bold text-binance-yellow flex items-center gap-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-binance-yellow text-binance-bg text-[10px] font-black flex-shrink-0">K</span>K 버전으로 전환하는 방법</h3>
                  <p className="text-xs text-binance-text-dim leading-relaxed">Teledit은 반드시 <span className="text-binance-text font-semibold">Telegram Web K 버전</span>에서만 작동합니다.</p>
                  <ol className="text-xs text-binance-text-dim space-y-1.5 list-decimal list-inside mt-1">
                    <li>브라우저에서 <a href="https://web.telegram.org/k/" target="_blank" rel="noopener noreferrer" className="text-binance-yellow hover:underline">web.telegram.org/k/</a> 로 접속</li>
                    <li>기존에 <code className="bg-binance-bg px-1 rounded text-binance-yellow">web.telegram.org/a/</code> (A 버전)을 사용 중이라면 해당 탭 닫기</li>
                    <li>URL 주소가 <code className="bg-binance-bg px-1 rounded text-binance-yellow">/k/</code>로 끝나는지 확인</li>
                  </ol>
                  <p className="text-xs text-binance-yellow mt-1">A 버전(web.telegram.org/a/)에서는 작동하지 않습니다.</p>
                </div>

                {/* Telegram 설정 */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-2">
                  <h3 className="text-xs font-bold text-binance-yellow flex items-center gap-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-binance-yellow text-binance-bg text-[10px] font-black flex-shrink-0">1</span>Telegram Web 설정 (필수)</h3>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">언어 설정: English</h4>
                  <ol className="text-xs text-binance-text-dim space-y-1 list-decimal list-inside">
                    <li>Telegram Web K 좌측 상단 ☰ 메뉴 클릭</li>
                    <li>Settings &rarr; Language &rarr; <span className="text-binance-text font-semibold">English</span> 선택</li>
                  </ol>
                  <p className="text-xs text-binance-yellow mt-1">한국어 등 다른 언어에서는 날짜 헤더가 올바르게 처리되지 않습니다.</p>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">시간 형식: 12시간제</h4>
                  <ol className="text-xs text-binance-text-dim space-y-1 list-decimal list-inside">
                    <li>Settings &rarr; General Settings</li>
                    <li>Time Format &rarr; <span className="text-binance-text font-semibold">12-hour</span> 선택</li>
                  </ol>
                  <p className="text-xs text-binance-text-dim mt-1">24시간제에서는 시간 표시가 맞지 않을 수 있습니다.</p>
                </div>

                {/* 확장 설치 */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-2">
                  <h3 className="text-xs font-bold text-binance-yellow flex items-center gap-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-binance-yellow text-binance-bg text-[10px] font-black flex-shrink-0">2</span>확장 프로그램 설치</h3>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">다운로드</h4>
                  <ol className="text-xs text-binance-text-dim space-y-1 list-decimal list-inside">
                    <li>CryptoSim 대시보드 상단 바에서 Telegram 아이콘(비행기 모양) 클릭</li>
                    <li>또는 관리자에게 extension.zip 파일을 받기</li>
                  </ol>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">Chrome에 설치</h4>
                  <ol className="text-xs text-binance-text-dim space-y-1 list-decimal list-inside">
                    <li>다운로드한 <code className="bg-binance-bg px-1 rounded text-binance-yellow">extension.zip</code> 압축 해제</li>
                    <li>Chrome 주소창에 <code className="bg-binance-bg px-1 rounded text-binance-yellow">chrome://extensions</code> 입력</li>
                    <li>우측 상단 <span className="text-binance-text font-semibold">개발자 모드</span> 토글 켜기</li>
                    <li><span className="text-binance-text font-semibold">압축해제된 확장 프로그램을 로드합니다</span> 클릭</li>
                    <li>압축 해제한 폴더 선택</li>
                  </ol>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">업데이트</h4>
                  <ol className="text-xs text-binance-text-dim space-y-1 list-decimal list-inside">
                    <li>새 extension.zip 다운로드 후 기존 폴더에 덮어쓰기</li>
                    <li><code className="bg-binance-bg px-1 rounded text-binance-yellow">chrome://extensions</code>에서 Teledit 확장의 🔄 새로고침 버튼 클릭</li>
                    <li>Telegram Web 탭에서 F5 (새로고침)</li>
                  </ol>
                </div>

                {/* 로그인 */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-2">
                  <h3 className="text-xs font-bold text-binance-yellow flex items-center gap-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-binance-yellow text-binance-bg text-[10px] font-black flex-shrink-0">3</span>로그인</h3>
                  <ol className="text-xs text-binance-text-dim space-y-1 list-decimal list-inside">
                    <li>Telegram Web K에서 채널 열기</li>
                    <li>Chrome 우측 상단 확장 아이콘 &rarr; Teledit 클릭</li>
                    <li>CryptoSim 계정의 아이디/비밀번호 입력 후 로그인</li>
                  </ol>
                  <p className="text-xs text-binance-text-dim mt-1">로그인 상태는 브라우저에 저장되며, 로그아웃하기 전까지 유지됩니다.</p>
                </div>

                {/* 포지션 삽입 */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-2">
                  <h3 className="text-xs font-bold text-binance-yellow flex items-center gap-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-binance-yellow text-binance-bg text-[10px] font-black flex-shrink-0">4</span>포지션 삽입</h3>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">팝업에서 삽입</h4>
                  <ol className="text-xs text-binance-text-dim space-y-1 list-decimal list-inside">
                    <li>Teledit 팝업에서 삽입할 포지션 체크</li>
                    <li><span className="text-binance-text font-semibold">체크된 포지션 삽입</span> 버튼 클릭</li>
                  </ol>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">단축키로 삽입</h4>
                  <p className="text-xs text-binance-text-dim">
                    <kbd className="bg-binance-bg border border-binance-border px-2 py-0.5 rounded text-binance-text font-mono">Alt</kbd> + <kbd className="bg-binance-bg border border-binance-border px-2 py-0.5 rounded text-binance-text font-mono">E</kbd> : 전체 포지션 한번에 삽입 (팝업 안 열어도 됨)
                  </p>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">삽입 규칙</h4>
                  <ul className="text-xs text-binance-text-dim space-y-1 list-disc list-inside">
                    <li>현재 Telegram에 로드된 채팅 시간 범위 안의 포지션만 삽입됩니다</li>
                    <li>범위 밖 포지션은 대기(pending) 상태가 됩니다</li>
                    <li>스크롤하면서 해당 시간대가 로드되면 자동 삽입됩니다</li>
                  </ul>
                </div>

                {/* 대시보드 연동 */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-2">
                  <h3 className="text-xs font-bold text-binance-yellow flex items-center gap-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-binance-yellow text-binance-bg text-[10px] font-black flex-shrink-0">5</span>대시보드 연동</h3>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">Teledit 표시 체크박스</h4>
                  <p className="text-xs text-binance-text-dim leading-relaxed">CryptoSim 대시보드에서 각 포지션의 Teledit 체크박스를 통해 팝업에 표시할 포지션을 선택합니다.</p>
                  <ul className="text-xs text-binance-text-dim space-y-1 list-disc list-inside">
                    <li>체크 해제된 포지션은 팝업 목록에 나타나지 않습니다</li>
                    <li>현재 포지션/히스토리 모두에서 설정 가능합니다</li>
                  </ul>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">메모 (M1, M2, M3)</h4>
                  <p className="text-xs text-binance-text-dim leading-relaxed">각 포지션에 메모 1~3을 설정하면 템플릿에서 <code className="bg-binance-bg px-1 rounded text-binance-yellow">{`{{memo1}}`}</code> <code className="bg-binance-bg px-1 rounded text-binance-yellow">{`{{memo2}}`}</code> <code className="bg-binance-bg px-1 rounded text-binance-yellow">{`{{memo3}}`}</code> 변수로 사용할 수 있습니다.</p>
                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">채널 설정</h4>
                  <p className="text-xs text-binance-text-dim leading-relaxed">설정 페이지의 텔레딧 관리에서 채널명과 채널 아바타를 등록하면, 포지션 삽입 시 해당 채널의 헤더가 변경됩니다.</p>
                </div>

                {/* 템플릿 */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-2">
                  <h3 className="text-xs font-bold text-binance-yellow flex items-center gap-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-binance-yellow text-binance-bg text-[10px] font-black flex-shrink-0">6</span>메시지 템플릿</h3>
                  <p className="text-xs text-binance-text-dim leading-relaxed">설정 &rarr; 텔레딧 관리에서 각 상황별 메시지 템플릿을 편집할 수 있습니다.</p>

                  {/* Before/After 예시 카드 */}
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <div className="bg-binance-bg border border-binance-border rounded-lg p-3">
                      <div className="text-[10px] font-semibold text-binance-text-dim mb-2 uppercase tracking-wide">템플릿 입력</div>
                      <code className="text-[10px] text-binance-yellow font-mono leading-relaxed whitespace-pre-line block">{`📊 {{symbol}} {{side}} {{leverage}}x\n진입가: {{entryPrice}}\nTP: {{takeProfit}}\nSL: {{stopLoss}}`}</code>
                    </div>
                    <div className="bg-binance-bg border border-binance-yellow/30 rounded-lg p-3">
                      <div className="text-[10px] font-semibold text-binance-yellow mb-2 uppercase tracking-wide">렌더링 결과</div>
                      <div className="text-[10px] text-binance-text font-mono leading-relaxed whitespace-pre-line">{`📊 BTCUSDT LONG 10x\n진입가: 95,420\nTP: 100,000\nSL: 93,000`}</div>
                    </div>
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-1">
                    <div className="h-px flex-1 bg-binance-border" />
                    <span className="text-[10px] text-binance-text-dim px-2">변수는 실제 포지션 데이터로 치환됩니다</span>
                    <div className="h-px flex-1 bg-binance-border" />
                  </div>

                  <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">사용 가능한 변수</h4>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2">
                    {([
                      ['{{symbol}}', '코인명 (BTCUSDT)'],
                      ['{{side}}', 'LONG / SHORT'],
                      ['{{leverage}}', '레버리지'],
                      ['{{entryPrice}}', '체결가'],
                      ['{{inputPrice}}', '입력가'],
                      ['{{closePrice}}', '청산가'],
                      ['{{amount}}', '투자금'],
                      ['{{quantity}}', '수량'],
                      ['{{pnl}}', '손익 (USDT)'],
                      ['{{roe}}', '수익률 (%)'],
                      ['{{takeProfit}}', 'TP'],
                      ['{{stopLoss}}', 'SL'],
                      ['{{marginModeKR}}', '마진모드 (교차/격리)'],
                      ['{{memo1}}', '메모 1'],
                      ['{{memo2}}', '메모 2'],
                      ['{{memo3}}', '메모 3'],
                      ['{{name}}', '이름'],
                      ['{{nickname1}}', '별명 1'],
                      ['{{nickname2}}', '별명 2'],
                    ] as [string, string][]).map(([k, v]) => (
                      <div key={k} className="flex items-center gap-2 py-0.5">
                        <code className="text-binance-yellow font-mono bg-binance-bg px-1.5 py-0.5 rounded text-[11px]">{k}</code>
                        <span className="text-[11px] text-binance-text-dim">{v}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-binance-text-dim mt-2">숫자는 가격 크기에 따라 자동으로 소수점이 결정됩니다.</p>
                </div>

                {/* 수익인증 이미지 */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-2">
                  <h3 className="text-xs font-bold text-binance-yellow flex items-center gap-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-binance-yellow text-binance-bg text-[10px] font-black flex-shrink-0">7</span>수익인증 이미지</h3>
                  <p className="text-xs text-binance-text-dim leading-relaxed">profit1 타입 메시지는 자동으로 수익인증 카드 이미지를 포함합니다.</p>

                  {/* 수익인증 카드 미리보기 */}
                  <div className="mt-3 relative rounded-xl overflow-hidden border border-binance-border" style={{ height: '120px' }}>
                    {/* 포스터 배경 */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/posters/bg1.png"
                      alt="poster bg"
                      className="absolute inset-0 w-full h-full object-cover opacity-80"
                    />
                    {/* 어두운 오버레이 */}
                    <div className="absolute inset-0 bg-black/40" />
                    {/* 텍스트 오버레이 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1">
                      <div className="text-[9px] font-semibold text-white/70 uppercase tracking-widest">Profit Verified</div>
                      <div className="text-2xl font-black text-[#f0b90b] leading-none">+234.56%</div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="text-center">
                          <div className="text-[8px] text-white/50">ROE</div>
                          <div className="text-[11px] font-bold text-white">+234.56%</div>
                        </div>
                        <div className="w-px h-6 bg-white/20" />
                        <div className="text-center">
                          <div className="text-[8px] text-white/50">PnL</div>
                          <div className="text-[11px] font-bold text-green-400">+4,691 USDT</div>
                        </div>
                        <div className="w-px h-6 bg-white/20" />
                        <div className="text-center">
                          <div className="text-[8px] text-white/50">Symbol</div>
                          <div className="text-[11px] font-bold text-white">BTCUSDT</div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute bottom-1.5 right-2 text-[8px] text-white/30">미리보기</div>
                  </div>

                  <ul className="text-xs text-binance-text-dim space-y-1 list-disc list-inside">
                    <li>이미지는 서버에서 실시간 생성됩니다 (satori)</li>
                    <li>Inter 폰트 + 포스터 배경 포함</li>
                    <li>배경은 3종 랜덤 (로켓, 불꽃, 차트)</li>
                  </ul>
                </div>

                {/* 주의사항 */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5 space-y-2">
                  <h3 className="text-xs font-bold text-binance-yellow flex items-center gap-2"><span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-binance-yellow text-binance-bg text-[10px] font-black flex-shrink-0">8</span>주의사항</h3>
                  <ul className="text-xs text-binance-text-dim space-y-1.5 list-disc list-inside">
                    <li>Telegram Web <span className="text-binance-text font-semibold">K 버전</span>만 지원됩니다 (A 버전 불가)</li>
                    <li>언어는 반드시 <span className="text-binance-text font-semibold">English</span>로 설정해야 합니다</li>
                    <li>시간은 <span className="text-binance-text font-semibold">12시간제</span>로 설정해야 합니다</li>
                    <li>채널 뷰에서만 작동합니다 (1:1 채팅, 그룹은 불가)</li>
                    <li>삽입된 포지션은 페이지 새로고침 시 사라집니다 (Telegram의 실제 메시지가 아닙니다)</li>
                    <li>스크롤 시 Telegram의 가상 스크롤에 의해 일부 버블이 일시적으로 사라질 수 있으나, 스크롤하면 다시 나타납니다</li>
                  </ul>
                </div>

                <div className="text-center text-xs text-binance-text-dim pb-2">
                  Teledit &copy; 2026
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
