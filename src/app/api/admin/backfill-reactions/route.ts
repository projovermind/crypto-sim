import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(request: NextRequest) {
  // Bearer token 또는 세션 인증
  let isAdmin = false
  const authUser = await getAuthUser(request)
  if (authUser && (authUser as any).role === 'ADMIN') isAdmin = true
  if (!isAdmin) {
    const session = await getServerSession(authOptions)
    if (session?.user && (session.user as any).role === 'ADMIN') isAdmin = true
  }
  if (!isAdmin) return NextResponse.json({ error: 'Admin only' }, { status: 403 })

  const rand = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1))

  // reactionData가 없는 포지션만
  const positions = await prisma.position.findMany({
    where: { reactionData: null },
    include: { user: true },
  })

  let updated = 0
  for (const pos of positions) {
    const u = pos.user as any
    let rxS: Record<string, any> | null = null
    try { if (u.reactionSettings) rxS = JSON.parse(u.reactionSettings) } catch {}
    const rxD = {
      heart: [Number(u.reactionHeartMin ?? 20), Number(u.reactionHeartMax ?? 30)],
      thumb: [Number(u.reactionThumbMin ?? 20), Number(u.reactionThumbMax ?? 30)],
      fire:  [Number(u.reactionFireMin  ?? 20), Number(u.reactionFireMax  ?? 30)],
    }

    const reactionData: Record<string, { heart: number; thumb: number; fire: number }> = {}
    for (const t of ['preEntry','long','short','postEntry','preClose','close','profit1','profit2']) {
      const s = rxS?.[t]
      reactionData[t] = {
        heart: rand(s?.heart?.[0] ?? rxD.heart[0], s?.heart?.[1] ?? rxD.heart[1]),
        thumb: rand(s?.thumb?.[0] ?? rxD.thumb[0], s?.thumb?.[1] ?? rxD.thumb[1]),
        fire:  rand(s?.fire?.[0]  ?? rxD.fire[0],  s?.fire?.[1]  ?? rxD.fire[1]),
      }
    }

    await prisma.position.update({
      where: { id: pos.id },
      data: { reactionData: JSON.stringify(reactionData) },
    })
    updated++
  }

  return NextResponse.json({ updated, total: positions.length })
}
