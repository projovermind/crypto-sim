import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  request: NextRequest,
  { params }: { params: { symbol: string } }
) {
  const { symbol } = params
  try {
    const res = await fetch(
      `https://api.binance.com/api/v3/trades?symbol=${symbol}&limit=50`,
      { next: { revalidate: 0 } }
    )
    const data = await res.json()
    const trades = data.map((t: any) => ({
      price: parseFloat(t.price),
      qty: parseFloat(t.qty),
      time: t.time,
      isBuyerMaker: t.isBuyerMaker,
    }))
    return NextResponse.json(trades)
  } catch (e) {
    return NextResponse.json([], { status: 500 })
  }
}
