import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { TAKER_FEE_RATE, applySlippage } from '@/lib/calculations'

// DELETE /api/positions/[id] - 포지션 수동 청산 (전체/부분 익절)
// Body (optional): { partialMargin?: number } — 부분 청산 시 마진 금액
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    // body에서 partialMargin 선택적으로 파싱
    let partialMargin: number | undefined
    try {
      const body = await request.json()
      if (body?.partialMargin != null) {
        partialMargin = parseFloat(body.partialMargin)
      }
    } catch {
      // body 없는 DELETE 요청도 허용
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

    if (position.status !== 'OPEN') {
      return NextResponse.json({ error: '이미 청산된 포지션입니다.' }, { status: 400 })
    }

    // Get current price from Binance (시장가)
    const priceRes = await fetch(
      `https://api.binance.com/api/v3/ticker/price?symbol=${position.symbol}`
    )
    const priceData = await priceRes.json()
    const binancePrice = parseFloat(priceData.price)
    // Flash Close / 전체 청산 시 슬리피지 적용: LONG은 가격 상승(불리), SHORT은 가격 하락(불리)
    const currentPrice = applySlippage(binancePrice, position.side as 'LONG' | 'SHORT')

    const totalMargin = position.amount / position.leverage

    // partialMargin이 없거나 totalMargin 이상이면 전체 청산
    if (!partialMargin || partialMargin >= totalMargin) {
      // ── 전체 청산 (기존 로직) ──
      let rawPnl: number
      if (position.side === 'LONG') {
        rawPnl = (currentPrice - position.entryPrice) * position.quantity
      } else {
        rawPnl = (position.entryPrice - currentPrice) * position.quantity
      }
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

      return NextResponse.json({ type: 'full', position: updated })
    }

    // ── 부분 익절 ──
    const ratio = partialMargin / totalMargin // 청산 비율

    // 청산할 분량
    const closedAmount = position.amount * ratio
    const closedQuantity = position.quantity * ratio
    const closedEntryFee = (position.entryFee || 0) * ratio

    // 청산 PnL 계산
    let rawPnl: number
    if (position.side === 'LONG') {
      rawPnl = (currentPrice - position.entryPrice) * closedQuantity
    } else {
      rawPnl = (position.entryPrice - currentPrice) * closedQuantity
    }
    const closeFee = closedQuantity * currentPrice * TAKER_FEE_RATE
    const pnl = rawPnl - closedEntryFee - closeFee

    // 남은 포지션 분량
    const remainAmount = position.amount - closedAmount
    const remainQuantity = position.quantity - closedQuantity
    const remainEntryFee = (position.entryFee || 0) - closedEntryFee

    // 트랜잭션: 원본 축소 + 신규 CLOSED_MANUAL 생성
    const [updatedOriginal, closedPosition] = await prisma.$transaction([
      // 원본 포지션: 남은 만큼 축소
      prisma.position.update({
        where: { id: params.id },
        data: {
          amount: remainAmount,
          quantity: remainQuantity,
          entryFee: remainEntryFee,
        },
      }),
      // 청산 분량으로 신규 히스토리 생성
      prisma.position.create({
        data: {
          userId: position.userId,
          symbol: position.symbol,
          side: position.side,
          leverage: position.leverage,
          entryPrice: position.entryPrice,
          amount: closedAmount,
          quantity: closedQuantity,
          marginMode: position.marginMode,
          orderType: position.orderType,
          entryFee: closedEntryFee,
          takeProfit: position.takeProfit,
          stopLoss: position.stopLoss,
          status: 'CLOSED_MANUAL',
          closedAt: new Date(),
          closedPrice: currentPrice,
          pnl,
          entryTime: position.entryTime,
        },
      }),
    ])

    return NextResponse.json({
      type: 'partial',
      ratio: Math.round(ratio * 10000) / 100, // 퍼센트 (소수점 2자리)
      remaining: updatedOriginal,
      closed: closedPosition,
    })
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

    // ── Reverse: 현재 포지션 청산 + 반대 방향 신규 진입 ──
    if (body.action === 'reverse' && position.status === 'OPEN') {
      // 1) 현재가 조회 (슬리피지 적용)
      const priceRes = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${position.symbol}`
      )
      const priceData = await priceRes.json()
      const binancePrice = parseFloat(priceData.price)
      // 청산 시 불리 슬리피지
      const closePrice = applySlippage(binancePrice, position.side as 'LONG' | 'SHORT')

      // 2) 기존 포지션 청산 PnL 계산
      let rawPnl: number
      if (position.side === 'LONG') {
        rawPnl = (closePrice - position.entryPrice) * position.quantity
      } else {
        rawPnl = (position.entryPrice - closePrice) * position.quantity
      }
      const entryFee = position.entryFee || 0
      const closeFee = position.quantity * closePrice * TAKER_FEE_RATE
      const pnl = rawPnl - entryFee - closeFee

      // 3) 기존 포지션 CLOSED_MANUAL 처리
      await prisma.position.update({
        where: { id: params.id },
        data: {
          status: 'CLOSED_MANUAL',
          closedAt: new Date(),
          closedPrice: closePrice,
          pnl,
        },
      })

      // 4) 반대 방향 신규 포지션 생성 (동일 마진, 동일 레버리지)
      const newSide = position.side === 'LONG' ? 'SHORT' : 'LONG'
      const margin = position.amount / position.leverage
      const newAmount = margin * position.leverage  // 동일 명목가치
      // 진입 시 불리 슬리피지
      const { applySlippage: applyEntrySlippage } = await import('@/lib/calculations')
      const newEntryPrice = applyEntrySlippage(binancePrice, newSide)
      const newQuantity = newAmount / newEntryPrice
      const newEntryFee = newAmount * TAKER_FEE_RATE

      // TP/SL 반전: LONG의 TP는 SHORT의 SL, LONG의 SL은 SHORT의 TP
      let newTP: number | null = null
      let newSL: number | null = null
      if (position.takeProfit != null || position.stopLoss != null) {
        // TP/SL은 진입가 기준 비율로 저장 → 새 진입가에 동일 비율 적용
        if (position.takeProfit != null) {
          const tpRatio = position.takeProfit / position.entryPrice
          // 반대 방향에서 TP는 같은 방향의 비율 유지
          newTP = Math.round(newEntryPrice * tpRatio * 100) / 100
        }
        if (position.stopLoss != null) {
          const slRatio = position.stopLoss / position.entryPrice
          newSL = Math.round(newEntryPrice * slRatio * 100) / 100
        }
      }

      const newPosition = await prisma.position.create({
        data: {
          userId: position.userId,
          symbol: position.symbol,
          side: newSide,
          leverage: position.leverage,
          inputPrice: binancePrice,
          entryPrice: newEntryPrice,
          amount: newAmount,
          quantity: newQuantity,
          marginMode: position.marginMode,
          orderType: 'MARKET',
          entryFee: newEntryFee,
          takeProfit: newTP,
          stopLoss: newSL,
          status: 'OPEN',
          entryTime: new Date(),
        },
      })

      return NextResponse.json({ type: 'reverse', closed: { id: params.id, pnl }, opened: newPosition })
    }

    // ── Partial close: 마진 또는 수량 기준 부분 익절 ──
    if (body.action === 'partialClose' && position.status === 'OPEN') {
      let ratio: number

      if (body.closeQuantity != null) {
        // 수량 기준 부분 청산
        const closeQuantity = parseFloat(body.closeQuantity)
        if (isNaN(closeQuantity) || closeQuantity <= 0) {
          return NextResponse.json({ error: '유효한 수량을 입력하세요.' }, { status: 400 })
        }
        if (closeQuantity >= position.quantity) {
          return NextResponse.json({ error: '전체 수량 이상 입력 시 전체 청산 버튼을 사용하세요.' }, { status: 400 })
        }
        ratio = closeQuantity / position.quantity
      } else if (body.closeMargin != null) {
        // 마진 기준 부분 청산 (기존 로직)
        const closeMargin = parseFloat(body.closeMargin)
        if (isNaN(closeMargin) || closeMargin <= 0) {
          return NextResponse.json({ error: '유효한 금액을 입력하세요.' }, { status: 400 })
        }
        const totalMargin = position.amount / position.leverage
        if (closeMargin >= totalMargin) {
          return NextResponse.json({ error: '전체 마진 이상 입력 시 전체 청산 버튼을 사용하세요.' }, { status: 400 })
        }
        ratio = closeMargin / totalMargin
      } else {
        return NextResponse.json({ error: 'closeQuantity 또는 closeMargin 중 하나를 입력하세요.' }, { status: 400 })
      }

      const closeQty = position.quantity * ratio
      const closeAmount = position.amount * ratio

      // 현재가 조회 (시장가 청산)
      const priceRes = await fetch(
        `https://api.binance.com/api/v3/ticker/price?symbol=${position.symbol}`
      )
      const priceData = await priceRes.json()
      const currentPrice = parseFloat(priceData.price)

      // 청산 부분 PnL 계산
      let rawPnl: number
      if (position.side === 'LONG') {
        rawPnl = (currentPrice - position.entryPrice) * closeQty
      } else {
        rawPnl = (position.entryPrice - currentPrice) * closeQty
      }
      const entryFeePortion = (position.entryFee || 0) * ratio
      const closeFee = closeQty * currentPrice * TAKER_FEE_RATE
      const pnl = rawPnl - entryFeePortion - closeFee

      // 부분 청산 이력을 새 CLOSED 포지션으로 생성
      await prisma.position.create({
        data: {
          userId: position.userId,
          symbol: position.symbol,
          side: position.side,
          leverage: position.leverage,
          entryPrice: position.entryPrice,
          inputPrice: position.inputPrice,
          amount: closeAmount,
          quantity: closeQty,
          marginMode: position.marginMode,
          orderType: position.orderType,
          entryFee: entryFeePortion,
          status: 'CLOSED_MANUAL',
          closedAt: new Date(),
          closedPrice: currentPrice,
          pnl,
          entryTime: position.entryTime,
        }
      })

      // 원본 포지션 감소
      const updated = await prisma.position.update({
        where: { id: params.id },
        data: {
          amount: position.amount - closeAmount,
          quantity: position.quantity - closeQty,
          entryFee: (position.entryFee || 0) - entryFeePortion,
        }
      })

      return NextResponse.json(updated)
    }

    const updateData: any = {}
    if (body.teleditVisible !== undefined) updateData.teleditVisible = Boolean(body.teleditVisible)
    if (body.memo1 !== undefined) updateData.memo1 = body.memo1 || null
    if (body.memo2 !== undefined) updateData.memo2 = body.memo2 || null
    if (body.memo3 !== undefined) updateData.memo3 = body.memo3 || null
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
