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

  const authors = await prisma.commentAuthorPool.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(authors)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, avatarUrl } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const count = await prisma.commentAuthorPool.count()
  if (count >= 1000) {
    return NextResponse.json({ error: '작성자가 1000개 이상입니다.' }, { status: 400 })
  }

  const author = await prisma.commentAuthorPool.create({
    data: { name, avatarUrl: avatarUrl || null },
  })
  return NextResponse.json(author)
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.commentAuthorPool.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
