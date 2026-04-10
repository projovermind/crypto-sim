import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { applySlippage, applyLimitSlippage, calculateFee, TAKER_FEE_RATE } from '@/lib/calculations'

// GET /api/positions - 내 포지션 목록
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') // 'OPEN', 'CLOSED', or null (all)

    const where: any = { userId: user.id, deletedAt: null }
    if (status === 'OPEN') {
      where.status = 'OPEN'
    } else if (status === 'CLOSED') {
      where.status = { in: ['CLOSED_TP', 'CLOSED_SL', 'CLOSED_MANUAL'] }
    }

    const positions = await prisma.position.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json(positions)
  } catch (error) {
    console.error('GET /api/positions error:', error)
    return NextResponse.json({ error: '포지션 조회 중 오류가 발생했습니다.' }, { status: 500 })
  }
}

// POST /api/positions - 새 포지션 생성
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthUser(request)
    if (!user) {
      return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
    }

    const userId = user.id
    const body = await request.json()

    const { symbol, side, leverage, marginMode, entryPrice, inputPrice: rawInputPrice, amount, takeProfit, stopLoss, entryTime, orderType: rawOrderType, volatileMode } = body
    const orderType = rawOrderType === 'LIMIT' ? 'LIMIT' : 'MARKET'

    // 숫자 안전 변환
    const numEntryPrice = Number(entryPrice)
    const numAmount = Number(amount)
    const numLeverage = Number(leverage)
    const numTP = takeProfit != null ? Number(takeProfit) : null
    const numSL = stopLoss != null ? Number(stopLoss) : null

    // Validation
    if (!symbol || !side) {
      return NextResponse.json({ error: '필수 항목을 모두 입력해주세요.' }, { status: 400 })
    }

    if (!['LONG', 'SHORT'].includes(side)) {
      return NextResponse.json({ error: 'side는 LONG 또는 SHORT여야 합니다.' }, { status: 400 })
    }

    if (isNaN(numEntryPrice) || isNaN(numAmount) || isNaN(numLeverage)) {
      return NextResponse.json({ error: `잘못된 값: price=${entryPrice}, amount=${amount}, leverage=${leverage}` }, { status: 400 })
    }

    if (numEntryPrice <= 0 || numAmount <= 0 || numLeverage <= 0) {
      return NextResponse.json({ error: '가격, 금액, 레버리지는 0보다 커야 합니다.' }, { status: 400 })
    }

    if (numAmount > 10000000) {
      return NextResponse.json({ error: '최대 포지션 크기는 10,000,000 USDT입니다.' }, { status: 400 })
    }

    // 슬리피지 적용 (시장가: 랜덤, 지정가: 랜덤 범위, 급등락: 0.25~0.35% 랜덤)
    const volatileRate = volatileMode ? 0.0008 + Math.random() * 0.0007 + (Math.random() - 0.5) * 0.0001 : undefined
    const finalEntryPrice = orderType === 'MARKET'
      ? applySlippage(numEntryPrice, side as 'LONG' | 'SHORT')
      : applyLimitSlippage(numEntryPrice, side as 'LONG' | 'SHORT', volatileRate)

    // TP/SL validation (슬리피지 적용 후 가격 기준)
    if (side === 'LONG') {
      if (numTP != null && numTP <= finalEntryPrice) {
        return NextResponse.json({ error: '롱 포지션의 TP는 진입가보다 높아야 합니다.' }, { status: 400 })
      }
      if (numSL != null && numSL >= finalEntryPrice) {
        return NextResponse.json({ error: '롱 포지션의 SL은 진입가보다 낮아야 합니다.' }, { status: 400 })
      }
    } else {
      if (numTP != null && numTP >= finalEntryPrice) {
        return NextResponse.json({ error: '숏 포지션의 TP는 진입가보다 낮아야 합니다.' }, { status: 400 })
      }
      if (numSL != null && numSL <= finalEntryPrice) {
        return NextResponse.json({ error: '숏 포지션의 SL은 진입가보다 높아야 합니다.' }, { status: 400 })
      }
    }

    const quantity = numAmount / finalEntryPrice
    const entryFee = calculateFee(numAmount, orderType)

    const position = await prisma.position.create({
      data: {
        userId,
        symbol: symbol.toUpperCase(),
        side,
        leverage: Math.round(numLeverage),
        inputPrice: rawInputPrice != null ? Number(rawInputPrice) : numEntryPrice,
        entryPrice: finalEntryPrice,
        amount: numAmount,
        quantity,
        orderType,
        marginMode: marginMode === 'ISOLATED' ? 'ISOLATED' : 'CROSS',
        entryFee,
        takeProfit: numTP,
        stopLoss: numSL,
        status: 'OPEN',
        entryTime: entryTime ? new Date(entryTime) : new Date(),
      },
    })

    return NextResponse.json(position, { status: 201 })
  } catch (error: any) {
    console.error('POST /api/positions error:', error)
    const msg = error?.message || String(error)
    return NextResponse.json({ error: `포지션 생성 실패: ${msg}` }, { status: 500 })
  }
}
