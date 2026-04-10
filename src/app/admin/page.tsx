'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface UserItem {
  id: string
  email: string
  name: string
  role: string
  status: string
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

export default function AdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [users, setUsers] = useState<UserItem[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState('')
  const [tab, setTab] = useState<'all' | 'pending' | 'comments'>('all')

  // 댓글 관리
  const [commentType, setCommentType] = useState<CommentType>('preEntry')
  const [comments, setComments] = useState<CommentItem[]>([])
  const [commentLoading, setCommentLoading] = useState(false)
  const [newCommentText, setNewCommentText] = useState('')
  const [commentMsg, setCommentMsg] = useState('')

  // 새 관리자 생성 폼
  const [showCreate, setShowCreate] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [newName, setNewName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newRole, setNewRole] = useState<'MANAGER' | 'ADMIN'>('MANAGER')
  const [createMsg, setCreateMsg] = useState('')

  // 유저 편집
  const [editingUser, setEditingUser] = useState<string | null>(null)
  const [editEmail, setEditEmail] = useState('')
  const [editName, setEditName] = useState('')
  const [editPw, setEditPw] = useState('')
  const [editMsg, setEditMsg] = useState('')

  // 내 계정 수정
  const [showAccount, setShowAccount] = useState(false)
  const [myEmail, setMyEmail] = useState('')
  const [myName, setMyName] = useState('')
  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [newPwConfirm, setNewPwConfirm] = useState('')
  const [accountMsg, setAccountMsg] = useState('')
  const [accountLoading, setAccountLoading] = useState(false)

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
    if (tab === 'comments') fetchComments(commentType)
  }, [tab, commentType, fetchComments])

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

  const fetchMyAccount = useCallback(async () => {
    try {
      const res = await fetch('/api/account')
      if (res.ok) {
        const data = await res.json()
        setMyEmail(data.email)
        setMyName(data.name)
      }
    } catch (e) {
      console.error(e)
    }
  }, [])

  useEffect(() => {
    if (showAccount) fetchMyAccount()
  }, [showAccount, fetchMyAccount])

  const saveAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setAccountMsg('')
    if (newPw && newPw !== newPwConfirm) {
      setAccountMsg('새 비밀번호가 일치하지 않습니다.')
      return
    }
    setAccountLoading(true)
    try {
      const body: any = { email: myEmail, name: myName }
      if (newPw) {
        body.currentPassword = currentPw
        body.newPassword = newPw
      }
      const res = await fetch('/api/account', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (res.ok) {
        setAccountMsg('저장되었습니다. 아이디/비밀번호 변경 시 재로그인이 필요합니다.')
        setCurrentPw('')
        setNewPw('')
        setNewPwConfirm('')
      } else {
        setAccountMsg(data.error)
      }
    } catch {
      setAccountMsg('오류가 발생했습니다.')
    } finally {
      setAccountLoading(false)
    }
  }

  const updateUser = async (id: string, data: { status?: string; role?: string }) => {
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    if (res.ok) fetchUsers()
    else alert((await res.json()).error)
  }

  const startEditUser = (u: UserItem) => {
    setEditingUser(u.id)
    setEditEmail(u.email)
    setEditName(u.name)
    setEditPw('')
    setEditMsg('')
  }

  const saveEditUser = async (id: string) => {
    setEditMsg('')
    const body: any = { email: editEmail, name: editName }
    if (editPw) body.newPassword = editPw
    const res = await fetch(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json()
    if (res.ok) {
      setEditingUser(null)
      fetchUsers()
    } else {
      setEditMsg(data.error)
    }
  }

  const deleteUser = async (id: string, name: string) => {
    if (!confirm(`"${name}" 유저를 삭제하시겠습니까? 모든 포지션 데이터도 삭제됩니다.`)) return
    const res = await fetch(`/api/admin/users/${id}`, { method: 'DELETE' })
    if (res.ok) fetchUsers()
    else alert((await res.json()).error)
  }

  const createAccount = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateMsg('')
    const res = await fetch('/api/admin/users', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: newUsername, name: newName, password: newPassword, role: newRole }),
    })
    const data = await res.json()
    if (res.ok) {
      setCreateMsg(`${data.role} 계정 "${newUsername}" 생성 완료`)
      setNewUsername('')
      setNewName('')
      setNewPassword('')
      fetchUsers()
    } else {
      setCreateMsg(data.error)
    }
  }

  const filtered = tab === 'pending'
    ? users.filter(u => u.status === 'PENDING')
    : users

  const statusLabel: Record<string, { text: string; cls: string }> = {
    PENDING: { text: '대기', cls: 'bg-yellow-500/20 text-yellow-400' },
    APPROVED: { text: '승인', cls: 'bg-green-500/20 text-green-400' },
    SUSPENDED: { text: '정지', cls: 'bg-red-500/20 text-red-400' },
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
    <div className="min-h-screen bg-binance-bg text-binance-text">
      {/* Header */}
      <nav className="bg-binance-card border-b border-binance-border flex items-center justify-between px-4 h-10">
        <div className="flex items-center gap-4">
          <span className="text-sm font-bold text-binance-yellow">TAPBIT</span>
          <span className="text-xs text-binance-text-dim">Admin</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAccount(!showAccount)}
            className="text-xs text-binance-text-dim hover:text-binance-text"
          >
            내 계정
          </button>
          <button
            onClick={() => router.push('/dashboard')}
            className="text-xs text-binance-text-dim hover:text-binance-text"
          >
            Dashboard
          </button>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto p-4 space-y-4">
        {/* Account Settings */}
        {showAccount && (
          <form onSubmit={saveAccount} className="bg-binance-card border border-binance-border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-medium text-binance-yellow">내 계정 정보 수정</span>
              <button type="button" onClick={() => setShowAccount(false)} className="text-xs text-binance-text-dim hover:text-binance-text">닫기</button>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] text-binance-text-dim mb-1">아이디</label>
                <input
                  type="text" value={myEmail} onChange={e => setMyEmail(e.target.value)} required
                  className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-sm text-binance-text focus:outline-none focus:border-binance-yellow/50"
                />
              </div>
              <div>
                <label className="block text-[10px] text-binance-text-dim mb-1">이름</label>
                <input
                  type="text" value={myName} onChange={e => setMyName(e.target.value)} required
                  className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-sm text-binance-text focus:outline-none focus:border-binance-yellow/50"
                />
              </div>
            </div>
            <div className="border-t border-binance-border pt-3">
              <span className="text-[10px] text-binance-text-dim block mb-2">비밀번호 변경 (변경 시에만 입력)</span>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-[10px] text-binance-text-dim mb-1">현재 비밀번호</label>
                  <input
                    type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
                    placeholder="현재 비밀번호"
                    className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-sm text-binance-text focus:outline-none focus:border-binance-yellow/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-binance-text-dim mb-1">새 비밀번호</label>
                  <input
                    type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
                    placeholder="새 비밀번호 (4자 이상)"
                    className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-sm text-binance-text focus:outline-none focus:border-binance-yellow/50"
                  />
                </div>
                <div>
                  <label className="block text-[10px] text-binance-text-dim mb-1">새 비밀번호 확인</label>
                  <input
                    type="password" value={newPwConfirm} onChange={e => setNewPwConfirm(e.target.value)}
                    placeholder="새 비밀번호 확인"
                    className="w-full bg-binance-bg border border-binance-border rounded px-3 py-2 text-sm text-binance-text focus:outline-none focus:border-binance-yellow/50"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit" disabled={accountLoading}
                className="px-4 py-2 rounded text-xs font-bold bg-binance-yellow text-binance-bg hover:bg-binance-yellow/90 disabled:opacity-50"
              >
                {accountLoading ? '저장 중...' : '저장'}
              </button>
              {accountMsg && <span className="text-xs text-binance-text-dim">{accountMsg}</span>}
            </div>
          </form>
        )}

        {/* Tabs */}
        <div className="flex items-center gap-2">
          {(['pending', 'all'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                tab === t ? 'bg-binance-yellow text-binance-bg' : 'text-binance-text-dim hover:text-binance-text bg-binance-card'
              }`}
            >
              {t === 'pending' ? `승인 대기 (${users.filter(u => u.status === 'PENDING').length})` : `전체 (${users.length})`}
            </button>
          ))}
          <button
            onClick={() => setTab('comments')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              tab === 'comments' ? 'bg-binance-yellow text-binance-bg' : 'text-binance-text-dim hover:text-binance-text bg-binance-card'
            }`}
          >
            댓글 관리
          </button>

          {userRole === 'ADMIN' && tab !== 'comments' && (
            <button
              onClick={() => setShowCreate(!showCreate)}
              className="ml-auto px-3 py-1.5 rounded text-xs font-medium bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
            >
              + 관리자 계정 생성
            </button>
          )}
        </div>

        {/* Create Manager/Admin Form */}
        {showCreate && userRole === 'ADMIN' && (
          <form onSubmit={createAccount} className="bg-binance-card border border-binance-border rounded-lg p-4 space-y-3">
            <div className="text-xs font-medium text-binance-text mb-2">관리자 계정 생성</div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text" placeholder="아이디" value={newUsername}
                onChange={e => setNewUsername(e.target.value)} required
                className="bg-binance-bg border border-binance-border rounded px-3 py-2 text-sm text-binance-text focus:outline-none focus:border-binance-yellow/50"
              />
              <input
                type="text" placeholder="이름" value={newName}
                onChange={e => setNewName(e.target.value)} required
                className="bg-binance-bg border border-binance-border rounded px-3 py-2 text-sm text-binance-text focus:outline-none focus:border-binance-yellow/50"
              />
              <input
                type="password" placeholder="비밀번호" value={newPassword}
                onChange={e => setNewPassword(e.target.value)} required minLength={4}
                className="bg-binance-bg border border-binance-border rounded px-3 py-2 text-sm text-binance-text focus:outline-none focus:border-binance-yellow/50"
              />
              <div className="flex items-center gap-2">
                {(['MANAGER', 'ADMIN'] as const).map(r => (
                  <button
                    key={r} type="button"
                    onClick={() => setNewRole(r)}
                    className={`px-3 py-2 rounded text-xs font-medium transition-colors ${
                      newRole === r ? 'bg-binance-yellow text-binance-bg' : 'bg-binance-bg text-binance-text-dim border border-binance-border'
                    }`}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button type="submit" className="px-4 py-2 rounded text-xs font-bold bg-binance-yellow text-binance-bg hover:bg-binance-yellow/90">
                생성
              </button>
              {createMsg && <span className="text-xs text-binance-text-dim">{createMsg}</span>}
            </div>
          </form>
        )}

        {/* Comment Pool Management */}
        {tab === 'comments' && (
          <div className="space-y-3">
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
                  {comments.map(c => (
                    <div key={c.id} className="flex items-start gap-3 px-4 py-3 hover:bg-binance-border/10">
                      <span className="flex-1 text-xs text-binance-text whitespace-pre-wrap break-words">{c.content}</span>
                      <button
                        onClick={() => deleteComment(c.id)}
                        className="flex-shrink-0 px-2 py-1 text-[10px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      >
                        삭제
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Error Banner */}
        {tab !== 'comments' && fetchError && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-xs">
            {fetchError}
          </div>
        )}

        {/* User Table */}
        {tab !== 'comments' && <div className="bg-binance-card border border-binance-border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-binance-text-dim border-b border-binance-border text-xs">
                <th className="text-left py-2 px-3 font-normal">아이디</th>
                <th className="text-left py-2 px-3 font-normal">이름</th>
                <th className="text-left py-2 px-3 font-normal">역할</th>
                <th className="text-left py-2 px-3 font-normal">상태</th>
                <th className="text-left py-2 px-3 font-normal">포지션</th>
                <th className="text-left py-2 px-3 font-normal">가입일</th>
                <th className="text-right py-2 px-3 font-normal">관리</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-binance-text-dim text-xs">
                    {tab === 'pending' ? '승인 대기 중인 유저가 없습니다.' : '유저가 없습니다.'}
                  </td>
                </tr>
              ) : (
                filtered.map(u => editingUser === u.id ? (
                  <tr key={u.id} className="border-b border-binance-border/50 bg-binance-yellow/5">
                    <td className="py-1.5 px-3">
                      <input type="text" value={editEmail} onChange={e => setEditEmail(e.target.value)}
                        className="w-full bg-binance-bg border border-binance-border rounded px-2 py-1 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50 font-mono" />
                    </td>
                    <td className="py-1.5 px-3">
                      <input type="text" value={editName} onChange={e => setEditName(e.target.value)}
                        className="w-full bg-binance-bg border border-binance-border rounded px-2 py-1 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50" />
                    </td>
                    <td className="py-1.5 px-3">
                      <span className={`text-xs font-medium ${roleLabel[u.role]?.cls}`}>{roleLabel[u.role]?.text}</span>
                    </td>
                    <td className="py-1.5 px-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusLabel[u.status]?.cls}`}>{statusLabel[u.status]?.text}</span>
                    </td>
                    <td className="py-1.5 px-3">
                      <input type="password" value={editPw} onChange={e => setEditPw(e.target.value)}
                        placeholder="새 비밀번호"
                        className="w-full bg-binance-bg border border-binance-border rounded px-2 py-1 text-xs text-binance-text focus:outline-none focus:border-binance-yellow/50" />
                    </td>
                    <td className="py-1.5 px-3 text-xs text-binance-text-dim">
                      {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="py-1.5 px-3">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => saveEditUser(u.id)}
                          className="px-2 py-1 text-[10px] rounded bg-binance-yellow text-binance-bg hover:bg-binance-yellow/90 font-medium">저장</button>
                        <button onClick={() => setEditingUser(null)}
                          className="px-2 py-1 text-[10px] rounded text-binance-text-dim hover:text-binance-text">취소</button>
                        {editMsg && <span className="text-[10px] text-red-400 ml-1">{editMsg}</span>}
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={u.id} className="border-b border-binance-border/50 hover:bg-binance-border/20">
                    <td className="py-2 px-3 text-xs font-mono">{u.email}</td>
                    <td className="py-2 px-3 text-xs">{u.name}</td>
                    <td className="py-2 px-3">
                      <span className={`text-xs font-medium ${roleLabel[u.role]?.cls}`}>
                        {roleLabel[u.role]?.text}
                      </span>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${statusLabel[u.status]?.cls}`}>
                        {statusLabel[u.status]?.text}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-xs text-binance-text-dim">{u._count.positions}</td>
                    <td className="py-2 px-3 text-xs text-binance-text-dim">
                      {new Date(u.createdAt).toLocaleDateString('ko-KR')}
                    </td>
                    <td className="py-2 px-3">
                      <div className="flex items-center justify-end gap-1">
                        {userRole === 'ADMIN' && (
                          <button
                            onClick={() => startEditUser(u)}
                            className="px-2 py-1 text-[10px] rounded bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 font-medium"
                          >
                            편집
                          </button>
                        )}
                        {u.status === 'PENDING' && (
                          <button
                            onClick={() => updateUser(u.id, { status: 'APPROVED' })}
                            className="px-2 py-1 text-[10px] rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium"
                          >
                            승인
                          </button>
                        )}
                        {u.status === 'APPROVED' && u.role === 'USER' && (
                          <button
                            onClick={() => updateUser(u.id, { status: 'SUSPENDED' })}
                            className="px-2 py-1 text-[10px] rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 font-medium"
                          >
                            정지
                          </button>
                        )}
                        {u.status === 'SUSPENDED' && (
                          <button
                            onClick={() => updateUser(u.id, { status: 'APPROVED' })}
                            className="px-2 py-1 text-[10px] rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 font-medium"
                          >
                            해제
                          </button>
                        )}
                        <button
                          onClick={() => deleteUser(u.id, u.name)}
                          className="px-2 py-1 text-[10px] rounded bg-red-500/10 text-red-400 hover:bg-red-500/20 font-medium"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>}
      </div>
    </div>
  )
}
