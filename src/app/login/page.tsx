'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

// next-auth 는 authorize 에서 던진 Error 메시지를 result.error 에 그대로 담아 준다(CRM 위임 사유 코드).
function loginErrorMessage(code: string): string {
  if (code.includes('NOT_ALLOWED')) return 'TAPPO 사용 권한이 없습니다. 관리자에게 요청하세요'
  if (code.includes('BLOCKED')) return 'CRM 계정이 정지·퇴사 상태입니다'
  if (code.includes('LOCKED')) return '로그인 시도가 많아 잠시 잠겼습니다'
  if (code.includes('CRM_UNAVAILABLE')) return 'CRM 인증 서버에 연결할 수 없습니다'
  if (code.includes('SUSPENDED')) return '계정이 정지되었습니다.'
  if (code.includes('ACCOUNT_CONFLICT')) return '이미 다른 CRM 계정에 연결된 아이디입니다. 관리자에게 문의하세요'
  return '아이디 또는 비밀번호가 올바르지 않습니다.'
}

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email: username,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError(loginErrorMessage(result.error))
      } else {
        router.push('/dashboard')
      }
    } catch (err) {
      setError('오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-binance-bg">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-binance-yellow mb-2">
            TAPBIT
          </h1>
          <p className="text-binance-text-dim text-sm">
            코인 포지션 시뮬레이터
          </p>
          <p className="text-binance-text-dim text-xs mt-1">
            소나무 CRM 아이디로 로그인
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-binance-card rounded-xl border border-binance-border p-6 space-y-4">
          <h2 className="text-xl font-bold text-binance-text text-center">
            로그인
          </h2>

          {error && (
            <div className="bg-binance-red/10 border border-binance-red/30 rounded-lg p-3 text-sm text-binance-red">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs text-binance-text-dim mb-1.5">아이디</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-binance-bg border border-binance-border rounded-lg px-3 py-2.5 text-binance-text text-sm focus:outline-none focus:border-binance-yellow"
              placeholder="소나무 CRM 아이디"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-binance-text-dim mb-1.5">비밀번호</label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-binance-bg border border-binance-border rounded-lg px-3 py-2.5 text-binance-text text-sm focus:outline-none focus:border-binance-yellow"
              placeholder="••••••"
              required
              minLength={4}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-lg font-bold text-sm bg-binance-yellow text-binance-bg hover:bg-binance-yellow/90 disabled:opacity-50 transition-colors"
          >
            {loading ? '처리 중...' : '로그인'}
          </button>

        </form>

        <p className="text-center text-xs text-binance-text-dim mt-4">
          Binance API 기반 실시간 가격
        </p>
      </div>
    </div>
  )
}
