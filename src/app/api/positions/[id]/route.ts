import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TAKER_FEE_RATE } from '@/lib/calculations'

// DELETE /api/positions/[id] - 포지션 수동 청산
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const position = await prisma.position.findUnique({
      where: { id: params.id },
    })

    if (!position) {
      return NextResponse.json({ error: '포지션을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (position.userId !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    // Get current price from Binance
    const priceRes = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${position.symbol}`
    )
    const priceData = await priceRes.json()
    const currentPrice = parseFloat(priceData.price)

    // Calculate raw PnL
    let rawPnl: number
    if (position.side === 'LONG') {
      rawPnl = (currentPrice - position.entryPrice) * position.quantity
    } else {
      rawPnl = (position.entryPrice - currentPrice) * position.quantity
    }

    // 수수료 차감: 진입 수수료 + 청산 수수료
    const entryFee = position.entryFee || 0
    const closeFee = position.quantity * currentPrice * TAKER_FEE_RATE
    const pnl = rawPnl - entryFee - closeFee

    const updated = await prisma.position.update({
      where: { id: params.id },
      data: {
        status: 'CLOSED_MANUAL',
        closedAt: new Date(),
        closedPrice: currentPrice,
        pnl,
      },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('DELETE /api/positions/[id] error:', error)
    return NextResponse.json({ error: '포지션 청산 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// PATCH /api/positions/[id] - 포지션 수정 (TP/SL 변경)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const body = await request.json()

    const position = await prisma.position.findUnique({
      where: { id: params.id },
    })

    if (!position) {
      return NextResponse.json({ error: '포지션을 찾을 수 없습니다.' }, { status: 404 })
    }

    if (position.userId !== user.id) {
      return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 })
    }

    const updateData: any = {}
    if (body.takeProfit !== undefined) updateData.takeProfit = body.takeProfit ? parseFloat(body.takeProfit) : null
    if (body.stopLoss !== undefined) updateData.stopLoss = body.stopLoss ? parseFloat(body.stopLoss) : null

    // History editing fields
    if (body.entryPrice !== undefined) updateData.entryPrice = parseFloat(body.entryPrice)
    if (body.closedPrice !== undefined) updateData.closedPrice = parseFloat(body.closedPrice)
    if (body.amount !== undefined) updateData.amount = parseFloat(body.amount)
    if (body.leverage !== undefined) updateData.leverage = parseInt(body.leverage)
    if (body.entryTime !== undefined) updateData.entryTime = new Date(body.entryTime)
    if (body.closedAt !== undefined) updateData.closedAt = body.closedAt ? new Date(body.closedAt) : null

    // OPEN position: leverage 변경 시 margin 유지, amount/quantity 재계산
    if (position.status === 'OPEN' && body.leverage !== undefined) {
      const newLev = parseInt(body.leverage)
      const oldMargin = position.amount / position.leverage
      const newAmount = oldMargin * newLev
      const newQty = newAmount / position.entryPrice
      const newEntryFee = newAmount * TAKER_FEE_RATE
      updateData.amount = newAmount
      updateData.quantity = newQty
      updateData.entryFee = newEntryFee
    }

    // Recalculate PnL if core fields changed on a closed position
    if (position.status !== 'OPEN' && (body.entryPrice !== undefined || body.closedPrice !== undefined || body.amount !== undefined || body.leverage !== undefined)) {
      const ep = updateData.entryPrice ?? position.entryPrice
      const cp = updateData.closedPrice ?? position.closedPrice ?? ep
      const amt = updateData.amount ?? position.amount
      const qty = amt / ep
      let rawPnl: number
      if (position.side === 'LONG') {
        rawPnl = (cp - ep) * qty
      } else {
        rawPnl = (ep - cp) * qty
      }
      const entryFee = amt !== position.amount ? amt * TAKER_FEE_RATE : (position.entryFee || 0)
      const closeFee = qty * cp * TAKER_FEE_RATE
      updateData.pnl = rawPnl - entryFee - closeFee
      updateData.quantity = qty
      if (amt !== position.amount) updateData.entryFee = entryFee
    }

    const updated = await prisma.position.update({
      where: { id: params.id },
      data: updateData,
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/positions/[id] error:', error)
    return NextResponse.json({ error: '포지션 수정 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
