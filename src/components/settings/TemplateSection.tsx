'use client'

import { useRef, useState } from 'react'
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
  imageUrl?: string
  onImageChange?: (key: TemplateKey, url: string) => void
  onImageRemove?: (key: TemplateKey) => void
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
  imageUrl,
  onImageChange,
  onImageRemove,
}: TemplateSectionProps) {
  const mock = mockType === 'entry' ? MOCK_ENTRY : MOCK_CLOSE
  const defaultValue = DEFAULT_TEMPLATES[templateKey]
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadError(null)

    if (file.size > 10 * 1024 * 1024) {
      setUploadError('10MB 이하의 파일만 업로드 가능합니다.')
      if (fileInputRef.current) fileInputRef.current.value = ''
      return
    }

    setUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: form })
      const data = await res.json()
      if (res.ok && data.url) {
        onImageChange?.(templateKey, data.url)
      } else {
        setUploadError(data.error || '업로드에 실패했습니다.')
      }
    } catch {
      setUploadError('네트워크 오류가 발생했습니다.')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

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

        {/* Image upload */}
        <div className="mt-2">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileChange}
          />
          {uploadError && (
            <p className="text-[10px] text-red-400 mb-1">{uploadError}</p>
          )}
          {imageUrl ? (
            <div className="flex items-center gap-2">
              <img
                src={imageUrl}
                alt="첨부 이미지"
                className="h-14 w-auto rounded border border-binance-border object-cover"
              />
              <button
                onClick={() => onImageRemove?.(templateKey)}
                className="text-[10px] text-binance-text-dim hover:text-red-400 transition-colors"
              >
                ✕ 삭제
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="text-[10px] text-binance-text-dim hover:text-binance-yellow transition-colors border border-dashed border-binance-border/60 rounded px-2 py-1 disabled:opacity-50"
            >
              {uploading ? '업로드 중...' : '+ 이미지 첨부'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
