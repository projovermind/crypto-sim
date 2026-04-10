import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const type = req.nextUrl.searchParams.get('type')
  if (!type) return NextResponse.json({ error: 'type required' }, { status: 400 })

  const comments = await prisma.commentPool.findMany({
    where: { type },
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(comments)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const { type, content } = await req.json()
  if (!type || !content) return NextResponse.json({ error: 'type, content required' }, { status: 400 })

  const count = await prisma.commentPool.count({ where: { type } })
  if (count >= 5000) return NextResponse.json({ error: '해당 타입 댓글이 5000개 이상입니다.' }, { status: 400 })

  const comment = await prisma.commentPool.create({ data: { type, content } })
  return NextResponse.json(comment)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.commentPool.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
