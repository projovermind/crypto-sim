'use client'

import { useState } from 'react'
import { applyTemplate, DEFAULT_TEMPLATE, DEFAULT_CLOSE_TEMPLATE, DEFAULT_PROFIT_TEMPLATE } from '@/hooks/useDashboard'

interface SettingsModalProps {
  showSettings: boolean
  onClose: () => void
  // Template (entry)
  templateInput: string
  onTemplateChange: (v: string) => void
  savingTemplate: boolean
  onSaveTemplate: () => void
  // Template (close)
  closeTemplateInput: string
  onCloseTemplateChange: (v: string) => void
  // Template (profit)
  profitTemplateInput: string
  onProfitTemplateChange: (v: string) => void
  // Password
  currentPw: string
  newPw: string
  newPwConfirm: string
  pwMsg: string
  savingPw: boolean
  onCurrentPwChange: (v: string) => void
  onNewPwChange: (v: string) => void
  onNewPwConfirmChange: (v: string) => void
  onPasswordChange: () => void
  // Teledit connection
  teleditApiUrl: string
  teleditEmail: string
  teleditPassword: string
  onTeleditApiUrlChange: (v: string) => void
  onTeleditEmailChange: (v: string) => void
  onTeleditPasswordChange: (v: string) => void
  savingTeledit: boolean
  teleditMsg: string
  onSaveTeledit: () => void
}

// 각 섹션용 미리보기 mock 데이터
const MOCK_ENTRY = { symbol: 'BTCUSDT', side: 'LONG', leverage: 10, entryPrice: 65000, amount: 100, pnl: null, closedPrice: null } as any
const MOCK_CLOSE = { symbol: 'BTCUSDT', side: 'LONG', leverage: 10, entryPrice: 65000, amount: 100, pnl: 12.5, roeLive: 12.5, closedPrice: 66200 } as any
const MOCK_PROFIT = { symbol: 'BTCUSDT', side: 'LONG', leverage: 10, entryPrice: 65000, amount: 100, pnl: 12.5, roeLive: 12.5, closedPrice: 66200 } as any

const inputCls = 'w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50'
const textareaCls = 'w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text resize-none focus:outline-none focus:border-binance-yellow'

function TemplateSection({
  title,
  vars,
  value,
  onChange,
  onReset,
  defaultValue,
  mock,
}: {
  title: string
  vars: string[]
  value: string
  onChange: (v: string) => void
  onReset: () => void
  defaultValue: string
  mock: any
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-medium text-binance-text-dim">{title}</h4>
        <button
          onClick={onReset}
          className="text-[10px] text-binance-text-dim hover:text-binance-yellow transition-colors"
        >
          기본값
        </button>
      </div>
      <p className="text-[11px] text-binance-text-dim mb-1.5">
        {vars.map((v, i) => (
          <span key={v}>
            <code className="text-binance-yellow">{`{{${v}}}`}</code>
            {i < vars.length - 1 ? ', ' : ''}
          </span>
        ))}
      </p>
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        rows={2}
        className={textareaCls}
        placeholder={defaultValue}
      />
      <div className="text-[11px] text-binance-text-dim mt-1">
        미리보기:{' '}
        <span className="text-binance-text whitespace-pre-wrap">
          {applyTemplate(value || defaultValue, mock)}
        </span>
      </div>
    </div>
  )
}

