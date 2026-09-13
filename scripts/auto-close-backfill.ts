/**
 * 기존 OPEN 포지션에 자동 종료 규칙(수익 상한 / 최대 보유기간)을 소급 적용한다.
 *
 * 사용법:
 *   npx tsx scripts/auto-close-backfill.ts --dry-run          # 판정만 출력
 *   npx tsx scripts/auto-close-backfill.ts                    # 실제 반영
 *   npx tsx scripts/auto-close-backfill.ts --limit 50
 *
 * DB 를 Teledit 과 공유하므로 반드시 --dry-run 으로 먼저 확인할 것.
 */
import { MAX_POSITION_AGE_DAYS, MAX_PROFIT_USDT } from '../src/lib/calculations'
import { runAutoClose } from '../src/lib/auto-close'

function argValue(flag: string): string | undefined {
  const idx = process.argv.indexOf(flag)
  return idx >= 0 ? process.argv[idx + 1] : undefined
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const limit = parseInt(argValue('--limit') || '1000')

  console.log(
    `자동 종료 소급 적용 — 수익상한 ${MAX_PROFIT_USDT} USDT / 최대 ${MAX_POSITION_AGE_DAYS}일` +
      `${dryRun ? ' (DRY RUN — DB 변경 없음)' : ''}`
  )

  const summary = await runAutoClose({
    limit: Number.isFinite(limit) ? limit : 1000,
    dryRun,
    budgetMs: 30 * 60 * 1000, // 스크립트는 서버리스 제한이 없으므로 넉넉히
  })

  for (const d of summary.decisions) {
    console.log(
      `  ${d.positionId} ${d.symbol} ${d.side} → ${d.status} (${d.reason}) ` +
        `@ ${d.closedPrice.toFixed(4)} / ${d.closedAt.toISOString()} / pnl ${d.pnl.toFixed(2)}`
    )
  }

  for (const e of summary.errors) {
    console.error(`  [실패] ${e.positionId}: ${e.message}`)
  }

  console.log(
    `검사 ${summary.scanned} / 종료 ${summary.closed} / 유지 ${summary.skipped} / 실패 ${summary.failed}` +
      (summary.truncated ? ' (시간 초과로 일부 미처리 — 재실행 필요)' : '')
  )

  if (summary.failed > 0) process.exitCode = 1
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    const { prisma } = await import('../src/lib/prisma')
    await prisma.$disconnect()
  })
