'use client'

import { applyTemplate } from '@/hooks/useDashboard'
import { MOCK_ENTRY, MOCK_CLOSE, ENTRY_VARS, CLOSE_VARS, DEFAULT_TEMPLATES, TemplateKey } from '@/hooks/useSettings'

const textareaCls =
  'w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text resize-none focus:outline-none focus:border-binance-yellow'

// ─── Variable descriptions ──────────────────────────────────────
const VAR_DESCRIPTIONS: Record<string, string> = {
  symbol: '코인명',
  side: '방향(LONG/SHORT)',
  leverage: '레버리지',
  entryPrice: '진입가',
  amount: '수량',
  closePrice: '청산가',
  pnl: '손익(USDT)',
  roe: '수익률(%)',
}

// ─── VarTable: two-column variable reference ────────────────────
function VarTable({ vars }: { vars: string[] }) {
  return (
    <table className="w-full text-[10px] border-collapse mb-1.5">
      <thead>
        <tr className="border-b border-binance-border">
          <th className="text-left py-0.5 pr-2 text-binance-text-dim font-medium w-1/3">변수명</th>
          <th className="text-left py-0.5 text-binance-text-dim font-medium">설명</th>
        </tr>
      </thead>
      <tbody>
        {vars.map(v => (
          <tr key={v} className="border-b border-binance-border/40 last:border-0">
            <td className="py-0.5 pr-2">
              <code className="text-binance-yellow">{`{{${v}}}`}</code>
            </td>
            <td className="py-0.5 text-binance-text-dim">{VAR_DESCRIPTIONS[v] ?? v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

// ─── TemplateSection ────────────────────────────────────────────
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
      <VarTable vars={vars} />
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