export default function SettingsModal({
  showSettings,
  onClose,
  templateInput,
  onTemplateChange,
  savingTemplate,
  onSaveTemplate,
  closeTemplateInput,
  onCloseTemplateChange,
  profitTemplateInput,
  onProfitTemplateChange,
  currentPw,
  newPw,
  newPwConfirm,
  pwMsg,
  savingPw,
  onCurrentPwChange,
  onNewPwChange,
  onNewPwConfirmChange,
  onPasswordChange,
  teleditApiUrl,
  teleditEmail,
  teleditPassword,
  onTeleditApiUrlChange,
  onTeleditEmailChange,
  onTeleditPasswordChange,
  savingTeledit,
  teleditMsg,
  onSaveTeledit,
}: SettingsModalProps) {
  const [activeTab, setActiveTab] = useState<'password' | 'teledit'>('password')

  if (!showSettings) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-binance-card border border-binance-border rounded-lg w-[440px] max-w-[90vw] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 + 탭 */}
        <div className="px-5 pt-5 pb-0">
          <h3 className="text-sm font-bold text-binance-text mb-3">설정</h3>
          <div className="flex gap-0 border-b border-binance-border">
            <button
              onClick={() => setActiveTab('password')}
              className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'password'
                  ? 'text-binance-yellow border-binance-yellow'
                  : 'text-binance-text-dim border-transparent hover:text-binance-text'
              }`}
            >
              비밀번호 설정
            </button>
            <button
              onClick={() => setActiveTab('teledit')}
              className={`px-4 py-2 text-xs font-medium transition-colors border-b-2 -mb-px ${
                activeTab === 'teledit'
                  ? 'text-binance-yellow border-binance-yellow'
                  : 'text-binance-text-dim border-transparent hover:text-binance-text'
              }`}
            >
              텔레딧 설정
            </button>
          </div>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-5">

          {/* ── 비밀번호 탭 ── */}
          {activeTab === 'password' && (
            <div>
              <h4 className="text-xs font-medium text-binance-text-dim mb-2">비밀번호 변경</h4>
              <div className="space-y-2">
                <input
                  type="password"
                  value={currentPw}
                  onChange={e => onCurrentPwChange(e.target.value)}
                  placeholder="현재 비밀번호"
                  className={inputCls}
                />
                <input
                  type="password"
                  value={newPw}
                  onChange={e => onNewPwChange(e.target.value)}
                  placeholder="새 비밀번호 (4자 이상)"
                  className={inputCls}
                />
                <input
                  type="password"
                  value={newPwConfirm}
                  onChange={e => onNewPwConfirmChange(e.target.value)}
                  placeholder="새 비밀번호 확인"
                  className={inputCls}
                />
              </div>
              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={onPasswordChange}
                  disabled={savingPw}
                  className="px-3 py-1.5 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingPw ? '변경 중...' : '비밀번호 변경'}
                </button>
                {pwMsg && (
                  <span className={`text-[11px] ${pwMsg.includes('변경되었') ? 'text-green-400' : 'text-red-400'}`}>
                    {pwMsg}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* ── 텔레딧 탭 ── */}
          {activeTab === 'teledit' && (
            <div className="space-y-5">

              {/* 연결 정보 */}
              <div>
                <h4 className="text-xs font-medium text-binance-text-dim mb-2">Teledit 연결 정보</h4>
                <div className="space-y-2">
                  <input
                    type="text"
                    value={teleditApiUrl}
                    onChange={e => onTeleditApiUrlChange(e.target.value)}
                    placeholder="API URL (예: https://teledit.example.com)"
                    className={inputCls}
                  />
                  <input
                    type="text"
                    value={teleditEmail}
                    onChange={e => onTeleditEmailChange(e.target.value)}
                    placeholder="이메일"
                    className={inputCls}
                  />
                  <input
                    type="password"
                    value={teleditPassword}
                    onChange={e => onTeleditPasswordChange(e.target.value)}
                    placeholder="비밀번호"
                    className={inputCls}
                  />
                </div>
              </div>

              {/* 구분선 */}
              <div className="border-t border-binance-border" />

              {/* 포지션 진입 메시지 */}
              <TemplateSection
                title="포지션 진입 메시지"
                vars={['symbol', 'side', 'leverage', 'entryPrice', 'amount']}
                value={templateInput}
                onChange={onTemplateChange}
                onReset={() => onTemplateChange(DEFAULT_TEMPLATE)}
                defaultValue={DEFAULT_TEMPLATE}
                mock={MOCK_ENTRY}
              />

              {/* 포지션 청산 메시지 */}
              <TemplateSection
                title="포지션 청산 메시지"
                vars={['symbol', 'side', 'leverage', 'entryPrice', 'closePrice', 'pnl', 'roe']}
                value={closeTemplateInput}
                onChange={onCloseTemplateChange}
                onReset={() => onCloseTemplateChange(DEFAULT_CLOSE_TEMPLATE)}
                defaultValue={DEFAULT_CLOSE_TEMPLATE}
                mock={MOCK_CLOSE}
              />

              {/* 수익 인증 메시지 */}
              <TemplateSection
                title="수익 인증 메시지"
                vars={['symbol', 'side', 'leverage', 'entryPrice', 'closePrice', 'pnl', 'roe']}
                value={profitTemplateInput}
                onChange={onProfitTemplateChange}
                onReset={() => onProfitTemplateChange(DEFAULT_PROFIT_TEMPLATE)}
                defaultValue={DEFAULT_PROFIT_TEMPLATE}
                mock={MOCK_PROFIT}
              />

              {/* 저장 버튼 */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  {teleditMsg && (
                    <span className={`text-[11px] ${teleditMsg.startsWith('오류') ? 'text-red-400' : 'text-green-400'}`}>
                      {teleditMsg}
                    </span>
                  )}
                </div>
                <button
                  onClick={onSaveTeledit}
                  disabled={savingTeledit}
                  className="px-3 py-1.5 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {savingTeledit ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 하단 닫기 버튼 */}
        <div className="px-5 py-3 border-t border-binance-border flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-binance-text-dim hover:text-binance-text transition-colors"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
