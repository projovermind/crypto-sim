import { prisma } from './prisma'

/** min~max 범위에서 랜덤 정수 (둘 다 0이면 0 반환) */
function randInt(min: number, max: number): number {
  if (min <= 0 && max <= 0) return 0
  const lo = Math.max(0, min)
  const hi = Math.max(lo, max)
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

/** 포지션 오픈한 회원 정보로 {{name}}, {{nickname1}}, {{nickname2}}, {{entryWait}}, {{profitProof}} 치환 */
function replaceVars(
  content: string,
  owner: { name: string; nickname1?: string | null; nickname2?: string | null; entryWaitWord?: string | null; profitProofWord?: string | null },
): string {
  return content
    .replace(/\{\{name\}\}/g, owner.name)
    .replace(/\{\{nickname1\}\}/g, owner.nickname1 ?? '')
    .replace(/\{\{nickname2\}\}/g, owner.nickname2 ?? '')
    .replace(/\{\{entryWait\}\}/g, owner.entryWaitWord ?? '')
    .replace(/\{\{profitProof\}\}/g, owner.profitProofWord ?? '')
}

interface UserCommentSettings {
  preEntryCommentMin: number
  preEntryCommentMax: number
  longCommentMin: number
  longCommentMax: number
  shortCommentMin: number
  shortCommentMax: number
  postEntryCommentMin: number
  postEntryCommentMax: number
  preCloseCommentMin: number
  preCloseCommentMax: number
  closeCommentMin: number
  closeCommentMax: number
  profit1CommentMin: number
  profit1CommentMax: number
  profit2CommentMin: number
  profit2CommentMax: number
}

/** 포지션 생성 직후 댓글 자동 생성 */
export async function generateAutoComments(
  positionId: string,
  side: 'LONG' | 'SHORT',
  user: UserCommentSettings,
  owner: { name: string; nickname1?: string | null; nickname2?: string | null; entryWaitWord?: string | null; profitProofWord?: string | null },
): Promise<void> {
  // 1) 작성자 풀 & 댓글 풀 로드
  const [allAuthors, allComments] = await Promise.all([
    prisma.commentAuthorPool.findMany(),
    prisma.commentPool.findMany(),
  ])

  // 작성자 풀이 비어있으면 스킵
  if (allAuthors.length === 0) return

  // 2) 포지션 전용 작성자 선정: 최대 110명 랜덤 셔플 후 상위 선택
  const shuffled = [...allAuthors].sort(() => Math.random() - 0.5)
  const selected = shuffled.slice(0, 110)

  // 선정된 작성자를 PositionCommentAuthor에 저장
  await prisma.positionCommentAuthor.createMany({
    data: selected.map((a) => ({
      positionId,
      authorName: a.name,
      avatarUrl: a.avatarUrl,
      nickname1: a.nickname1,
      nickname2: a.nickname2,
    })),
  })

  // 3) 각 타입별 count를 먼저 확정 (side 규칙 적용)
  const counts = {
    preEntryCount:  randInt(user.preEntryCommentMin,  user.preEntryCommentMax),
    longCount:      side === 'LONG' ? randInt(user.longCommentMin,  user.longCommentMax)  : 0,
    shortCount:     side === 'SHORT' ? randInt(user.shortCommentMin, user.shortCommentMax) : 0,
    postEntryCount: randInt(user.postEntryCommentMin, user.postEntryCommentMax),
    preCloseCount:  randInt(user.preCloseCommentMin,  user.preCloseCommentMax),
    closeCount:     randInt(user.closeCommentMin,     user.closeCommentMax),
    profit1Count:   randInt(user.profit1CommentMin,   user.profit1CommentMax),
    profit2Count:   randInt(user.profit2CommentMin,   user.profit2CommentMax),
  }

  // 확정된 count DB 저장
  await prisma.positionCommentCount.create({
    data: { positionId, ...counts },
  })

  // 4) 타입별 설정 (확정된 count 사용)
  const directionType = side === 'LONG' ? 'long' : 'short'
  const typeConfigs: Array<{ type: string; count: number }> = [
    { type: 'preEntry',    count: counts.preEntryCount },
    { type: directionType, count: side === 'LONG' ? counts.longCount : counts.shortCount },
    { type: 'postEntry',   count: counts.postEntryCount },
    { type: 'preClose',    count: counts.preCloseCount },
    { type: 'close',       count: counts.closeCount },
    { type: 'profit1',     count: counts.profit1Count },
    { type: 'profit2',     count: counts.profit2Count },
  ]

  // 5) 각 타입별 댓글 생성 (선정된 110명 중에서만 작성자 선택)
  const allNewComments: Array<{
    positionId: string
    messageType: string
    authorName: string
    avatarUrl: string | null
    nickname1: string | null
    nickname2: string | null
    content: string
    orderIndex: number
  }> = []

  for (const config of typeConfigs) {
    const count = Math.min(config.count, 110)
    if (count <= 0) continue

    // 해당 타입의 댓글 풀 필터링
    const pool = allComments.filter((c) => c.type === config.type)
    if (pool.length === 0) continue

    // 각 슬롯마다 선정된 작성자 중에서 랜덤 선택 (중복 허용)
    for (let i = 0; i < count; i++) {
      const author = selected[Math.floor(Math.random() * selected.length)]
      const comment = pool[Math.floor(Math.random() * pool.length)]
      allNewComments.push({
        positionId,
        messageType: config.type,
        authorName: author.name,
        avatarUrl: author.avatarUrl,
        nickname1: null,
        nickname2: null,
        content: replaceVars(comment.content, owner),
        orderIndex: i, // 임시 인덱스, 셔플 후 재할당
      })
    }
  }

  // 6) 전체 순서 랜덤화
  if (allNewComments.length > 0) {
    allNewComments.sort(() => Math.random() - 0.5)
    allNewComments.forEach((item, i) => {
      item.orderIndex = i
    })
    await prisma.positionComment.createMany({ data: allNewComments })
  }
}
