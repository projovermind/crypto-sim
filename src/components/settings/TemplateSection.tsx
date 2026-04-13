'use client'

import { applyTemplate } from '@/hooks/useDashboard'
import { MOCK_ENTRY, MOCK_CLOSE, DEFAULT_TEMPLATES, TemplateKey } from '@/hooks/useSettings'

const textareaCls =
  'w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text resize-none focus:outline-none focus:border-binance-yellow'

// ─── TemplateSection ────────────────────────────────────────────
interface TemplateSectionProps {
  title: string
  templateKey: TemplateKey
  value: string
  onChange: (key: TemplateKey, value: string) => void
  onReset: (key: TemplateKey) => void
  mockType?: 'entry' | 'close'
  enabled?: boolean
  onToggleEnabled?: (key: TemplateKey, value: boolean) => void
}

export default function TemplateSection({
  title,
  templateKey,
  value,
  onChange,
  onReset,
  mockType = 'entry',
  enabled = true,
  onToggleEnabled,
}: TemplateSectionProps) {
  const mock = mockType === 'entry' ? MOCK_ENTRY : MOCK_CLOSE
  const defaultValue = DEFAULT_TEMPLATES[templateKey]

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 cursor-pointer">
          <input
            type="checkbox"
            checked={enabled}
            onChange={e => onToggleEnabled?.(templateKey, e.target.checked)}
            className="w-3 h-3 rounded accent-binance-yellow cursor-pointer"
          />
          <h4 className="text-xs font-medium text-binance-text-dim">{title}</h4>
        </label>
        <button
          onClick={() => onReset(templateKey)}
          className="text-[10px] text-binance-text-dim hover:text-binance-yellow transition-colors"
        >
          기본값
        </button>
      </div>
      <div className={`transition-opacity ${enabled ? '' : 'opacity-40 pointer-events-none'}`}>
        <textarea
          value={value}
          onChange={e => onChange(templateKey, e.target.value)}
          rows={10}
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
    </div>
  )
}
