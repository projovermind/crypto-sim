'use client'

interface ADLIndicatorProps {
  roe: number
}

export function getADLLevel(roe: number): number {
  const absRoe = Math.abs(roe)
  if (absRoe > 50) return 5
  if (absRoe > 30) return 4
  if (absRoe > 15) return 3
  if (absRoe > 5) return 2
  return 1
}

export default function ADLIndicator({ roe }: ADLIndicatorProps) {
  const level = getADLLevel(roe)
  return (
    <div className="flex items-end gap-[1px]">
      {[1, 2, 3, 4, 5].map(l => (
        <div
          key={l}
          style={{ width: 4, height: 10 }}
          className={
            l <= level
              ? level >= 4 ? 'bg-binance-red' : level >= 2 ? 'bg-binance-yellow' : 'bg-binance-green'
              : 'bg-binance-border'
          }
        />
      ))}
    </div>
  )
}
