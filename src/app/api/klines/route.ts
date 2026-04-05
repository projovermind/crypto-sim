import { NextResponse } from 'next/server'

// GET /api/klines?symbol=BTCUSDT&interval=1h&limit=500&startTime=...
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = (searchParams.get('symbol') || 'BTCUSDT').toUpperCase()
    const interval = searchParams.get('interval') || '1h'
    const limit = Math.min(parseInt(searchParams.get('limit') || '500'), 1500)
    const startTime = searchParams.get('startTime')
    const endTime = searchParams.get('endTime')

    let url = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}&limit=${limit}`
    if (startTime) url += `&startTime=${startTime}`
    if (endTime) url += `&endTime=${endTime}`

    const res = await fetch(url, { next: { revalidate: 30 } })

    if (!res.ok) {
      return NextResponse.json({ error: '캔들 데이터를 가져올 수 없습니다.' }, { status: 404 })
    }

    const data = await res.json()

    // Binance kline format: [openTime, open, high, low, close, volume, closeTime, ...]
    const klines = data.map((k: any[]) => ({
      time: Math.floor(k[0] / 1000), // seconds
      open: parseFloat(k[1]),
      high: parseFloat(k[2]),
      low: parseFloat(k[3]),
      close: parseFloat(k[4]),
      volume: parseFloat(k[5]),
    }))

    return NextResponse.json(klines)
  } catch (error) {
    console.error('GET /api/klines error:', error)
    return NextResponse.json({ error: '캔들 데이터 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
