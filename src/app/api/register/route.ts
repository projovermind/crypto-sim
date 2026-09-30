import { NextResponse } from 'next/server'

// 회원가입 비활성 — 로그인은 소나무 CRM 계정에 위임한다(src/lib/auth.ts).
export async function POST() {
  return NextResponse.json({ error: 'CRM 계정으로 로그인하세요.' }, { status: 410 })
}
