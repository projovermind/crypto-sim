import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// PATCH /api/admin/users/[id] — 유저 상태/역할/정보 변경
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAuthUser(request)
    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'MANAGER')) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    const body = await request.json()
    const updateData: any = {}

    if (body.status && ['PENDING', 'APPROVED', 'SUSPENDED'].includes(body.status)) {
      updateData.status = body.status
    }

    // 역할 변경은 ADMIN만 가능
    if (body.role) {
      if (admin.role !== 'ADMIN') {
        return NextResponse.json({ error: '역할 변경은 ADMIN만 가능합니다.' }, { status: 403 })
      }
      if (['USER', 'MANAGER', 'ADMIN'].includes(body.role)) {
        updateData.role = body.role
      }
    }

    // 아이디 변경 (ADMIN만)
    if (body.email) {
      if (admin.role !== 'ADMIN') {
        return NextResponse.json({ error: '계정 정보 변경은 ADMIN만 가능합니다.' }, { status: 403 })
      }
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(body.email)) {
        return NextResponse.json({ error: '아이디는 3~20자 영문, 숫자, _ 만 가능합니다.' }, { status: 400 })
      }
      const existing = await prisma.user.findUnique({ where: { email: body.email } })
      if (existing && existing.id !== params.id) {
        return NextResponse.json({ error: '이미 사용 중인 아이디입니다.' }, { status: 400 })
      }
      updateData.email = body.email
    }

    // 이름 변경 (ADMIN만)
    if (body.name) {
      if (admin.role !== 'ADMIN') {
        return NextResponse.json({ error: '계정 정보 변경은 ADMIN만 가능합니다.' }, { status: 403 })
      }
      updateData.name = body.name
    }

    // 별명 변경 (ADMIN만)
    if ('nickname1' in body) {
      if (admin.role !== 'ADMIN') {
        return NextResponse.json({ error: '계정 정보 변경은 ADMIN만 가능합니다.' }, { status: 403 })
      }
      updateData.nickname1 = body.nickname1 || null
    }
    if ('nickname2' in body) {
      if (admin.role !== 'ADMIN') {
        return NextResponse.json({ error: '계정 정보 변경은 ADMIN만 가능합니다.' }, { status: 403 })
      }
      updateData.nickname2 = body.nickname2 || null
    }
    if ('entryWaitWord' in body) {
      if (admin.role !== 'ADMIN') {
        return NextResponse.json({ error: '계정 정보 변경은 ADMIN만 가능합니다.' }, { status: 403 })
      }
      updateData.entryWaitWord = body.entryWaitWord || null
    }
    if ('profitProofWord' in body) {
      if (admin.role !== 'ADMIN') {
        return NextResponse.json({ error: '계정 정보 변경은 ADMIN만 가능합니다.' }, { status: 403 })
      }
      updateData.profitProofWord = body.profitProofWord || null
    }

    // 비밀번호 초기화 (ADMIN만)
    if (body.newPassword) {
      if (admin.role !== 'ADMIN') {
        return NextResponse.json({ error: '비밀번호 변경은 ADMIN만 가능합니다.' }, { status: 403 })
      }
      if (body.newPassword.length < 4) {
        return NextResponse.json({ error: '비밀번호는 4자 이상이어야 합니다.' }, { status: 400 })
      }
      updateData.password = await bcrypt.hash(body.newPassword, 12)
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: { id: true, email: true, name: true, nickname1: true, nickname2: true, entryWaitWord: true, profitProofWord: true, role: true, status: true },
    })

    return NextResponse.json(updated)
  } catch (error) {
    console.error('PATCH /api/admin/users/[id] error:', error)
    return NextResponse.json({ error: '유저 수정 실패' }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id] — 유저 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const admin = await getAuthUser(request)
    if (!admin || (admin.role !== 'ADMIN' && admin.role !== 'MANAGER')) {
      return NextResponse.json({ error: '관리자 권한이 필요합니다.' }, { status: 403 })
    }

    // 자기 자신 삭제 방지
    if (admin.id === params.id) {
      return NextResponse.json({ error: '자기 자신은 삭제할 수 없습니다.' }, { status: 400 })
    }

    await prisma.position.deleteMany({ where: { userId: params.id } })
    await prisma.user.delete({ where: { id: params.id } })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('DELETE /api/admin/users/[id] error:', error)
    return NextResponse.json({ error: '유저 삭제 실패' }, { status: 500 })
  }
}
