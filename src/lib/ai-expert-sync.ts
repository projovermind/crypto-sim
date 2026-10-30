// AI 전문가 동기화 — POST /api/internal/ai-expert/sync 의 핵심 로직.
// DB·CRM·자동댓글은 deps 로 주입한다(라우트가 실제 구현을 넘기고, 테스트는 가짜를 넘긴다).

export interface SyncMessageInput {
  content: string
  sendTime: Date
}

export interface SyncPositionInput {
  symbol: string
  side: 'LONG' | 'SHORT'
  leverage: number
  marginMode: 'CROSS' | 'ISOLATED'
  entryPrice: number
  amount: number
  takeProfit: number | null
  entryTime: Date
}

export interface SyncPayload {
  login: string
  messages: SyncMessageInput[]
  positions: SyncPositionInput[]
}

export type ParseResult = { ok: true; payload: SyncPayload } | { ok: false; error: string }

const MAX_ITEMS = 500

function toDate(v: unknown): Date | null {
  if (typeof v !== 'string' && typeof v !== 'number') return null
  const d = new Date(v)
  return isNaN(d.getTime()) ? null : d
}

function toPositive(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) && n > 0 ? n : null
}

/** body 검증·정규화. 한 건이라도 형식이 틀리면 전체를 400 으로 거부한다(부분 반영 방지). */
export function parseSyncPayload(body: unknown): ParseResult {
  if (!body || typeof body !== 'object') return { ok: false, error: 'body 가 필요합니다.' }
  const b = body as Record<string, unknown>
  const login = typeof b.login === 'string' ? b.login.trim() : ''
  if (!login) return { ok: false, error: 'login 이 필요합니다.' }

  const rawMessages = b.messages ?? []
  const rawPositions = b.positions ?? []
  if (!Array.isArray(rawMessages) || !Array.isArray(rawPositions)) {
    return { ok: false, error: 'messages/positions 는 배열이어야 합니다.' }
  }
  if (rawMessages.length > MAX_ITEMS || rawPositions.length > MAX_ITEMS) {
    return { ok: false, error: `messages/positions 는 각 ${MAX_ITEMS}건 이하여야 합니다.` }
  }

  const messages: SyncMessageInput[] = []
  for (const [i, m] of rawMessages.entries()) {
    const content = typeof m?.content === 'string' ? m.content : ''
    const sendTime = toDate(m?.sendTime)
    if (!content.trim() || !sendTime) return { ok: false, error: `messages[${i}]: content/sendTime 이 올바르지 않습니다.` }
    messages.push({ content, sendTime })
  }

  const positions: SyncPositionInput[] = []
  for (const [i, p] of rawPositions.entries()) {
    const symbol = typeof p?.symbol === 'string' ? p.symbol.trim().toUpperCase() : ''
    const side = p?.side
    const leverage = toPositive(p?.leverage)
    const entryPrice = toPositive(p?.entryPrice)
    const amount = toPositive(p?.amount)
    const entryTime = toDate(p?.entryTime)
    const takeProfit = p?.takeProfit == null || p.takeProfit === '' ? null : toPositive(p.takeProfit)
    const err = (what: string) => ({ ok: false as const, error: `positions[${i}]: ${what} 이(가) 올바르지 않습니다.` })
    if (!symbol) return err('symbol')
    if (side !== 'LONG' && side !== 'SHORT') return err('side')
    if (leverage == null) return err('leverage')
    if (entryPrice == null) return err('entryPrice')
    if (amount == null) return err('amount')
    if (!entryTime) return err('entryTime')
    if (p?.takeProfit != null && p.takeProfit !== '' && takeProfit == null) return err('takeProfit')
    positions.push({
      symbol,
      side,
      leverage: Math.round(leverage),
      marginMode: p?.marginMode === 'ISOLATED' ? 'ISOLATED' : 'CROSS',
      entryPrice,
      amount,
      takeProfit,
      entryTime,
    })
  }

  return { ok: true, payload: { login, messages, positions } }
}

export interface SyncUser {
  id: string
  name: string
  crmUserId: string | null
  nickname1?: string | null
  nickname2?: string | null
  entryWaitWord?: string | null
  profitProofWord?: string | null
  [key: string]: unknown // 반응·댓글 설정 컬럼(자동댓글에 그대로 전달)
}

export interface SyncDeps {
  findUserByLogin(login: string): Promise<SyncUser | null>
  /** CRM AI본부 소속 + 사용 허용 여부 */
  isAiExpertMember(crmUserId: string): Promise<boolean>
  messageExists(userId: string, sendTime: Date, content: string): Promise<boolean>
  createMessage(userId: string, m: SyncMessageInput): Promise<void>
  positionExists(userId: string, symbol: string, entryTime: Date): Promise<boolean>
  createPosition(userId: string, p: SyncPositionInput, user: SyncUser): Promise<{ id: string }>
  generateAutoComments(positionId: string, side: 'LONG' | 'SHORT', user: SyncUser): Promise<void>
}

export type SyncOutcome =
  | { status: 403 | 404; error: string }
  | {
      status: 200
      messages: { created: number; skipped: number; failed: number }
      positions: { created: number; skipped: number; failed: number }
      errors: string[]
    }

export async function runAiExpertSync(payload: SyncPayload, deps: SyncDeps): Promise<SyncOutcome> {
  const user = await deps.findUserByLogin(payload.login)
  // 존재 여부를 구분해 노출하지 않는다 — 미연결·비회원 모두 403.
  if (!user || !user.crmUserId) return { status: 403, error: 'AI본부 회원이 아닙니다.' }
  if (!(await deps.isAiExpertMember(user.crmUserId))) return { status: 403, error: 'AI본부 회원이 아닙니다.' }

  const out = {
    messages: { created: 0, skipped: 0, failed: 0 },
    positions: { created: 0, skipped: 0, failed: 0 },
    errors: [] as string[],
  }

  // 항목별 격리 — 한 건 실패가 나머지를 막지 않는다. 같은 요청 안의 중복 항목도 순차 처리로 skip 된다.
  for (const m of payload.messages) {
    try {
      if (await deps.messageExists(user.id, m.sendTime, m.content)) { out.messages.skipped++; continue }
      await deps.createMessage(user.id, m)
      out.messages.created++
    } catch (e) {
      out.messages.failed++
      out.errors.push(`message ${m.sendTime.toISOString()}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  for (const p of payload.positions) {
    try {
      if (await deps.positionExists(user.id, p.symbol, p.entryTime)) { out.positions.skipped++; continue }
      const created = await deps.createPosition(user.id, p, user)
      out.positions.created++
      // 댓글 실패는 포지션 생성 결과에 영향 주지 않는다.
      try {
        await deps.generateAutoComments(created.id, p.side, user)
      } catch (e) {
        out.errors.push(`autoComments ${p.symbol} ${p.entryTime.toISOString()}: ${e instanceof Error ? e.message : String(e)}`)
      }
    } catch (e) {
      out.positions.failed++
      out.errors.push(`position ${p.symbol} ${p.entryTime.toISOString()}: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  return { status: 200, ...out }
}
