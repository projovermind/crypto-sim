import { NextRequest, NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { loginViaCrm } from '@/lib/auth'

const AUTH_SECRET = process.env.NEXTAUTH_SECRET || 'crypto-sim-secret-key-change-in-production'

// 사유 코드(loginViaCrm 이 던짐) → HTTP 상태·문구. 문구는 로그인 화면과 같은 뜻.
const FAILURES: Record<string, { status: number; message: string }> = {
  INVALID: { status: 401, message: '아이디 또는 비밀번호가 올바르지 않습니다' },
  NOT_ALLOWED: { status: 403, message: 'TAPPO 사용 권한이 없습니다. 관리자에게 요청하세요' },
  BLOCKED: { status: 403, message: 'CRM 계정이 정지·퇴사 상태입니다' },
  LOCKED: { status: 403, message: '로그인 시도가 많아 잠시 잠겼습니다' },
  ACCOUNT_CONFLICT: { status: 403, message: '이미 다른 CRM 계정에 연결된 아이디입니다. 관리자에게 문의하세요' },
  CRM_UNAVAILABLE: { status: 503, message: 'CRM 인증 서버에 연결할 수 없습니다' },
}

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()

    if (!email || !password) {
      return NextResponse.json({ message: '이메일과 비밀번호를 입력하세요' }, { status: 400 })
    }

    let user
    try {
      user = await loginViaCrm(email, password)
    } catch (e) {
      const failure = FAILURES[e instanceof Error ? e.message : '']
      if (!failure) throw e
      return NextResponse.json({ message: failure.message }, { status: failure.status })
    }

    const token = await encode({
      token: { id: user.id, email: user.email, name: user.name, role: user.role, crmUserId: user.crmUserId },
      secret: AUTH_SECRET,
    })

    return NextResponse.json({ token })
  } catch (err) {
    console.error('[extension/login]', err)
    return NextResponse.json({ message: '서버 오류' }, { status: 500 })
  }
}
