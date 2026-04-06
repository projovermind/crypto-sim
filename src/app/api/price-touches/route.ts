import { NextResponse } from 'next/server'

// GET /api/price-touches?symbol=BTCUSDT&price=65000&fromTime=...&toTime=...&searchDays=180
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const symbol = (searchParams.get('symbol') || 'BTCUSDT').toUpperCase()
  const price = parseFloat(searchParams.get('price') || '0')
  const fromTime = searchParams.get('fromTime')
    ? parseInt(searchParams.get('fromTime')!)
    : undefined
  const toTime = searchParams.get('toTime')
    ? parseInt(searchParams.get('toTime')!)
    : undefined
  const searchDays = Math.min(
    Math.max(parseInt(searchParams.get('searchDays') || '180'), 1),
    365
  )

  if (!price || price <= 0) {
    return NextResponse.json(
      { error: '유효한 price 값이 필요합니다.' },
      { status: 400 }
    )
  }

  const now = Date.now()
  const searchMs = searchDays * 24 * 3600 * 1000
  const startTime = toTime ? Math.min(now - searchMs, toTime - searchMs) : now - searchMs
  const endTime = toTime || now
  const chunkMs = 1000 * 3600 * 1000 // 1000 hours in ms (Binance klines max limit=1000)
  const numChunks = Math.ceil((endTime - startTime) / chunkMs)

  // Retry helper
  async function fetchWithRetry(
    url: string,
    retries = 2
  ): Promise<Response | null> {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url)
        if (res.ok) return res
        if (attempt < retries) await new Promise((r) => setTimeout(r, 300))
      } catch {
        if (attempt < retries) await new Promise((r) => setTimeout(r, 300))
      }
    }
    return null
  }

  // --- Pass 1: 1h klines ---
  const hourlyMatches: { time: number; openTime: number }[] = []
  let chunkFailures = 0

  for (let i = 0; i < numChunks; i++) {
    const chunkStart = startTime + i * chunkMs
    const chunkEnd = Math.min(chunkStart + chunkMs, endTime)

    const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1h&limit=1000&startTime=${chunkStart}&endTime=${chunkEnd}`
    const res = await fetchWithRetry(url)

    if (!res) {
      chunkFailures++
      continue
    }

    const data = await res.json()
    if (!Array.isArray(data)) {
      chunkFailures++
      continue
    }

    for (const k of data as any[][]) {
      const low = parseFloat(k[3])
      const high = parseFloat(k[2])
      const openTime = Math.floor(k[0] / 1000)

      if (price >= low && price <= high) {
        // Apply fromTime filter
        if (fromTime && openTime < fromTime) continue
        hourlyMatches.push({ time: openTime, openTime })
      }
    }
  }

  if (hourlyMatches.length === 0) {
    return NextResponse.json(
      { matches: [], incomplete: chunkFailures > 0 },
      { status: 200 }
    )
  }

  // --- Pass 2 overload protection: cap at 500 hourly matches ---
  if (hourlyMatches.length > 500) {
    hourlyMatches.sort((a, b) => b.time - a.time)
    hourlyMatches.length = Math.min(hourlyMatches.length, 500)
  }

  // --- Pass 2: 1m klines for each matched hour ---
  const matches: { time: string; timestamp: number }[] = []
  const dedupSet = new Set<number>()

  // Process in batches of 15 to avoid rate limiting
  const batchSize = 15
  for (let i = 0; i < hourlyMatches.length; i += batchSize) {
    const batch = hourlyMatches.slice(i, i + batchSize)
    const results = await Promise.allSettled(
      batch.map(async (hour) => {
        const hourStartMs = hour.openTime * 1000
        const hourEndMs = hourStartMs + 3600 * 1000
        const url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=1m&limit=60&startTime=${hourStartMs}&endTime=${hourEndMs}`
        const res = await fetchWithRetry(url)
        if (!res) return []
        const data = await res.json()
        if (!Array.isArray(data)) return []

        const minuteMatches: { time: string; timestamp: number }[] = []
        for (const k of data as any[][]) {
          const low = parseFloat(k[3])
          const high = parseFloat(k[2])
          const ts = Math.floor(k[0] / 1000)

          if (price >= low && price <= high && !dedupSet.has(ts)) {
            dedupSet.add(ts)
            const d = new Date(ts * 1000 + 9 * 3600 * 1000)
            const pad = (n: number) => String(n).padStart(2, '0')
            minuteMatches.push({
              time: `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`,
              timestamp: ts,
            })
          }
        }
        return minuteMatches
      })
    )

    for (const result of results) {
      if (result.status === 'fulfilled') {
        matches.push(...result.value)
      }
    }
  }

  // Sort newest first
  matches.sort((a, b) => b.timestamp - a.timestamp)

  return NextResponse.json(
    {
      matches,
      incomplete: chunkFailures > 0,
    },
    {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=60',
      },
    }
  )
}
