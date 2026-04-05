import type { Metadata } from 'next'
import './globals.css'
import AuthProvider from '@/components/SessionProvider'

export const metadata: Metadata = {
  title: 'Tap PO',
  description: '과거 진입 시점 기반 코인 포지션 수익/손실 실시간 시뮬레이션',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className="bg-binance-bg min-h-screen">
        <AuthProvider>
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
