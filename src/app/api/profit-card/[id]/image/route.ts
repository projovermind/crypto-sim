import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const user = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true },
  })
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  const position = await prisma.position.findUnique({
    where: { id: params.id },
    select: { id: true, userId: true },
  })
  if (!position) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (position.userId !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { dataUrl } = await request.json()
  const base64 = dataUrl.replace(/^data:image\/png;base64,/, '')
  const buffer = Buffer.from(base64, 'base64')

  const { url } = await put(`profit-cards/${params.id}.png`, buffer, {
    access: 'public',
    addRandomSuffix: false,
    contentType: 'image/png',
  })

  await prisma.position.update({
    where: { id: params.id },
    data: { shareImageUrl: url },
  })

  return NextResponse.json({ url })
}
