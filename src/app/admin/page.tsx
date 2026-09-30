'use client'

const getInitials = (name: string) => {
  const trimmed = name.trim()
  const parts = trimmed.split(/\s+/)
  if (parts.length >= 2) {
    return parts.slice(0, 2).map(w => w[0]?.toUpperCase() || '').join('')
  }
  // 공백 없으면 첫 2글자 (길이 2 이상일 때)
  return trimmed.length >= 2
    ? trimmed[0].toUpperCase() + trimmed[1].toUpperCase()
    : trimmed[0]?.toUpperCase() || ''
}

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface UserItem {
  id: string
  email: string
  name: string
  nickname1: string | null
  nickname2: string | null
  entryWaitWord: string | null
  profitProofWord: string | null
  role: string
  status: string
  crmUserId: string | null
  crmName: string | null
  tappo: 'ALLOWED' | 'DENIED' | 'UNLINKED' | 'ERROR'
  createdAt: string
  _count: { positions: number }
}

type CommentType = 'preEntry' | 'long' | 'short' | 'postEntry' | 'preClose' | 'close' | 'profit1' | 'profit2'

interface CommentItem {
  id: string
  type: string
  content: string
  createdAt: string
}

interface CommentAuthor {
  id: string
  name: string
  avatarUrl: string | null
  createdAt: string
}

const COMMENT_TYPES: { value: CommentType; label: string }[] = [
  { value: 'preEntry', label: '진입 전' },
  { value: 'long', label: '롱' },
  { value: 'short', label: '숏' },
  { value: 'postEntry', label: '진입 후' },
  { value: 'preClose', label: '종료 전' },
  { value: 'close', label: '청산' },
  { value: 'profit1', label: '수익인증1' },
  { value: 'profit2', label: '수익인증2' },
]

type SidebarTab = 'users' | 'teledit'

