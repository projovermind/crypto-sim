import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: { symbol: string } }
) {
  try {
    const symbol = params.symbol.toUpperCase()
    const res = await fetch(
      `https://api.binance.com/api/v3/depth?symbol=${symbol}&limit=15`,
      { next: { revalidate: 1 } }
    )

    if (!res.ok) {
      return NextResponse.json({ error: 'Failed to fetch depth' }, { status: 404 })
    }

    const data = await res.json()
    return NextResponse.json({
      bids: data.bids.map((b: string[]) => [parseFloat(b[0]), parseFloat(b[1])]),
      asks: data.asks.map((a: string[]) => [parseFloat(a[0]), parseFloat(a[1])]),
    })
  } catch (error) {
    return NextResponse.json({ error: 'Depth fetch error' }, { status: 500 })
  }
}
