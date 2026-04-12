import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 2 * 1024 * 1024 // 2MB

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const user = await prisma.user.findUnique({
      where: { email: session.user.email },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Only image files are allowed' }, { status: 400 })
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 2MB limit' }, { status: 400 })
    }

    const ext = file.name.split('.').pop() || 'png'
    const blobKey = `channel-avatars/${user.id}.${ext}`

    const { url } = await put(blobKey, file, {
      access: 'public',
      allowOverwrite: true,
    })

    await prisma.user.update({
      where: { id: user.id },
      data: { channelAvatarUrl: url },
    })

    return NextResponse.json({ url })
  } catch (error: any) {
    console.error('[channel-avatar POST]', error?.message || error)
    return NextResponse.json(
      { error: error?.message || 'Internal Server Error' },
      { status: 500 },
    )
  }
}