const SIDEBAR_ITEMS: { key: SidebarTab; label: string }[] = [
  { key: 'users', label: '회원관리' },
  { key: 'teledit', label: '텔레딧 설정' },
]

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [tab, setTab] = useState<SidebarTab>('users')

  // 작성자 풀 관리
  const [authors, setAuthors] = useState<CommentAuthor[]>([])
  const [authorLoading, setAuthorLoading] = useState(false)
  const [authorName, setAuthorName] = useState('')
  const [authorAvatar, setAuthorAvatar] = useState('')
  const [authorMsg, setAuthorMsg] = useState<{ text: string; ok: boolean } | null>(null)
  const [seedLoading, setSeedLoading] = useState(false)

  // 댓글 관리
  const [commentType, setCommentType] = useState<CommentType>('preEntry')
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentLoading, setCommentLoading] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [commentMsg, setCommentMsg] = useState('')

  const userRole = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/login')
    if (status === 'authenticated' && userRole !== 'ADMIN' && userRole !== 'MANAGER') {
      router.push('/dashboard')
    }
  }, [status, userRole, router])

  const fetchUsers = useCallback(async () => {
    try {
      setFetchError('')
      const res = await fetch('/api/admin/users')
      if (res.ok) {
        setUsers(await res.json())
      } else {
        const data = await res.json().catch(() => ({}))
        setFetchError(`유저 목록 로딩 실패 (${res.status}): ${data.error || '알 수 없는 오류'} — 로그아웃 후 재로그인 해보세요.`)
      }
    } catch (e) {
      setFetchError('서버 연결 실패 — 새로고침 해보세요.')
      console.error(e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session && (userRole === 'ADMIN' || userRole === 'MANAGER')) fetchUsers()
  }, [session, userRole, fetchUsers])

  const fetchAuthors = useCallback(async () => {
    setAuthorLoading(true)
    try {
      const res = await fetch('/api/admin/comment-authors')
      if (res.ok) setAuthors(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setAuthorLoading(false)
    }
  }, [])

  const addAuthor = async () => {
    if (!authorName.trim()) return
    setAuthorMsg(null)
    const res = await fetch('/api/admin/comment-authors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: authorName.trim(), avatarUrl: authorAvatar.trim() || null }),
    })
    if (res.ok) {
      setAuthorName('')
      setAuthorAvatar('')
      fetchAuthors()
    } else {
      const data = await res.json().catch(() => ({}))
      setAuthorMsg({ text: data.error || '추가 실패', ok: false })
    }
  }

  const deleteAuthor = async (id: string) => {
    const res = await fetch(`/api/admin/comment-authors?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchAuthors()
    else alert((await res.json().catch(() => ({ error: '삭제 실패' }))).error)
  }

  const seedAuthors = async () => {
    if (!confirm('작성자를 1000명까지 자동 생성하시겠습니까?')) return
    setSeedLoading(true)
    setAuthorMsg(null)
    try {
      const res = await fetch('/api/admin/comment-authors', { method: 'PUT' })
      const data = await res.json()
      if (res.ok) {
        setAuthorMsg({ text: `${data.created}명 생성 완료 (총 ${data.total}명)`, ok: true })
        fetchAuthors()
      } else {
        setAuthorMsg({ text: data.error || '생성 실패', ok: false })
        fetchAuthors()
      }
    } catch {
      setAuthorMsg({ text: '서버 오류', ok: false })
      fetchAuthors()
    } finally {
      setSeedLoading(false)
    }
  }

  const fetchComments = useCallback(async (type: CommentType) => {
    setCommentLoading(true)
    setCommentMsg('')
    try {
      const res = await fetch(`/api/admin/comments?type=${type}`)
      if (res.ok) setComments(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setCommentLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tab === 'teledit') {
      fetchComments(commentType)
      fetchAuthors()
    }
  }, [tab, commentType, fetchComments, fetchAuthors])

  const addComment = async () => {
    if (!newCommentText.trim()) return
    setCommentMsg('')
    const res = await fetch('/api/admin/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: commentType, content: newCommentText.trim() }),
    })
    if (res.ok) {
      setNewCommentText('')
      fetchComments(commentType)
    } else {
      const data = await res.json()
      setCommentMsg(data.error || '추가 실패')
    }
  }

  const deleteComment = async (id: string) => {
    const res = await fetch(`/api/admin/comments?id=${id}`, { method: 'DELETE' })
    if (res.ok) fetchComments(commentType)
    else alert((await res.json()).error)
  }

  const tappoLabel: Record<UserItem['tappo'], { text: string; cls: string }> = {
    ALLOWED: { text: '허용', cls: 'bg-green-500/20 text-green-400' },
    DENIED: { text: '차단/권한없음', cls: 'bg-gray-500/20 text-gray-400' },
    UNLINKED: { text: 'CRM 미연결', cls: 'bg-yellow-500/20 text-yellow-400' },
    ERROR: { text: '확인 실패', cls: 'bg-red-500/20 text-red-400' },
  }

  const roleLabel: Record<string, { text: string; cls: string }> = {
    USER: { text: 'User', cls: 'text-binance-text-dim' },
    MANAGER: { text: 'Manager', cls: 'text-blue-400' },
    ADMIN: { text: 'Admin', cls: 'text-binance-yellow' },
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-binance-bg">
        <div className="text-binance-text-dim">로딩 중...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-binance-bg text-binance-text flex">
      {/* Sidebar */}
      <aside className="w-[180px] flex-shrink-0 bg-binance-card border-r border-binance-border min-h-screen flex flex-col">
        {/* Logo */}
        <div className="px-4 h-10 flex items-center border-b border-binance-border">
          <span className="text-sm font-bold text-binance-yellow">TAPBIT</span>
          <span className="text-[10px] text-binance-text-dim ml-1.5">Admin</span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 py-2">
          {SIDEBAR_ITEMS.map(item => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`w-full text-left px-4 py-2.5 text-xs font-medium transition-colors ${
                tab === item.key
                  ? 'text-binance-yellow border-l-2 border-binance-yellow bg-binance-yellow/5'
                  : 'text-binance-text-dim border-l-2 border-transparent hover:text-binance-text hover:bg-binance-border/10'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>

        {/* Bottom link */}
        <div className="px-4 py-3 border-t border-binance-border">
          <button
            onClick={() => router.push('/dashboard')}
            className="text-[10px] text-binance-text-dim hover:text-binance-text transition-colors"
          >
            ← Dashboard
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen overflow-y-auto">
        <div className="max-w-5xl mx-auto p-4 space-y-4">

          {/* === Users Tab (읽기 전용) === */}
          {tab === 'users' && (
            <>
              <div className="flex items-center gap-2 text-[11px] text-binance-text-dim">
                <span>회원 권한은 소나무 CRM 회원관리의 TAPPO 체크로 관리합니다</span>
                <a
                  href="https://crm.sonamoo.cc/members"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-binance-yellow hover:underline"
                >
                  CRM 회원관리 열기 ↗
                </a>
              </div>

              {fetchError && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-xs">
                  {fetchError}
                </div>
              )}

              <div className="bg-binance-card border border-binance-border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-binance-text-dim border-b border-binance-border text-xs">
                      <th className="text-left py-2 px-3 font-normal">아이디</th>
                      <th className="text-left py-2 px-3 font-normal">이름</th>
                      <th className="text-left py-2 px-3 font-normal">CRM 아이디</th>
                      <th className="text-left py-2 px-3 font-normal">TAPPO</th>
                      <th className="text-left py-2 px-3 font-normal">역할</th>
                      <th className="text-left py-2 px-3 font-normal">포지션</th>
                      <th className="text-left py-2 px-3 font-normal">가입일</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-binance-text-dim text-xs">유저가 없습니다.</td>
                      </tr>
                    ) : (
                      users.map(u => (
                        <tr key={u.id} className="border-b border-binance-border/50 hover:bg-binance-border/20">
                          <td className="py-2 px-3 text-xs font-mono">{u.email}</td>
                          <td className="py-2 px-3 text-xs">{u.crmName || u.name}</td>
                          <td className="py-2 px-3 text-xs font-mono text-binance-text-dim">{u.crmUserId ?? '-'}</td>
                          <td className="py-2 px-3">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${tappoLabel[u.tappo].cls}`}>
                              {tappoLabel[u.tappo].text}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`text-xs font-medium ${roleLabel[u.role]?.cls}`}>{roleLabel[u.role]?.text}</span>
                          </td>
                          <td className="py-2 px-3 text-xs text-binance-text-dim">{u._count.positions}</td>
                          <td className="py-2 px-3 text-xs text-binance-text-dim">
                            {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* === Teledit Tab (Comments) === */}
          {tab === 'teledit' && (
            <div className="space-y-3">
              {/* 작성자 풀 관리 */}
              <div className="bg-binance-card border border-binance-border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-binance-yellow">작성자 풀</span>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-binance-text-dim flex items-center gap-1.5">
                      현재 <span className="text-binance-text font-medium">{authors.length}</span>명 / 최대 1000명
                      <button
                        onClick={() => fetchAuthors()}
                        disabled={authorLoading}
                        className="text-binance-text-dim hover:text-binance-yellow transition-colors disabled:opacity-50"
                        title="새로고침"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/></svg>
                      </button>
                    </span>
                    <button
                      onClick={seedAuthors}
                      disabled={seedLoading || authors.length >= 1000}
                      className="px-3 py-1 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {seedLoading ? '생성 중...' : '1000명 자동 생성'}
                    </button>
                  </div>
                </div>
                {authorMsg && <span className={`text-xs ${authorMsg.ok ? 'text-green-400' : 'text-red-400'}`}>{authorMsg.text}</span>}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={authorName}
                    onChange={e => setAuthorName(e.target.value)}
                    placeholder="이름"
                    className="flex-1 bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAuthor() } }}
                  />
                  <input
                    type="text"
                    value={authorAvatar}
                    onChange={e => setAuthorAvatar(e.target.value)}
                    placeholder="아바타 URL (선택)"
                    className="flex-1 bg-binance-bg border border-binance-border rounded px-3 py-2 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50"
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addAuthor() } }}
                  />
                  <button
                    onClick={addAuthor}
                    disabled={!authorName.trim() || authorLoading}
                    className="px-4 py-2 rounded text-xs font-bold bg-binance-yellow text-binance-bg hover:bg-binance-yellow/90 disabled:opacity-50"
                  >
                    추가
                  </button>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-binance-border/50">
                  {authorLoading ? (
                    <div className="text-center py-4 text-binance-text-dim text-xs">로딩 중...</div>
                  ) : authors.length === 0 ? (
                    <div className="text-center py-4 text-binance-text-dim text-xs">등록된 작성자가 없습니다.</div>
                  ) : (
                    authors.map(a => (
                      <div key={a.id} className="flex items-center gap-2 px-2 py-2 hover:bg-binance-border/10">
                        {a.avatarUrl ? (
                          <img
                            src={a.avatarUrl}
                            alt=""
                            className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                            onError={e => {
                              const img = e.target as HTMLImageElement;
                              const fallback = document.createElement('div');
                              fallback.className = 'w-5 h-5 rounded-full bg-binance-yellow flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-black';
                              fallback.textContent = getInitials(a.name);
                              img.replaceWith(fallback);
                            }}
                          />
                        ) : (
                          <div className="w-5 h-5 rounded-full bg-binance-yellow flex-shrink-0 flex items-center justify-center text-[8px] font-bold text-black">
                            {getInitials(a.name)}
                          </div>
                        )}
                        <span className="flex-1 text-xs text-binance-text truncate flex items-center gap-1">
                          {a.name}
                        </span>
                        <button
                          onClick={() => deleteAuthor(a.id)}
                          className="flex-shrink-0 px-2 py-1 text-[10px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                        >
                          삭제
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Type selector */}
              <div className="flex flex-wrap gap-1.5">
                {COMMENT_TYPES.map(ct => (
                  <button
                    key={ct.value}
                    onClick={() => setCommentType(ct.value)}
                    className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                      commentType === ct.value
                        ? 'bg-binance-yellow text-binance-bg'
                        : 'text-binance-text-dim hover:text-binance-text bg-binance-card border border-binance-border'
                    }`}
                  >
                    {ct.label}
                  </button>
                ))}
              </div>

              {/* Add form */}
              <div className="bg-binance-card border border-binance-border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-binance-text-dim">
                    현재 <span className="text-binance-text font-medium">{comments.length}</span>개 / 최대 5000개
                  </span>
                  {commentMsg && <span className="text-xs text-red-400">{commentMsg}</span>}
                </div>
                <textarea
                  value={newCommentText}
                  onChange={e => setNewCommentText(e.target.value)}
                  placeholder="추가할 댓글 내용을 입력하세요"
                  rows={3}
                  className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-sm text-binance-text focus:outline-none focus:border-binance-yellow/50 resize-none"
                />
                <p className="text-[10px] text-binance-text-dim">사용 가능 변수: <code className="text-binance-yellow font-mono">{'{{name}}'}</code> 이름, <code className="text-binance-yellow font-mono">{'{{nickname1}}'}</code> 별명1, <code className="text-binance-yellow font-mono">{'{{nickname2}}'}</code> 별명2, <code className="text-binance-yellow font-mono">{'{{entryWait}}'}</code> 진입대기, <code className="text-binance-yellow font-mono">{'{{profitProof}}'}</code> 수익인증</p>
                <button
                  onClick={addComment}
                  disabled={!newCommentText.trim() || commentLoading}
                  className="px-4 py-2 rounded text-xs font-bold bg-binance-yellow text-binance-bg hover:bg-binance-yellow/90 disabled:opacity-50"
                >
                  추가
                </button>
              </div>

              {/* Comment list */}
              <div className="bg-binance-card border border-binance-border rounded-lg overflow-hidden">
                {commentLoading ? (
                  <div className="text-center py-8 text-binance-text-dim text-xs">로딩 중...</div>
                ) : comments.length === 0 ? (
                  <div className="text-center py-8 text-binance-text-dim text-xs">댓글이 없습니다.</div>
                ) : (
                  <div className="max-h-96 overflow-y-auto divide-y divide-binance-border/50">
                    {comments.map(c => {
                      // {{...}} 패턴 하이라이트
                      const parts = c.content.split(/(\{\{[^}]+\}\})/g)
                      return (
                        <div key={c.id} className="flex items-start gap-3 px-4 py-3 hover:bg-binance-border/10">
                          <span className="flex-1 text-xs text-binance-text whitespace-pre-wrap break-words">
                            {parts.map((part, i) =>
                              /^\{\{[^}]+\}\}$/.test(part)
                                ? <span key={i} className="text-binance-yellow font-mono">{part}</span>
                                : part
                            )}
                          </span>
                          <button
                            onClick={() => deleteComment(c.id)}
                            className="flex-shrink-0 px-2 py-1 text-[10px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                          >
                            삭제
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
