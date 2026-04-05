'use client'

import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false)
  const [username, setUsername] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setInfo('')
    setLoading(true)

    try {
      if (isRegister) {
        const res = await fetch('/api/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: username, name, password }),
        })

        const data = await res.json()
        if (!res.ok) {
          setError(data.error || '회원가입 실패')
          return
        }

        setInfo('회원가입 완료! 관리자 승인 후 로그인할 수 있습니다.')
        setIsRegister(false)
        setPassword('')
      } else {
        const result = await signIn('credentials', {
          email: username,
          password,
          redirect: false,
        })

        if (result?.error) {
          if (result.error.includes('PENDING')) {
            setError('관리자 승인 대기 중입니다.')
          } else if (result.error.includes('SUSPENDED')) {
            setError('계정이 정지되었습니다.')
          } else {
            setError('아이디 또는 비밀번호가 올바르지 않습니다.')
          }
        } else {
          router.push('/dashboard')
        }
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
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-binance-card rounded-xl border border-binance-border p-6 space-y-4">
          <h2 className="text-xl font-bold text-binance-text text-center">
            {isRegister ? '회원가입' : '로그인'}
          </h2>

          {error && (
            <div className="bg-binance-red/10 border border-binance-red/30 rounded-lg p-3 text-sm text-binance-red">
              {error}
            </div>
          )}

          {info && (
            <div className="bg-binance-green/10 border border-binance-green/30 rounded-lg p-3 text-sm text-binance-green">
              {info}
            </div>
          )}

          {isRegister && (
            <div>
              <label className="block text-xs text-binance-text-dim mb-1.5">이름</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-binance-bg border border-binance-border rounded-lg px-3 py-2.5 text-binance-text text-sm focus:outline-none focus:border-binance-yellow"
                placeholder="홍길동"
                required
              />
            </div>
          )}

          <div>
            <label className="block text-xs text-binance-text-dim mb-1.5">아이디</label>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              className="w-full bg-binance-bg border border-binance-border rounded-lg px-3 py-2.5 text-binance-text text-sm focus:outline-none focus:border-binance-yellow"
              placeholder="영문, 숫자, 밑줄 (3~20자)"
              required
              minLength={3}
              maxLength={20}
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
            {loading ? '처리 중...' : isRegister ? '회원가입' : '로그인'}
          </button>

          <p className="text-center text-sm text-binance-text-dim">
            {isRegister ? '이미 계정이 있으신가요?' : '계정이 없으신가요?'}{' '}
            <button
              type="button"
              onClick={() => { setIsRegister(!isRegister); setError(''); setInfo(''); }}
              className="text-binance-yellow hover:underline"
            >
              {isRegister ? '로그인' : '회원가입'}
            </button>
          </p>
        </form>

        <p className="text-center text-xs text-binance-text-dim mt-4">
          Binance API 기반 실시간 가격
        </p>
      </div>
    </div>
  )
}
