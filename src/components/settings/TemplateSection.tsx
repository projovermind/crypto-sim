'use client'

import { applyTemplate } from '@/hooks/useDashboard'
import { MOCK_ENTRY, MOCK_CLOSE, ENTRY_VARS, CLOSE_VARS, DEFAULT_TEMPLATES, TemplateKey } from '@/hooks/useSettings'

const textareaCls =
  'w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text resize-none focus:outline-none focus:border-binance-yellow'

interface TemplateSectionProps {
  title: string
  templateKey: TemplateKey
  value: string
  onChange: (key: TemplateKey, value: string) => void
  onReset: (key: TemplateKey) => void
  mockType?: 'entry' | 'close'
}

export default function TemplateSection({
  title,
  templateKey,
  value,
  onChange,
  onReset,
  mockType = 'entry',
}: TemplateSectionProps) {
  const vars = mockType === 'entry' ? ENTRY_VARS : CLOSE_VARS
  const mock = mockType === 'entry' ? MOCK_ENTRY : MOCK_CLOSE
  const defaultValue = DEFAULT_TEMPLATES[templateKey]

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <h4 className="text-xs font-medium text-binance-text-dim">{title}</h4>
        <button
          onClick={() => onReset(templateKey)}
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
        onChange={e => onChange(templateKey, e.target.value)}
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
