import { NextRequest, NextResponse } from 'next/server'
import { getAuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

const TEMPLATE_KEYS = [
  'teledditTemplate', 'teledditLongTemplate', 'teledditShortTemplate',
  'teleditPreEntryTemplate', 'teleditPostEntryTemplate',
  'teleditPreCloseTemplate', 'teleditCloseTemplate',
  'teleditProfitTemplate', 'teleditProfitTemplate2',
]

// GET — 현재 기본 템플릿 조회
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || (user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: TEMPLATE_KEYS } },
  })
  const result: Record<string, string> = {}
  settings.forEach(s => { result[s.key] = s.value })
  return NextResponse.json(result)
}

// PUT — 기본 템플릿 저장 + 전체 유저 일괄 적용
export async function PUT(request: NextRequest) {
  const user = await getAuthUser(request)
  if (!user || (user as any).role !== 'ADMIN') {
    return NextResponse.json({ error: '권한 없음' }, { status: 403 })
  }

  const body = await request.json()

  // SystemSetting에 저장
  for (const key of TEMPLATE_KEYS) {
    if (body[key] !== undefined) {
      await prisma.systemSetting.upsert({
        where: { key },
        create: { key, value: body[key] || '' },
        update: { value: body[key] || '' },
      })
    }
  }

  // 전체 유저에 일괄 적용
  const updateData: Record<string, string> = {}
  for (const key of TEMPLATE_KEYS) {
    if (body[key] !== undefined) updateData[key] = body[key] || null
  }
  if (Object.keys(updateData).length > 0) {
    const result = await prisma.user.updateMany({ data: updateData })
    return NextResponse.json({ saved: true, usersUpdated: result.count })
  }

  return NextResponse.json({ saved: true, usersUpdated: 0 })
}
