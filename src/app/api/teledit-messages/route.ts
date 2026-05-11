import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions, getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS })
}

async function resolveUserId(request: NextRequest) {
  // 1) 확장 Bearer token
  const authUser = await getAuthUser(request)
  if (authUser) return authUser.id

  // 2) 웹 세션
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) return null
  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  return user?.id ?? null
}

// GET — 유저의 전체 메시지 목록
export async function GET(request: NextRequest) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const messages = await prisma.teleditMessage.findMany({
    where: { userId },
    orderBy: { sendTime: 'asc' },
  })
  return NextResponse.json(messages, { headers: CORS })
}

// POST — 새 메시지 생성
export async function POST(request: NextRequest) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { content, sendTime, imageUrl, commentMin, commentMax } = body

  if (!sendTime) {
    return NextResponse.json({ error: 'sendTime 필수' }, { status: 400 })
  }
  if ((!content || !content.trim()) && !imageUrl) {
    return NextResponse.json({ error: '메시지 내용 또는 이미지 필수' }, { status: 400 })
  }

  const msg = await prisma.teleditMessage.create({
    data: {
      userId,
      content: content || '',
      sendTime: new Date(sendTime),
      imageUrl: imageUrl || null,
      commentMin: commentMin ?? 0,
      commentMax: commentMax ?? 0,
      heartMin: body.heartMin != null ? body.heartMin : (20 + Math.floor(Math.random() * 11)),
      heartMax: body.heartMax != null ? body.heartMax : (20 + Math.floor(Math.random() * 11)),
      thumbMin: body.thumbMin != null ? body.thumbMin : (20 + Math.floor(Math.random() * 11)),
      thumbMax: body.thumbMax != null ? body.thumbMax : (20 + Math.floor(Math.random() * 11)),
      fireMin: body.fireMin != null ? body.fireMin : (20 + Math.floor(Math.random() * 11)),
      fireMax: body.fireMax != null ? body.fireMax : (20 + Math.floor(Math.random() * 11)),
    },
  })
  return NextResponse.json(msg)
}

// PATCH — 메시지 수정
export async function PATCH(request: NextRequest) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  // 소유권 확인
  const existing = await prisma.teleditMessage.findFirst({
    where: { id, userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const data: any = {}
  if (updates.content !== undefined) data.content = updates.content
  if (updates.sendTime !== undefined) data.sendTime = new Date(updates.sendTime)
  if (updates.imageUrl !== undefined) data.imageUrl = updates.imageUrl || null
  if (updates.commentMin !== undefined) data.commentMin = updates.commentMin
  if (updates.commentMax !== undefined) data.commentMax = updates.commentMax
  if (updates.heartMin !== undefined) data.heartMin = updates.heartMin
  if (updates.heartMax !== undefined) data.heartMax = updates.heartMax
  if (updates.thumbMin !== undefined) data.thumbMin = updates.thumbMin
  if (updates.thumbMax !== undefined) data.thumbMax = updates.thumbMax
  if (updates.fireMin !== undefined) data.fireMin = updates.fireMin
  if (updates.fireMax !== undefined) data.fireMax = updates.fireMax
  if (updates.visible !== undefined) data.visible = updates.visible

  const msg = await prisma.teleditMessage.update({
    where: { id },
    data,
  })
  return NextResponse.json(msg)
}

// DELETE — 메시지 삭제
export async function DELETE(request: NextRequest) {
  const userId = await resolveUserId(request)
  if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const id = searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id 필수' }, { status: 400 })

  const existing = await prisma.teleditMessage.findFirst({
    where: { id, userId },
  })
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  await prisma.teleditMessage.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
