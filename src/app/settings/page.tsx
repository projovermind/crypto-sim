'use client'

import { useState, useRef } from 'react'
import { signOut } from 'next-auth/react'
import { useSettings } from '@/hooks/useSettings'
import NavBar from '@/components/NavBar'
import TemplateSection from '@/components/settings/TemplateSection'
import type { TemplateKey } from '@/hooks/useSettings'

const inputCls =
  'w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50'

const timingInputCls =
  'w-16 bg-binance-bg border border-binance-border rounded px-2 py-1 text-xs text-binance-text text-center focus:outline-none focus:border-binance-yellow/50'

type TabKey = 'account' | 'teledit'

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
const ALL_VARS: { key: string; desc: string }[] = [
  { key: 'symbol',     desc: '코인명' },
  { key: 'side',       desc: 'LONG/SHORT' },
  { key: 'leverage',   desc: '레버리지' },
  { key: 'entryPrice', desc: '체결가' },
  { key: 'inputPrice', desc: '입력가' },
  { key: 'amount',     desc: '투자금' },
  { key: 'quantity',   desc: '수량' },
  { key: 'marginMode', desc: '마진모드' },
  { key: 'takeProfit', desc: 'TP' },
  { key: 'stopLoss',   desc: 'SL' },
  { key: 'closePrice', desc: '청산가' },
  { key: 'pnl',        desc: '손익 USDT' },
  { key: 'roe',        desc: '수익률 %' },
  { key: 'marginModeKR', desc: '마진(한글)' },
  { key: 'memo1',      desc: '메모 1' },
  { key: 'memo2',      desc: '메모 2' },
  { key: 'memo3',      desc: '메모 3' },
  { key: 'name',       desc: '이름' },
  { key: 'nickname1',  desc: '별명 1' },
  { key: 'nickname2',  desc: '별명 2' },
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
      <div className="divide-y divide-binance-border/30">
        {ALL_VARS.map(({ key, desc }) => {
          const isCopied = copied === key
          return (
            <div
              key={key}
              className="flex items-stretch hover:bg-binance-border/20 transition-colors cursor-pointer"
              onClick={() => handleCopy(key)}
              title={`클릭하여 {{${key}}} 복사`}
            >
              <div className="px-3 py-2 flex-1 flex items-center">
                <code className={`font-mono transition-colors ${isCopied ? 'text-green-400' : 'text-binance-yellow'}`}>
                  {isCopied ? '복사됨!' : `{{${key}}}`}
                </code>
              </div>
              <div className="px-3 py-2 text-binance-text-dim border-l border-binance-border/30 flex items-center w-[100px] shrink-0">
                {desc}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  const s = useSettings()
  const [activeTab, setActiveTab] = useState<TabKey>('account')
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [avatarError, setAvatarError] = useState<string | null>(null)
  const avatarInputRef = useRef<HTMLInputElement>(null)

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
            {(['account', 'teledit'] as TabKey[]).map(tab => (
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
                  {tab === 'account' ? (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                      </svg>
                      계정 관리
                    </>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                        <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767A2 2 0 0011 16h2l3 3v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-2z" />
                      </svg>
                      텔레딧 관리
                    </>
                  )}
                </div>
              </button>
            ))}
          </nav>
        </div>

        {/* ─── Content Area ─── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6">

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
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-sm font-bold text-binance-text">텔레딧 관리</h2>
                  <div className="flex items-center gap-2">
                    {s.teleditMsg && (
                      <span className={`text-xs ${s.teleditMsg.includes('실패') ? 'text-binance-red' : 'text-green-400'}`}>
                        {s.teleditMsg}
                      </span>
                    )}
                    <button
                      onClick={s.handleSaveTeledit}
                      disabled={s.savingTeledit}
                      className="px-4 py-1.5 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {s.savingTeledit ? '저장 중...' : '모든 설정 저장'}
                    </button>
                  </div>
                </div>
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
                    />
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
                    />
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
                    />
                  </MessageCard>

                  {/* 5) 포지션 종료 전 */}
                  <MessageCard title="포지션 종료 전" accent="red">
                    <TimingRow
                      prefix="종료" suffix="전"
                      minVal={s.preCloseMinSec} onMin={s.setPreCloseMinSec}
                      maxVal={s.preCloseMaxSec} onMax={s.setPreCloseMaxSec}
                    />
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
                    />
                  </MessageCard>

                  {/* 6) 포지션 종료 */}
                  <MessageCard title="포지션 종료" accent="red">
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
                    />
                  </MessageCard>

                  {/* 7) 수익 인증 1 (자동 생성) */}
                  <MessageCard title="수익 인증 1" accent="yellow">
                    <TimingRow
                      prefix="종료 후"
                      minVal={s.profit1MinSec} onMin={s.setProfit1MinSec}
                      maxVal={s.profit1MaxSec} onMax={s.setProfit1MaxSec}
                    />
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
                    />
                  </MessageCard>

                </div>

                {/* ── Save Button ── */}
                <div className="flex items-center justify-end gap-3 pb-6">
                  {s.teleditMsg && (
                    <span className={`text-[11px] ${s.teleditMsg.startsWith('오류') ? 'text-red-400' : 'text-green-400'}`}>
                      {s.teleditMsg}
                    </span>
                  )}
                  <button
                    onClick={s.handleSaveTeledit}
                    disabled={s.savingTeledit}
                    className="px-5 py-2 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {s.savingTeledit ? '저장 중...' : '모든 설정 저장'}
                  </button>
                </div>

                </div>{/* end left */}
                {/* ── Right: variable reference panel ── */}
                <div className="w-[280px] shrink-0 sticky top-6">
                  <VarReferencePanel />
                </div>
                </div>{/* end flex */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
