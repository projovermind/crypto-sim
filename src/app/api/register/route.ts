import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { TELEDIT_TEMPLATE_DEFAULTS } from '@/lib/teledit-defaults'

export async function POST(request: Request) {
  try {
    const { email, name, password } = await request.json()

    if (!email || !name || !password) {
      return NextResponse.json(
        { error: '아이디, 이름, 비밀번호를 모두 입력해주세요.' },
        { status: 400 }
      )
    }

    if (email.length < 3 || email.length > 20) {
      return NextResponse.json(
        { error: '아이디는 3~20자여야 합니다.' },
        { status: 400 }
      )
    }

    if (!/^[a-zA-Z0-9_]+$/.test(email)) {
      return NextResponse.json(
        { error: '아이디는 영문, 숫자, 밑줄(_)만 사용 가능합니다.' },
        { status: 400 }
      )
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: '비밀번호는 최소 4자 이상이어야 합니다.' },
        { status: 400 }
      )
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    })

    if (existing) {
      return NextResponse.json(
        { error: '이미 존재하는 아이디입니다.' },
        { status: 409 }
      )
    }

    const hashedPassword = await bcrypt.hash(password, 12)

    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hashedPassword,
        role: 'USER',
        status: 'PENDING',
        ...TELEDIT_TEMPLATE_DEFAULTS,
      },
    })

    return NextResponse.json({
      id: user.id,
      name: user.name,
      status: 'PENDING',
    })
  } catch (error) {
    console.error('Register error:', error)
    return NextResponse.json(
      { error: '회원가입 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
