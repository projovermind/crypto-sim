import { ImageResponse } from 'next/og'
import { NextResponse } from 'next/server'
import { readFileSync } from 'fs'
import { join } from 'path'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function tryLoad(name: string) {
  const path = join(process.cwd(), 'public', 'fonts', `${name}.ttf`)
  try {
    const buf = readFileSync(path)
    const ab = new ArrayBuffer(buf.byteLength)
    new Uint8Array(ab).set(buf)
    return { ok: true, bytes: buf.byteLength, ab }
  } catch (e: any) {
    return { ok: false, bytes: 0, error: e.message, ab: new ArrayBuffer(0) }
  }
}

export async function GET() {
  const regular  = tryLoad('Inter-Regular')
  const semibold = tryLoad('Inter-SemiBold')
  const bold     = tryLoad('Inter-Bold')

  const info = {
    cwd: process.cwd(),
    'Inter-Regular':  { ok: regular.ok,  bytes: regular.bytes },
    'Inter-SemiBold': { ok: semibold.ok, bytes: semibold.bytes },
    'Inter-Bold':     { ok: bold.ok,     bytes: bold.bytes },
  }

  // 폰트 로드 결과를 이미지 안에 텍스트로 출력
  const label = regular.ok
    ? `Inter loaded (${regular.bytes} bytes)\nThis text = Inter 400`
    : `FAILED: ${(regular as any).error}`

  const img = new ImageResponse(
    (
      <div style={{
        width: 500, height: 200, display: 'flex', flexDirection: 'column',
        background: '#111', padding: 24, fontFamily: 'Inter',
      }}>
        <div style={{ color: regular.ok ? '#00ff85' : '#ff3d55', fontSize: 18, fontWeight: 400, marginBottom: 8 }}>
          {label}
        </div>
        <div style={{ color: '#fff', fontSize: 28, fontWeight: 600, marginBottom: 8 }}>
          SemiBold 600: ABCDE 12345 가나다
        </div>
        <div style={{ color: '#aaa', fontSize: 14, fontWeight: 400 }}>
          CWD: {process.cwd()}
        </div>
      </div>
    ),
    {
      width: 500, height: 200,
      fonts: [
        { name: 'Inter', data: regular.ab,  weight: 400 as const, style: 'normal' as const },
        { name: 'Inter', data: semibold.ab, weight: 600 as const, style: 'normal' as const },
        { name: 'Inter', data: bold.ab,     weight: 700 as const, style: 'normal' as const },
      ],
    },
  )

  // JSON 정보를 헤더에 포함
  img.headers.set('X-Font-Debug', JSON.stringify(info))
  return img
}
