// 실행: node --test tests/ai-expert-sync.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseAiExpertLogins, parseSyncPayload, runAiExpertSync, type SyncDeps, type SyncUser } from '../src/lib/ai-expert-sync.ts'

const user: SyncUser = { id: 'u1', name: '홍', crmUserId: 'c1' }

function fakeDeps(over: Partial<SyncDeps> = {}) {
  const msgs: string[] = []
  const poss: Array<{ symbol: string; entryTime: Date; entryPrice: number }> = []
  const comments: string[] = []
  const deps: SyncDeps = {
    findUserByLogin: async (l) => (l === 'ai1' || l === 'notlisted' ? user : null),
    isAiExpertMember: async (l) => l === 'ai1',
    messageExists: async (_u, t, c) => msgs.includes(`${t.toISOString()}|${c}`),
    createMessage: async (_u, m) => { msgs.push(`${m.sendTime.toISOString()}|${m.content}`) },
    positionExists: async (_u, s, t) => poss.some((p) => p.symbol === s && p.entryTime.getTime() === t.getTime()),
    createPosition: async (_u, p) => { poss.push(p); return { id: `p${poss.length}` } },
    generateAutoComments: async (id) => { comments.push(id) },
    ...over,
  }
  return { deps, msgs, poss, comments }
}

const body = {
  login: 'ai1',
  messages: [{ content: '안녕', sendTime: '2026-10-30T01:00:00Z' }],
  positions: [{ symbol: 'btcusdt', side: 'LONG', leverage: 10, marginMode: 'ISOLATED', entryPrice: 68000.5, amount: 1000, takeProfit: 70000, entryTime: '2026-10-30T02:00:00Z' }],
}

test('파싱: 심볼 대문자화·진입가 그대로', () => {
  const r = parseSyncPayload(body)
  assert.ok(r.ok)
  assert.equal(r.payload.positions[0].symbol, 'BTCUSDT')
  assert.equal(r.payload.positions[0].entryPrice, 68000.5)
})

test('파싱: 잘못된 입력은 거부', () => {
  assert.equal(parseSyncPayload({}).ok, false)
  assert.equal(parseSyncPayload({ login: 'a', messages: [{ content: '', sendTime: 'x' }] }).ok, false)
  assert.equal(parseSyncPayload({ login: 'a', positions: [{ ...body.positions[0], side: 'UP' }] }).ok, false)
  assert.equal(parseSyncPayload({ login: 'a', positions: [{ ...body.positions[0], entryPrice: 0 }] }).ok, false)
})

test('목록 밖/없는 계정은 403', async () => {
  const p = (parseSyncPayload(body) as any).payload
  for (const login of ['nobody', 'notlisted']) {
    const { deps } = fakeDeps()
    assert.equal((await runAiExpertSync({ ...p, login }, deps)).status, 403)
  }
  const { deps, msgs } = fakeDeps({ isAiExpertMember: async () => false })
  assert.equal((await runAiExpertSync(p, deps)).status, 403)
  assert.equal(msgs.length, 0)
})

test('멱등: 두 번째 호출은 전부 skip, 자동댓글은 신규에만', async () => {
  const p = (parseSyncPayload(body) as any).payload
  const { deps, comments, poss } = fakeDeps()
  const r1: any = await runAiExpertSync(p, deps)
  assert.deepEqual([r1.messages.created, r1.positions.created], [1, 1])
  const r2: any = await runAiExpertSync(p, deps)
  assert.deepEqual([r2.messages.skipped, r2.positions.skipped, r2.positions.created], [1, 1, 0])
  assert.equal(comments.length, 1)
  assert.equal(poss[0].entryPrice, 68000.5)
})

test('한 건 실패가 나머지를 막지 않고, 댓글 실패는 포지션 생성을 유지', async () => {
  const p = (parseSyncPayload({ ...body, positions: [body.positions[0], { ...body.positions[0], symbol: 'ETHUSDT' }] }) as any).payload
  const { deps } = fakeDeps({
    createPosition: async (_u, pos) => { if (pos.symbol === 'ETHUSDT') throw new Error('boom'); return { id: 'x' } },
    generateAutoComments: async () => { throw new Error('cm') },
  })
  const r: any = await runAiExpertSync(p, deps)
  assert.deepEqual([r.positions.created, r.positions.failed], [1, 1])
  assert.ok(r.errors.some((e: string) => e.includes('autoComments')))
})

test('같은 요청 안의 중복 항목은 순차 처리로 skip', async () => {
  const p = (parseSyncPayload({ ...body, positions: [body.positions[0], body.positions[0]] }) as any).payload
  const { deps } = fakeDeps()
  const r: any = await runAiExpertSync(p, deps)
  assert.deepEqual([r.positions.created, r.positions.skipped], [1, 1])
})

test('허용 목록: 기본값·env 파싱(공백·대소문자)', () => {
  assert.deepEqual([...parseAiExpertLogins(undefined)], ['e82100406', 'e5777e742', 'e6fe15aa2'])
  assert.equal(parseAiExpertLogins('  ').size, 3)
  assert.deepEqual([...parseAiExpertLogins(' A1 , b2,, ')], ['a1', 'b2'])
})
