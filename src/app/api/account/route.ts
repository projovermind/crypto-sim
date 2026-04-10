import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET /api/account — 내 계정 정보
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const data = await prisma.user.findUnique({
    where: { id: user.id },
    select: { id: true, email: true, name: true, role: true, status: true, teledditTemplate: true, teleditApiUrl: true, teleditEmail: true, teleditPassword: true, teleditCloseTemplate: true, teleditProfitTemplate: true, teleditPreEntryTemplate: true, teleditPostEntry1Template: true, teleditPostEntry2Template: true, teleditPostEntry3Template: true, teleditPreCloseTemplate: true, teleditPostClose1Template: true, teleditPostClose2Template: true, teleditPostClose3Template: true, preEntryMinSec: true, preEntryMaxSec: true, preCloseMinSec: true, preCloseMaxSec: true, createdAt: true },
  })

  if (!data) {
    return NextResponse.json({ error: '유저를 찾을 수 없습니다.' }, { status: 404 })
  }

  return NextResponse.json(data)
}

// PATCH /api/account — 내 계정 정보 수정 (아이디, 이름, 비밀번호)
export async function PATCH(request: NextRequest) {
  const authUser = await getAuthUser(request)
  if (!authUser) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  const body = await request.json()
  const { email, name, currentPassword, newPassword, teledditTemplate, teleditApiUrl, teleditEmail, teleditPassword, teleditCloseTemplate, teleditProfitTemplate, teleditPreEntryTemplate, teleditPostEntry1Template, teleditPostEntry2Template, teleditPostEntry3Template, teleditPreCloseTemplate, teleditPostClose1Template, teleditPostClose2Template, teleditPostClose3Template, preEntryMinSec, preEntryMaxSec, preCloseMinSec, preCloseMaxSec } = body

  const user = await prisma.user.findUnique({ where: { id: authUser.id } })
  if (!user) {
    return NextResponse.json({ error: '유저를 찾을 수 없습니다.' }, { status: 404 })
  }

  const updateData: any = {}

  // 아이디(email) 변경
  if (email && email !== user.email) {
    if (!/^[a-zA-Z0-9_]{3,20}$/.test(email)) {
      return NextResponse.json({ error: '아이디는 3~20자 영문, 숫자, _ 만 가능합니다.' }, { status: 400 })
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    if (existing) {
      return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 400 })
    }
    updateData.email = email
  }

  // 이름 변경
  if (name && name !== user.name) {
    if (name.length < 1 || name.length > 30) {
      return NextResponse.json({ error: '이름은 1~30자여야 합니다.' }, { status: 400 })
    }
    updateData.name = name
  }

  // 비밀번호 변경
  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: '현재 비밀번호를 입력해주세요.' }, { status: 400 })
    }
    const isValid = await bcrypt.compare(currentPassword, user.password)
    if (!isValid) {
      return NextResponse.json({ error: '현재 비밀번호가 일치하지 않습니다.' }, { status: 400 })
    }
    if (newPassword.length < 4) {
      return NextResponse.json({ error: '새 비밀번호는 4자 이상이어야 합니다.' }, { status: 400 })
    }
    updateData.password = await bcrypt.hash(newPassword, 12)
  }

  // 텔레딧 템플릿 변경
  if (teledditTemplate !== undefined) {
    updateData.teledditTemplate = teledditTemplate || null
  }

  // Teledit 연결 정보 변경
  if (teleditApiUrl !== undefined) updateData.teleditApiUrl = teleditApiUrl || null
  if (teleditEmail !== undefined) updateData.teleditEmail = teleditEmail || null
  if (teleditPassword !== undefined) updateData.teleditPassword = teleditPassword || null
  if (teleditCloseTemplate !== undefined) updateData.teleditCloseTemplate = teleditCloseTemplate || null
  if (teleditProfitTemplate !== undefined) updateData.teleditProfitTemplate = teleditProfitTemplate || null

  // 포지션 진입/종료 타이밍 템플릿 변경
  if (teleditPreEntryTemplate !== undefined) updateData.teleditPreEntryTemplate = teleditPreEntryTemplate || null
  if (teleditPostEntry1Template !== undefined) updateData.teleditPostEntry1Template = teleditPostEntry1Template || null
  if (teleditPostEntry2Template !== undefined) updateData.teleditPostEntry2Template = teleditPostEntry2Template || null
  if (teleditPostEntry3Template !== undefined) updateData.teleditPostEntry3Template = teleditPostEntry3Template || null
  if (teleditPreCloseTemplate !== undefined) updateData.teleditPreCloseTemplate = teleditPreCloseTemplate || null
  if (teleditPostClose1Template !== undefined) updateData.teleditPostClose1Template = teleditPostClose1Template || null
  if (teleditPostClose2Template !== undefined) updateData.teleditPostClose2Template = teleditPostClose2Template || null
  if (teleditPostClose3Template !== undefined) updateData.teleditPostClose3Template = teleditPostClose3Template || null

  // 진입/종료 타이밍 초 설정
  if (preEntryMinSec !== undefined) updateData.preEntryMinSec = Number(preEntryMinSec)
  if (preEntryMaxSec !== undefined) updateData.preEntryMaxSec = Number(preEntryMaxSec)
  if (preCloseMinSec !== undefined) updateData.preCloseMinSec = Number(preCloseMinSec)
  if (preCloseMaxSec !== undefined) updateData.preCloseMaxSec = Number(preCloseMaxSec)

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: '변경할 내용이 없습니다.' }, { status: 400 })
  }

  const updated = await prisma.user.update({
    where: { id: authUser.id },
    data: updateData,
    select: { id: true, email: true, name: true, role: true, status: true, teledditTemplate: true, teleditApiUrl: true, teleditEmail: true, teleditPassword: true, teleditCloseTemplate: true, teleditProfitTemplate: true, teleditPreEntryTemplate: true, teleditPostEntry1Template: true, teleditPostEntry2Template: true, teleditPostEntry3Template: true, teleditPreCloseTemplate: true, teleditPostClose1Template: true, teleditPostClose2Template: true, teleditPostClose3Template: true, preEntryMinSec: true, preEntryMaxSec: true, preCloseMinSec: true, preCloseMaxSec: true },
  })

  return NextResponse.json({ ...updated, message: '계정 정보가 수정되었습니다.' })
}
