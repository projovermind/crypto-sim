import { NextRequest, NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'

const AUTH_SECRET = process.env.NEXTAUTH_SECRET || 'crypto-sim-secret-key-change-in-production'

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ message: '이메일과 비밀번호를 입력하세요' }, { status: 400 })
    }

    const user = await prisma.user.findUnique({ where: { email } })
    if (!user) {
      return NextResponse.json({ message: '이메일 또는 비밀번호가 올바르지 않습니다' }, { status: 401 })
    }

    const isValid = await bcrypt.compare(password, user.password)
    if (!isValid) {
      return NextResponse.json({ message: '이메일 또는 비밀번호가 올바르지 않습니다' }, { status: 401 })
    }

    if (user.status === 'SUSPENDED') {
      return NextResponse.json({ message: '정지된 계정입니다' }, { status: 403 })
    }
    if (user.status === 'PENDING') {
      return NextResponse.json({ message: '승인 대기 중인 계정입니다' }, { status: 403 })
    }

    const token = await encode({
      token: { id: user.id, email: user.email, name: user.name, role: user.role },
      secret: AUTH_SECRET,
    })

    return NextResponse.json({ token })
  } catch (err) {
    console.error('[extension/login]', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
