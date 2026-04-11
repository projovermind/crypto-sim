import { prisma } from './prisma'

/** min~max 범위에서 랜덤 정수 (둘 다 0이면 0 반환) */
function randInt(min: number, max: number): number {
  if (min <= 0 && max <= 0) return 0
  const lo = Math.max(0, min)
  const hi = Math.max(lo, max)
  return lo + Math.floor(Math.random() * (hi - lo + 1))
}

/** 배열에서 n개 중복 없이 랜덤 추출 */
function pickRandom<T>(arr: T[], n: number): T[] {
  if (n >= arr.length) return [...arr]
  const shuffled = [...arr].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
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
    content: string
    orderIndex: number
  }> = []

  for (const config of typeConfigs) {
    const count = randInt(config.min, config.max)
    if (count <= 0) continue

    // 해당 타입의 댓글 풀 필터링
    const pool = allComments.filter((c) => c.type === config.type)
    if (pool.length === 0) continue

    // 랜덤 작성자 & 랜덤 내용 선택
    const selectedAuthors = pickRandom(authors, count)
    for (let i = 0; i < selectedAuthors.length; i++) {
      const author = selectedAuthors[i]
      const comment = pool[Math.floor(Math.random() * pool.length)]
      allNewComments.push({
        positionId,
        messageType: config.type,
        authorName: author.name,
        avatarUrl: author.avatarUrl,
        content: comment.content,
        orderIndex: i,
      })
    }
  }

  // 4) 한 번에 저장
  if (allNewComments.length > 0) {
    await prisma.positionComment.createMany({ data: allNewComments })
  }
}
