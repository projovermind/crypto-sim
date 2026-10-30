import { NextRequest, NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { prisma } from '@/lib/prisma'
import { calculateFee } from '@/lib/calculations'
import { generateAutoComments } from '@/lib/auto-comments'
import { crmCheckAllowed } from '@/lib/crm-auth'
import { parseSyncPayload, runAiExpertSync, type SyncDeps } from '@/lib/ai-expert-sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.POSI_AI_EXPERT_TOKEN
  if (!secret) return false
  const header = request.headers.get('authorization') || ''
  const a = Buffer.from(header)
  const b = Buffer.from(`Bearer ${secret}`)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** /api/positions POST 와 같은 규칙: 유저 설정 범위에서 반응 개수를 뽑아 DB 에 고정. */
function buildReactionData(u: any): string {
  const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))
  let s: Record<string, any> | null = null
  try { if (u.reactionSettings) s = JSON.parse(u.reactionSettings) } catch {}
  const d = {
    heart: [Number(u.reactionHeartMin ?? 20), Number(u.reactionHeartMax ?? 30)],
    thumb: [Number(u.reactionThumbMin ?? 20), Number(u.reactionThumbMax ?? 30)],
    fire: [Number(u.reactionFireMin ?? 20), Number(u.reactionFireMax ?? 30)],
  }
  const out: Record<string, { heart: number; thumb: number; fire: number }> = {}
  for (const t of ['preEntry', 'long', 'short', 'postEntry', 'preClose', 'close', 'profit1', 'profit2']) {
    const x = s?.[t]
    out[t] = {
      heart: rand(x?.heart?.[0] ?? d.heart[0], x?.heart?.[1] ?? d.heart[1]),
      thumb: rand(x?.thumb?.[0] ?? d.thumb[0], x?.thumb?.[1] ?? d.thumb[1]),
      fire: rand(x?.fire?.[0] ?? d.fire[0], x?.fire?.[1] ?? d.fire[1]),
    }
  }
  return JSON.stringify(out)
}

const deps: SyncDeps = {
  findUserByLogin: (login) => prisma.user.findUnique({ where: { email: login } }) as any,
  // TODO: CRM 에 AI본부 소속 판정 API 가 생기면 여기서 교체. 현재는 CRM 연결 + TAPPO 허용 여부로 판정.
  isAiExpertMember: (crmUserId) => crmCheckAllowed(crmUserId),
  messageExists: async (userId, sendTime, content) =>
    (await prisma.teleditMessage.count({ where: { userId, sendTime, content } })) > 0,
  createMessage: async (userId, m) => {
    await prisma.teleditMessage.create({ data: { userId, content: m.content, sendTime: m.sendTime } })
  },
  positionExists: async (userId, symbol, entryTime) =>
    (await prisma.position.count({ where: { userId, symbol, entryTime, deletedAt: null } })) > 0,
  createPosition: (userId, p, user) =>
    prisma.position.create({
      data: {
        userId,
        symbol: p.symbol,
        side: p.side,
        leverage: p.leverage,
        // 진입가 그대로 — 슬리피지 미적용
        entryPrice: p.entryPrice,
        inputPrice: p.entryPrice,
        amount: p.amount,
        quantity: p.amount / p.entryPrice,
        orderType: 'MARKET',
        marginMode: p.marginMode,
        entryFee: calculateFee(p.amount, 'MARKET'),
        takeProfit: p.takeProfit,
        status: 'OPEN',
        entryTime: p.entryTime,
        reactionData: buildReactionData(user),
      },
      select: { id: true },
    }),
  generateAutoComments: (positionId, side, user) =>
    generateAutoComments(positionId, side, user as any, {
      name: user.name,
      nickname1: user.nickname1,
      nickname2: user.nickname2,
      entryWaitWord: user.entryWaitWord,
      profitProofWord: user.profitProofWord,
    }),
}

// POST /api/internal/ai-expert/sync
export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'JSON 형식이 올바르지 않습니다.' }, { status: 400 })
  }
  const parsed = parseSyncPayload(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  try {
    const { status, ...rest } = await runAiExpertSync(parsed.payload, deps)
    return NextResponse.json(status === 200 ? { ok: true, ...rest } : rest, { status })
  } catch (error) {
    console.error('[ai-expert/sync] 실패:', error)
    return NextResponse.json({ error: '동기화 처리에 실패했습니다.' }, { status: 500 })
  }
}
