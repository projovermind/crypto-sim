import { NextResponse } from 'next/server'

// 회원 편집·정지·삭제는 POSI 에서 하지 않는다 — 회원 권한의 정본은 소나무 CRM 회원관리의 TAPPO 체크.
const GONE = () =>
  NextResponse.json({ error: 'CRM 에서 관리합니다. 소나무 CRM 회원관리에서 변경하세요.' }, { status: 410 })

export async function PATCH() {
  return GONE()
}

export async function DELETE() {
  return GONE()
}
