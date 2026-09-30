// 소나무 CRM 인증 위임 클라이언트 — 계약: /tmp/snm-spec/tappo_crm_auth.md
// POST {CRM_BASE_URL}/api/tappo/auth · /api/tappo/check, 헤더 x-tappo-secret = env TAPPO_SHARED_SECRET.

const CRM_BASE_URL = process.env.CRM_BASE_URL || 'https://crm.sonamoo.cc'
const TIMEOUT_MS = 8000

export type CrmAuthResult =
  | { ok: true; user: { crmUserId: string; username: string; name: string | null; isAdmin: boolean } }
  | { ok: false; reason: 'INVALID' | 'NOT_ALLOWED' | 'BLOCKED' | 'LOCKED' }

async function crmPost<T>(path: string, body: unknown): Promise<T> {
  const secret = process.env.TAPPO_SHARED_SECRET
  if (!secret) throw new Error('TAPPO_SHARED_SECRET 미설정')
  const res = await fetch(`${CRM_BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-tappo-secret': secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(TIMEOUT_MS),
    cache: 'no-store',
  })
  if (!res.ok) throw new Error(`CRM ${path} HTTP ${res.status}`)
  return (await res.json()) as T
}

/** 던지면 CRM 장애(네트워크·타임아웃·비밀 불일치) — 호출부가 「연결할 수 없습니다」로 처리한다. */
export function crmAuthenticate(username: string, password: string): Promise<CrmAuthResult> {
  return crmPost<CrmAuthResult>('/api/tappo/auth', { username, password })
}

export async function crmCheck(crmUserId: string): Promise<{ allowed: boolean; name: string | null }> {
  const r = await crmPost<{ ok: boolean; allowed: boolean; name?: string | null }>('/api/tappo/check', { crmUserId })
  return { allowed: !!r.ok && !!r.allowed, name: r.name ?? null }
}

export async function crmCheckAllowed(crmUserId: string): Promise<boolean> {
  return (await crmCheck(crmUserId)).allowed
}
