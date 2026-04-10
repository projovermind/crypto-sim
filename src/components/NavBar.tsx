'use client'

import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'

interface NavBarProps {
  session: any
  onLogout: () => void
}

export default function NavBar({ session, onLogout }: NavBarProps) {
  const router = useRouter()

  return (
    <nav className="bg-binance-card border-b border-binance-border flex items-center justify-between px-4 h-10 shrink-0">
      <div className="flex items-center gap-4">
        <span className="text-sm font-bold text-binance-yellow">TAPBIT</span>
      </div>
      <div className="flex items-center gap-3">
        {((session.user as any)?.role === 'ADMIN' || (session.user as any)?.role === 'MANAGER') && (
          <button
            onClick={() => router.push('/admin')}
            className="text-[10px] text-blue-400 hover:text-blue-300 transition-colors"
          >
            Admin
          </button>
        )}
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-binance-yellow/20 flex items-center justify-center text-binance-yellow text-[10px] font-bold">
            {(session.user as any)?.name?.[0] || '?'}
          </div>
          <span className="text-xs text-binance-text hidden sm:inline">
            {(session.user as any)?.name}
          </span>
        </div>
        <button
          onClick={() => router.push('/settings')}
          title="Teledit 설정"
          className="text-binance-text-dim hover:text-binance-yellow transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
            <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
          </svg>
        </button>
        <button
          onClick={onLogout}
          className="text-[10px] text-binance-text-dim hover:text-binance-red transition-colors"
        >
          로그아웃
        </button>
      </div>
    </nav>
  )
}
