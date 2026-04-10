'use client'

import { useState } from 'react'
import { signOut } from 'next-auth/react'
import { useSettings } from '@/hooks/useSettings'
import NavBar from '@/components/NavBar'
import TemplateSection from '@/components/settings/TemplateSection'
import type { TemplateKey } from '@/hooks/useSettings'

const inputCls =
  'w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50'

type TabKey = 'account' | 'teledit'

export default function SettingsPage() {
  const s = useSettings()
  const [activeTab, setActiveTab] = useState<TabKey>('account')

  // Loading
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
          {/* Back button */}
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="flex items-center gap-2 px-4 py-3 text-xs text-binance-text-dim hover:text-binance-yellow transition-colors border-b border-binance-border"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9.707 16.707a1 1 0 01-1.414 0l-6-6a1 1 0 010-1.414l6-6a1 1 0 011.414 1.414L5.414 9H17a1 1 0 110 2H5.414l4.293 4.293a1 1 0 010 1.414z" clipRule="evenodd" />
            </svg>
            대시보드로 돌아가기
          </button>

          {/* Tabs */}
          <nav className="flex-1 py-2">
            <button
              onClick={() => setActiveTab('account')}
              className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'account'
                  ? 'text-binance-yellow bg-binance-yellow/5 border-r-2 border-binance-yellow'
                  : 'text-binance-text-dim hover:text-binance-text hover:bg-binance-hover/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                계정 관리
              </div>
            </button>
            <button
              onClick={() => setActiveTab('teledit')}
              className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                activeTab === 'teledit'
                  ? 'text-binance-yellow bg-binance-yellow/5 border-r-2 border-binance-yellow'
                  : 'text-binance-text-dim hover:text-binance-text hover:bg-binance-hover/10'
              }`}
            >
              <div className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                  <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767A2 2 0 0011 16h2l3 3v-3h1a2 2 0 002-2V9a2 2 0 00-2-2h-2z" />
                </svg>
                텔레딧 관리
              </div>
            </button>
          </nav>
        </div>

        {/* ─── Content Area ─── */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto p-6">

            {/* ── Account Management Tab ── */}
            {activeTab === 'account' && (
              <div className="animate-fade-in">
                <h2 className="text-sm font-bold text-binance-text mb-5">계정 관리</h2>

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
              <div className="animate-fade-in space-y-6">
                <h2 className="text-sm font-bold text-binance-text mb-5">텔레딧 관리</h2>

                {/* ── Connection Info ── */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5">
                  <h3 className="text-xs font-medium text-binance-text-dim mb-3">Teledit 연결 정보</h3>
                  <div className="space-y-2.5 max-w-lg">
                    <input
                      type="text"
                      value={s.teleditApiUrl}
                      onChange={e => s.setTeleditApiUrl(e.target.value)}
                      placeholder="API URL (예: https://teledit.example.com)"
                      className={inputCls}
                    />
                    <input
                      type="text"
                      value={s.teleditEmail}
                      onChange={e => s.setTeleditEmail(e.target.value)}
                      placeholder="이메일"
                      className={inputCls}
                    />
                    <input
                      type="password"
                      value={s.teleditPassword}
                      onChange={e => s.setTeleditPassword(e.target.value)}
                      placeholder="비밀번호"
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* ── 진입 시 Section ── */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-4 bg-binance-green rounded-full" />
                    <h3 className="text-xs font-bold text-binance-text">포지션 진입 시</h3>
                  </div>
                  <div className="space-y-4">
                    {/* 진입 전 발송 타이밍 */}
                    <div>
                      <p className="text-[11px] font-medium text-binance-text-dim mb-2">진입 전 발송 타이밍</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-binance-text-dim">최소</span>
                        <input
                          type="number"
                          min={0}
                          value={s.preEntryMinSec}
                          onChange={e => s.setPreEntryMinSec(Number(e.target.value))}
                          className="w-20 bg-binance-bg border border-binance-border rounded px-2 py-1.5 text-xs text-binance-text text-center focus:outline-none focus:border-binance-yellow/50"
                        />
                        <span className="text-[11px] text-binance-text-dim">초 ~</span>
                        <span className="text-[11px] text-binance-text-dim">최대</span>
                        <input
                          type="number"
                          min={0}
                          value={s.preEntryMaxSec}
                          onChange={e => s.setPreEntryMaxSec(Number(e.target.value))}
                          className="w-20 bg-binance-bg border border-binance-border rounded px-2 py-1.5 text-xs text-binance-text text-center focus:outline-none focus:border-binance-yellow/50"
                        />
                        <span className="text-[11px] text-binance-text-dim">초 전</span>
                      </div>
                    </div>
                    <div className="border-t border-binance-border" />
                    <TemplateSection
                      title="진입 N~N1초 전"
                      templateKey="teleditPreEntryTemplate"
                      value={s.templates.teleditPreEntryTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="entry"
                    />
                    <div className="border-t border-binance-border" />
                    <TemplateSection
                      title="진입"
                      templateKey="teledditTemplate"
                      value={s.templates.teledditTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="entry"
                    />
                    <div className="border-t border-binance-border" />
                    <TemplateSection
                      title="진입 N분 후 1"
                      templateKey="teleditPostEntry1Template"
                      value={s.templates.teleditPostEntry1Template}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="entry"
                    />
                    <TemplateSection
                      title="진입 N분 후 2"
                      templateKey="teleditPostEntry2Template"
                      value={s.templates.teleditPostEntry2Template}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="entry"
                    />
                    <TemplateSection
                      title="진입 N분 후 3"
                      templateKey="teleditPostEntry3Template"
                      value={s.templates.teleditPostEntry3Template}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="entry"
                    />
                  </div>
                </div>

                {/* ── 포지션 종료 시 Section ── */}
                <div className="bg-binance-card border border-binance-border rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1.5 h-4 bg-binance-red rounded-full" />
                    <h3 className="text-xs font-bold text-binance-text">포지션 종료 시</h3>
                  </div>
                  <div className="space-y-4">
                    {/* 종료 전 발송 타이밍 */}
                    <div>
                      <p className="text-[11px] font-medium text-binance-text-dim mb-2">종료 전 발송 타이밍</p>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-binance-text-dim">최소</span>
                        <input
                          type="number"
                          min={0}
                          value={s.preCloseMinSec}
                          onChange={e => s.setPreCloseMinSec(Number(e.target.value))}
                          className="w-20 bg-binance-bg border border-binance-border rounded px-2 py-1.5 text-xs text-binance-text text-center focus:outline-none focus:border-binance-yellow/50"
                        />
                        <span className="text-[11px] text-binance-text-dim">초 ~</span>
                        <span className="text-[11px] text-binance-text-dim">최대</span>
                        <input
                          type="number"
                          min={0}
                          value={s.preCloseMaxSec}
                          onChange={e => s.setPreCloseMaxSec(Number(e.target.value))}
                          className="w-20 bg-binance-bg border border-binance-border rounded px-2 py-1.5 text-xs text-binance-text text-center focus:outline-none focus:border-binance-yellow/50"
                        />
                        <span className="text-[11px] text-binance-text-dim">초 전</span>
                      </div>
                    </div>
                    <div className="border-t border-binance-border" />
                    <TemplateSection
                      title="종료 N~N1초 전"
                      templateKey="teleditPreCloseTemplate"
                      value={s.templates.teleditPreCloseTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="close"
                    />
                    <div className="border-t border-binance-border" />
                    <TemplateSection
                      title="종료"
                      templateKey="teleditCloseTemplate"
                      value={s.templates.teleditCloseTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="close"
                    />
                    <div className="border-t border-binance-border" />
                    <TemplateSection
                      title="종료 N분 후 1"
                      templateKey="teleditPostClose1Template"
                      value={s.templates.teleditPostClose1Template}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="close"
                    />
                    <TemplateSection
                      title="종료 N분 후 2"
                      templateKey="teleditPostClose2Template"
                      value={s.templates.teleditPostClose2Template}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="close"
                    />
                    <TemplateSection
                      title="종료 N분 후 3"
                      templateKey="teleditPostClose3Template"
                      value={s.templates.teleditPostClose3Template}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="close"
                    />
                    <div className="border-t border-binance-border" />
                    <TemplateSection
                      title="수익 인증"
                      templateKey="teleditProfitTemplate"
                      value={s.templates.teleditProfitTemplate}
                      onChange={s.updateTemplate}
                      onReset={s.resetTemplate}
                      mockType="close"
                    />
                  </div>
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
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
