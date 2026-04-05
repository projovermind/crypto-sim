'use client'

import { applyTemplate, DEFAULT_TEMPLATE } from '@/hooks/useDashboard'

interface SettingsModalProps {
  showSettings: boolean
  onClose: () => void
  // Template
  templateInput: string
  onTemplateChange: (v: string) => void
  savingTemplate: boolean
  onSaveTemplate: () => void
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
}

export default function SettingsModal({
  showSettings,
  onClose,
  templateInput,
  onTemplateChange,
  savingTemplate,
  onSaveTemplate,
  currentPw,
  newPw,
  newPwConfirm,
  pwMsg,
  savingPw,
  onCurrentPwChange,
  onNewPwChange,
  onNewPwConfirmChange,
  onPasswordChange,
}: SettingsModalProps) {
  if (!showSettings) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-binance-card border border-binance-border rounded-lg p-5 w-[420px] max-w-[90vw] max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <h3 className="text-sm font-bold text-binance-text mb-3">설정</h3>

        {/* 비밀번호 변경 */}
        <div className="mb-4 pb-4 border-b border-binance-border">
          <h4 className="text-xs font-medium text-binance-text-dim mb-2">비밀번호 변경</h4>
          <div className="space-y-2">
            <input
              type="password"
              value={currentPw}
              onChange={e => onCurrentPwChange(e.target.value)}
              placeholder="현재 비밀번호"
              className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50"
            />
            <input
              type="password"
              value={newPw}
              onChange={e => onNewPwChange(e.target.value)}
              placeholder="새 비밀번호 (4자 이상)"
              className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50"
            />
            <input
              type="password"
              value={newPwConfirm}
              onChange={e => onNewPwConfirmChange(e.target.value)}
              placeholder="새 비밀번호 확인"
              className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50"
            />
          </div>
          <div className="flex items-center gap-2 mt-2">
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

        {/* Teledit 템플릿 */}
        <h4 className="text-xs font-medium text-binance-text-dim mb-2">Teledit 메시지 템플릿</h4>
        <p className="text-[11px] text-binance-text-dim mb-3">
          사용 가능한 변수:{' '}
          <code className="text-binance-yellow">{'{{symbol}}'}</code>,{' '}
          <code className="text-binance-yellow">{'{{side}}'}</code>,{' '}
          <code className="text-binance-yellow">{'{{leverage}}'}</code>,{' '}
          <code className="text-binance-yellow">{'{{entryPrice}}'}</code>,{' '}
          <code className="text-binance-yellow">{'{{amount}}'}</code>,{' '}
          <code className="text-binance-yellow">{'{{pnl}}'}</code>
        </p>
        <textarea
          value={templateInput}
          onChange={e => onTemplateChange(e.target.value)}
          rows={3}
          className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text resize-none focus:outline-none focus:border-binance-yellow"
          placeholder={DEFAULT_TEMPLATE}
        />
        <div className="text-[11px] text-binance-text-dim mt-2 mb-4">
          미리보기:{' '}
          <span className="text-binance-text">
            {applyTemplate(templateInput || DEFAULT_TEMPLATE, {
              symbol: 'BTCUSDT',
              side: 'LONG',
              leverage: 10,
              entryPrice: 65000,
              amount: 100,
              pnl: 12.5,
            } as any)}
          </span>
        </div>
        <div className="flex justify-end gap-2">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-binance-text-dim hover:text-binance-text transition-colors"
          >
            닫기
          </button>
          <button
            onClick={() => onTemplateChange(DEFAULT_TEMPLATE)}
            className="px-3 py-1.5 text-xs text-binance-text-dim hover:text-binance-yellow transition-colors"
          >
            기본값
          </button>
          <button
            onClick={onSaveTemplate}
            disabled={savingTemplate}
            className="px-3 py-1.5 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {savingTemplate ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
