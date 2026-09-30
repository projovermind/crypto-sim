// POSI User ↔ 소나무 CRM 계정 연결 — 리드가 넘긴 매핑 TSV 로만 연결한다(CRM 을 직접 조회하지 않는다).
//   npx tsx scripts/link_crm_users.ts <매핑.tsv>            # 드라이런(기본, 쓰기 없음)
//   npx tsx scripts/link_crm_users.ts <매핑.tsv> --apply    # 실제 반영
// TSV: `#` 줄 무시, 탭 구분 — posiEmail  crmUserId  crmLogin  근거  POSI상태  CRM퇴사일
//   · POSI User.email 로 행을 찾아 crmUserId 를 채운다(로컬 email 은 바꾸지 않는다).
//   · 6번째 칸(CRM퇴사일)이 있으면 그 행의 status 를 SUSPENDED 로 함께 바꾼다.
//   · crmUserId 가 이미 다른 행에 걸려 있으면 건너뛰고 경고. 이미 같은 값이면 변경 없음.

import { readFileSync } from 'fs'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const file = process.argv[2]
  const apply = process.argv.includes('--apply')
  if (!file || file.startsWith('--')) {
    console.error('사용법: npx tsx scripts/link_crm_users.ts <매핑.tsv> [--apply]')
    process.exit(1)
  }

  const rows = readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((l) => l.trim() && !l.startsWith('#'))
    .map((l) => l.split('\t'))

  console.log(`${apply ? '[APPLY]' : '[DRY-RUN]'} 매핑 ${rows.length}줄`)
  let linked = 0, suspended = 0, skipped = 0

  for (const [posiEmail, crmUserId, crmLogin, , , resignedDate] of rows) {
    if (!posiEmail || !crmUserId) { console.warn(`⚠️ 칸 부족, 건너뜀: ${posiEmail ?? '(빈 줄)'}`); skipped++; continue }

    const user = await prisma.user.findUnique({ where: { email: posiEmail } })
    if (!user) { console.warn(`⚠️ POSI 에 ${posiEmail} 없음, 건너뜀`); skipped++; continue }

    const holder = await prisma.user.findUnique({ where: { crmUserId } })
    if (holder && holder.id !== user.id) {
      console.warn(`⚠️ ${posiEmail}: crmUserId ${crmUserId} 는 이미 ${holder.email} 에 연결됨, 건너뜀`)
      skipped++
      continue
    }
    if (user.crmUserId && user.crmUserId !== crmUserId) {
      console.warn(`⚠️ ${posiEmail}: 이미 다른 crmUserId(${user.crmUserId}) 에 연결됨, 건너뜀`)
      skipped++
      continue
    }

    const data: { crmUserId?: string; status?: string } = {}
    if (user.crmUserId !== crmUserId) data.crmUserId = crmUserId
    const willSuspend = !!resignedDate?.trim() && user.status !== 'SUSPENDED'
    if (willSuspend) data.status = 'SUSPENDED'

    const note = [
      data.crmUserId ? `연결 → CRM ${crmLogin ?? ''}(${crmUserId})` : '연결됨(변경 없음)',
      willSuspend ? `status ${user.status} → SUSPENDED (CRM 퇴사 ${resignedDate})` : '',
    ].filter(Boolean).join(' · ')
    console.log(`  ${posiEmail}: ${note}`)

    if (data.crmUserId) linked++
    if (willSuspend) suspended++
    if (apply && Object.keys(data).length) await prisma.user.update({ where: { id: user.id }, data })
  }

  console.log(`요약: 연결 ${linked} · 정지 ${suspended} · 건너뜀 ${skipped}${apply ? '' : ' (드라이런 — --apply 로 반영)'}`)
}

main().finally(() => prisma.$disconnect())
