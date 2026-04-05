import { NextResponse } from 'next/server'

// GET /api/price/[symbol] - 실시간 가격 + 24h 정보
export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase()

    // 24h ticker
    const tickerRes = await fetch(
      `https://api.binance.com/api/v3/ticker/24hr?symbol=${symbol}`,
      { next: { revalidate: 5 } }
    )

    if (!tickerRes.ok) {
      return NextResponse.json({ error: '심볼을 찾을 수 없습니다.' }, { status: 404 })
    }

    const ticker = await tickerRes.json()

    return NextResponse.json({
      symbol: ticker.symbol,
      price: parseFloat(ticker.lastPrice),
      priceChange: parseFloat(ticker.priceChange),
      priceChangePercent: parseFloat(ticker.priceChangePercent),
      high24h: parseFloat(ticker.highPrice),
      low24h: parseFloat(ticker.lowPrice),
      volume24h: parseFloat(ticker.quoteVolume),
      trades: parseInt(ticker.count),
    })
  } catch (error) {
    console.error('GET /api/price error:', error)
    return NextResponse.json({ error: '가격 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
