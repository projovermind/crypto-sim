'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useCallback } from 'react'

const TEMPLATE_FIELDS = [
  { key: 'teledditLongTemplate', label: '포지션 진입 (롱)' },
  { key: 'teledditShortTemplate', label: '포지션 진입 (숏)' },
  { key: 'teleditPreEntryTemplate', label: '진입 전 알림' },
  { key: 'teleditPostEntryTemplate', label: '진입 완료' },
  { key: 'teleditPreCloseTemplate', label: '종료 전 알림' },
  { key: 'teleditCloseTemplate', label: '종료' },
  { key: 'teleditProfitTemplate', label: '수익 인증 1' },
  { key: 'teleditProfitTemplate2', label: '수익 인증 2' },
]

export default function AdminTemplatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const userRole = (session?.user as any)?.role

  const [templates, setTemplates] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    if (status === 'authenticated' && userRole !== 'ADMIN') {
      router.replace('/dashboard')
    }
  }, [status, userRole, router])

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/default-templates')
      if (res.ok) setTemplates(await res.json())
    } catch { }
    setLoading(false)
  }, [])

  useEffect(() => { if (userRole === 'ADMIN') fetchTemplates() }, [userRole, fetchTemplates])

  const handleSave = async () => {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch('/api/admin/default-templates', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templates),
      })
      const data = await res.json()
      setMsg(data.saved ? `저장 완료 (${data.usersUpdated}명 적용)` : '저장 실패')
    } catch {
      setMsg('저장 실패')
    }
    setSaving(false)
  }

  if (status === 'loading' || loading) {
    return <div className="min-h-screen bg-binance-bg flex items-center justify-center text-binance-text-dim">로딩 중...</div>
  }
  if (userRole !== 'ADMIN') return null

  return (
    <div className="min-h-screen bg-binance-bg p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-binance-text">기본 메시지 템플릿 관리</h1>
          <div className="flex items-center gap-3">
            {msg && <span className={`text-xs ${msg.includes('실패') ? 'text-binance-red' : 'text-green-400'}`}>{msg}</span>}
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 disabled:opacity-50"
            >
              {saving ? '저장 중...' : '저장 + 전체 회원 적용'}
            </button>
            <button onClick={() => router.push('/admin')} className="text-xs text-binance-text-dim hover:text-binance-text">
              &larr; Admin
            </button>
          </div>
        </div>

        <p className="text-xs text-binance-text-dim mb-6">
          여기서 수정하면 <span className="text-binance-yellow font-semibold">전체 회원</span>의 기본 템플릿이 일괄 변경됩니다.
          개별 회원이 직접 수정한 템플릿은 덮어씌워집니다.
        </p>

        <div className="space-y-5">
          {TEMPLATE_FIELDS.map(({ key, label }) => (
            <div key={key} className="bg-binance-card border border-binance-border rounded-lg p-4">
              <label className="block text-xs font-medium text-binance-text-dim mb-2">{label}</label>
              <textarea
                value={templates[key] || ''}
                onChange={e => setTemplates(prev => ({ ...prev, [key]: e.target.value }))}
                rows={8}
                className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text resize-none focus:outline-none focus:border-binance-yellow"
                placeholder={`${label} 템플릿을 입력하세요`}
              />
            </div>
          ))}
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-5 py-2.5 text-xs bg-binance-yellow text-black font-bold rounded hover:opacity-90 disabled:opacity-50"
          >
            {saving ? '저장 중...' : '저장 + 전체 회원 적용'}
          </button>
        </div>
      </div>
    </div>
  )
}
