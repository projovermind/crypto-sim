import { prisma } from './prisma'

/** min~max 범위에서 랜덤 정수 (둘 다 0이면 0 반환) */
function randInt(min: number, max: number): number {
  if (min <= 0 && max <= 0) return 0
  const lo = Math.max(0, min)
  const hi = Math.max(lo, max)
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

/** 작성자 정보로 {{name}}, {{nickname1}}, {{nickname2}} 치환 */
function replaceVars(
  content: string,
  author: { name: string; nickname1?: string | null; nickname2?: string | null },
): string {
  return content
    .replace(/\{\{name\}\}/g, author.name)
    .replace(/\{\{nickname1\}\}/g, author.nickname1 ?? '')
    .replace(/\{\{nickname2\}\}/g, author.nickname2 ?? '')
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
): Promise<void> {
  // 1) 작성자 풀 & 댓글 풀 로드
  const [authors, allComments] = await Promise.all([
    prisma.commentAuthorPool.findMany(),
    prisma.commentPool.findMany(),
  ])

  // 작성자 풀이 비어있으면 스킵
  if (authors.length === 0) return

  // 2) 메시지 타입별 설정 매핑
  const directionType = side === 'LONG' ? 'long' : 'short'
  const typeConfigs: Array<{
    type: string
    min: number
    max: number
  }> = [
    { type: 'preEntry', min: user.preEntryCommentMin, max: user.preEntryCommentMax },
    { type: directionType, min: side === 'LONG' ? user.longCommentMin : user.shortCommentMin, max: side === 'LONG' ? user.longCommentMax : user.shortCommentMax },
    { type: 'postEntry', min: user.postEntryCommentMin, max: user.postEntryCommentMax },
    { type: 'preClose', min: user.preCloseCommentMin, max: user.preCloseCommentMax },
    { type: 'close', min: user.closeCommentMin, max: user.closeCommentMax },
    { type: 'profit1', min: user.profit1CommentMin, max: user.profit1CommentMax },
    { type: 'profit2', min: user.profit2CommentMin, max: user.profit2CommentMax },
  ]

  // 3) 각 타입별 댓글 생성
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
    const count = Math.min(randInt(config.min, config.max), 110)
    if (count <= 0) continue

    // 해당 타입의 댓글 풀 필터링
    const pool = allComments.filter((c) => c.type === config.type)
    if (pool.length === 0) continue

    // 각 슬롯마다 독립적으로 작성자 선택 (중복 허용)
    for (let i = 0; i < count; i++) {
      const author = authors[Math.floor(Math.random() * authors.length)]
      const comment = pool[Math.floor(Math.random() * pool.length)]
      allNewComments.push({
        positionId,
        messageType: config.type,
        authorName: author.nickname1 ?? author.name,
        avatarUrl: author.avatarUrl,
        nickname1: author.nickname1 ?? null,
        nickname2: author.nickname2 ?? null,
        content: replaceVars(comment.content, author),
        orderIndex: i, // 임시 인덱스, 셔플 후 재할당
      })
    }
  }

  // 4) 전체 순서 랜덤화
  if (allNewComments.length > 0) {
    allNewComments.sort(() => Math.random() - 0.5)
    allNewComments.forEach((item, i) => {
      item.orderIndex = i
    })
    await prisma.positionComment.createMany({ data: allNewComments })
  }
}
