'use client'

import { useEffect, useMemo, useState } from 'react'

export interface ProfitCapAlert {
  id: string
  positionNumber?: number | null
  symbol: string
  side: 'LONG' | 'SHORT' | string
  profitCapAt: string | null
  deadlineAt: string | null
}

interface ProfitCapAlertModalProps {
  /** 로그인 세션 구분용 (없으면 'anon') — 세션당 1회만 노출 */
  userId?: string | null
  /** 목록 클릭 시 해당 포지션으로 이동 */
  onSelectPosition?: (positionId: string) => void
}

const STORAGE_PREFIX = 'posi:profitCapAlertShown:'

/** 남은 시간 → "1일 4시간 남음" / "12시간 30분 남음" / "기한 지남" */
function formatRemaining(deadlineAt: string | null, now: number): { text: string; expired: boolean } {
  if (!deadlineAt) return { text: '기한 미정', expired: false }
  const ts = new Date(deadlineAt).getTime()
  if (!Number.isFinite(ts)) return { text: '기한 미정', expired: false }

  const diff = ts - now
  if (diff <= 0) return { text: '기한 지남', expired: true }

  const totalMin = Math.floor(diff / 60000)
  const days = Math.floor(totalMin / 1440)
  const hours = Math.floor((totalMin % 1440) / 60)
  const mins = totalMin % 60

  if (days > 0) return { text: `${days}일 ${hours}시간 남음`, expired: false }
  if (hours > 0) return { text: `${hours}시간 ${mins}분 남음`, expired: false }
  return { text: `${mins}분 남음`, expired: false }
}

export default function ProfitCapAlertModal({ userId, onSelectPosition }: ProfitCapAlertModalProps) {
  const [alerts, setAlerts] = useState<ProfitCapAlert[]>([])
  const [open, setOpen] = useState(false)
  const [now, setNow] = useState(() => Date.now())

  const storageKey = useMemo(() => `${STORAGE_PREFIX}${userId || 'anon'}`, [userId])

  // 로그인 세션당 1회 — sessionStorage 플래그 확인 후 fetch
  useEffect(() => {
    if (!userId) return
    let cancelled = false

    try {
      if (sessionStorage.getItem(storageKey)) return
    } catch {
      // sessionStorage 불가 환경(프라이빗 모드 등)에서는 그냥 진행
    }

    ;(async () => {
      try {
        const res = await fetch('/api/positions/profit-cap-alerts')
        if (!res.ok) return
        const data = await res.json()
        const list: ProfitCapAlert[] = Array.isArray(data?.positions) ? data.positions : []
        if (cancelled) return
        // 조회 성공 시점에 플래그 — 세션당 1회만 확인/표시
        try { sessionStorage.setItem(storageKey, '1') } catch { }
        if (list.length === 0) return
        setAlerts(list)
        setOpen(true)
      } catch {
        // API 미구현/네트워크 실패 시 조용히 무시
      }
    })()

    return () => { cancelled = true }
  }, [userId, storageKey])

  // 남은 시간 1분마다 갱신
  useEffect(() => {
    if (!open) return
    const t = setInterval(() => setNow(Date.now()), 60_000)
    return () => clearInterval(t)
  }, [open])

  if (!open || alerts.length === 0) return null

  const close = () => setOpen(false)

  const handleClick = (id: string) => {
    if (!onSelectPosition) return
    onSelectPosition(id)
    close()
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60" onClick={close}>
      <div
        className="bg-binance-card border border-binance-border rounded-lg w-[440px] max-w-[90vw] max-h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="px-5 pt-5 pb-3 border-b border-binance-border">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-binance-yellow flex items-center gap-1.5">
                <span>⚠</span> 수익 상한 도달 알림
              </h3>
              <p className="text-[11px] text-binance-text-dim mt-1.5 leading-relaxed">
                아래 포지션은 <span className="text-binance-green font-semibold">수익 $10,000</span>에 도달했습니다.
                <br />
                <span className="text-binance-text">2일 내 종료</span>가 필요합니다.
              </p>
            </div>
            <button
              onClick={close}
              className="text-binance-text-dim hover:text-binance-text text-lg leading-none shrink-0 px-1"
              aria-label="닫기"
            >
              ×
            </button>
          </div>
        </div>

        {/* 목록 */}
        <div className="flex-1 overflow-y-auto px-5 py-3 space-y-2">
          {alerts.map(a => {
            const { text, expired } = formatRemaining(a.deadlineAt, now)
            const isLong = a.side === 'LONG'
            return (
              <button
                key={a.id}
                onClick={() => handleClick(a.id)}
                disabled={!onSelectPosition}
                className={`w-full text-left bg-binance-bg border border-binance-border rounded px-3 py-2.5 flex items-center gap-3 transition-colors ${
                  onSelectPosition ? 'hover:border-binance-yellow/50 cursor-pointer' : 'cursor-default'
                }`}
              >
                {/* 포지션 번호 (크게) */}
                <span className="font-mono font-bold text-binance-text text-xl leading-none shrink-0">
                  #{a.positionNumber ?? '-'}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-binance-text truncate">{a.symbol}</span>
                    <span className={`text-[10px] font-bold ${isLong ? 'text-binance-green' : 'text-binance-red'}`}>
                      {isLong ? '롱' : '숏'}
                    </span>
                  </div>
                  <div className={`text-[11px] mt-0.5 font-medium ${expired ? 'text-binance-red' : 'text-binance-text-dim'}`}>
                    {text}
                  </div>
                </div>

                {onSelectPosition && (
                  <span className="text-binance-text-dim text-xs shrink-0">›</span>
                )}
              </button>
            )
          })}
        </div>

        {/* 푸터 */}
        <div className="px-5 py-3 border-t border-binance-border flex justify-end">
          <button
            onClick={close}
            className="text-xs bg-binance-yellow text-black font-bold px-4 py-1.5 rounded hover:opacity-90"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  )
}
