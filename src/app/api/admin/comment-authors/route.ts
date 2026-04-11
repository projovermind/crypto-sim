import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { put } from '@vercel/blob'

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const authors = await prisma.commentAuthorPool.findMany({
    orderBy: { createdAt: 'desc' },
  })
  return NextResponse.json(authors)
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { name, avatarUrl, nickname1, nickname2 } = await req.json()
  if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 })

  const count = await prisma.commentAuthorPool.count()
  if (count >= 1000) {
    return NextResponse.json({ error: '작성자가 1000개 이상입니다.' }, { status: 400 })
  }

  // 먼저 DB에 레코드 생성 (authorId 확보)
  const author = await prisma.commentAuthorPool.create({
    data: {
      name,
      avatarUrl: null,
      nickname1: typeof nickname1 === 'string' ? nickname1 : null,
      nickname2: typeof nickname2 === 'string' ? nickname2 : null,
    },
  })

  // avatarUrl이 있으면 이미지 fetch → Vercel Blob 업로드
  let finalAvatarUrl: string | null = null
  if (avatarUrl && typeof avatarUrl === 'string') {
    try {
      const imageRes = await fetch(avatarUrl, {
        headers: { 'User-Agent': 'CryptoSim/1.0' },
        signal: AbortSignal.timeout(10000), // 10초 타임아웃
      })
      if (imageRes.ok) {
        const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
        const buffer = Buffer.from(await imageRes.arrayBuffer())

        const ext = contentType.includes('png') ? 'png' : contentType.includes('webp') ? 'webp' : 'jpg'
        const blob = await put(`avatars/${author.id}.${ext}`, buffer, {
          access: 'public',
          contentType,
        })
        finalAvatarUrl = blob.url

        // blob URL로 DB 업데이트
        await prisma.commentAuthorPool.update({
          where: { id: author.id },
          data: { avatarUrl: finalAvatarUrl },
        })
      }
    } catch (err) {
      console.error('[comment-authors] avatar upload failed:', err)
      // fetch 또는 업로드 실패 시 null 유지
    }
  }

  return NextResponse.json({
    ...author,
    avatarUrl: finalAvatarUrl,
  })
}

const NICKNAME_POOL = ['ㅇㅇ','ㅇㅇㅇ','d','dd','ddd','kjh','10','본인','p','..','1234','ㄱㄱ','폰바꿈','투폰','k','ㅁㄴㅇㄹ','여','남','asdf','이','김','카톡주세요','qwer','8210','...','ㅎㅎ','박','777','세컨폰','a','개인','업무용','lmy','zxcv','1','최','ㅇㅋ','연락요망','나','-','iPhone','s','. .','ㅁㅁ','전화X','정','1111','j','강','b','c','m','부캐','2222','ㅂㅂ','h','조','12','y','오','ㅋㅋ','11','공기계','톡만','g','윤','88','58','ㄷㄷ','kims','q','x','장','메세지','w','임','456','r','t','한','v','u','n','0','i','신','o','ㅂㅈㄷㄱ','l','e','z','안','카톡만가능','72','백','999','송','배','2','허','K.J.H','JH','SJ','SH','MS','JM','DY','HJ','HK','_','^^']

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const currentCount = await prisma.commentAuthorPool.count()
  if (currentCount >= 1000) {
    return NextResponse.json({ error: '작성자가 이미 1000명입니다.' }, { status: 400 })
  }

  const toCreate = 1000 - currentCount

  // 랜덤 한국인 이름 풀: 성 10개 × 이름(2글자) 10개
  const surnames = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임']
  const givenNames = ['지민', '서연', '하은', '민준', '수빈', '예린', '도윤', '유나', '시우', '하린']

  const authors = []
  for (let i = 0; i < toCreate; i++) {
    const surname = surnames[Math.floor(Math.random() * surnames.length)]
    const given = givenNames[Math.floor(Math.random() * givenNames.length)]
    const hasAvatar = Math.random() < 0.15
    authors.push({
      name: surname + ' ' + given,
      avatarUrl: hasAvatar ? `https://i.pravatar.cc/150?img=${Math.ceil(Math.random() * 70)}` : null,
      nickname1: NICKNAME_POOL[Math.floor(Math.random() * NICKNAME_POOL.length)],
      nickname2: null,
    })
  }

  await prisma.commentAuthorPool.createMany({ data: authors })

  const finalCount = await prisma.commentAuthorPool.count()
  return NextResponse.json({ created: toCreate, total: finalCount })
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions)
  const role = (session?.user as any)?.role
  if (!session || (role !== 'ADMIN' && role !== 'MANAGER')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const id = req.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.commentAuthorPool.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
