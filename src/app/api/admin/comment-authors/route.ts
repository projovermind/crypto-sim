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

const NAME_POOL = ["ㅇㅇ","ㅇㅇ","ㅇㅇㅇ","d","dd","dd","ddd","kjh","10","본인","p","..","1234","ㄱㄱ","폰바꿈","투폰","k","ㅁㄴㅇㄹ","여","남","asdf","이","김","카톡주세요","qwer","8210","...","ㅎㅎ","박","777","세컨폰","a","개인","업무용","lmy","zxcv","1","최","ㅇㅋ","연락요망","나","-","iPhone","s",". .","ㅁㅁ","전화X","정","1111","j","ㅇㅇㅇ","강","b","c","m","부캐","2222","ㅂㅂ","h","조","12","y","오","ㅋㅋ","11","d","공기계","톡만","g","윤","88","58","ㄷㄷ","kims","q","x","장","메세지","w","임","456","r","t","한","v","v","u","n","0","i","신","o","ㅂㅈㄷㄱ","l","e","z","안","카톡만가능","72","백","999","송","배","2","허","K.J.H","JH","SJ","SH","MS","JM","DY","HJ","HK","_","^^","^.^","ㅜㅜ","010-","010_","8210-","1818","qwe","wer","ert","rty","tyu","yui","uio","iop","asd","sdf","dfg","fgh","ghj","hjk","jkl","zxc","xcv","cvb","vbn","bnm","qqq","www","eee","rrr","ttt","yyy","uuu","iii","ooo","ppp","aaa","sss","ddd","fff","ggg","hhh","jjj","kkk","lll","zzz","xxx","ccc","vvv","bbb","nnn","mmm","qq","ww","ee","rr","tt","yy","uu","ii","oo","pp","aa","ss","dd","ff","gg","hh","jj","kk","ll","zz","xx","cc","vv","bb","nn","mm","qwerty","asdfgh","zxcvbn","qwertyuiop","asdfghjkl","zxcvbnm","223","pei","fuxxy","trrm","제발","여 최순임","여 박정음","양 은진","송 수빈","권 민재","이 영호","박 동진","최 성민","정 상훈","강 병철","조 광수","윤 태영","장 기호","임 승환","한 종석","오 형주","서 진규","신 동수","권 영진","황 철민","안 성기","송 호진","전 기주","홍 상민","김 민석","이 수환","박 준호","최 진우","정 태민","강 철호","조 영수","윤 동현","장 성진","임 기택","한 병우","오 광민","서 종태","신 승호","권 형석","황 철진","안 성호","송 민수","전 동주","홍 상훈","김 영철","이 기남","박 성철","최 병수","정 태석","강 광식","조 종훈","윤 승규","장 형준","임 철현","한 성주","오 동민","서 상원","신 영식","권 민우","황 기동","안 태수","송 광현","전 병진","홍 승철","김 종민","이 형수","박 철석","최 성규","정 동원","강 상철","조 영기","윤 민구","장 기철","임 태진","한 광수","오 병구","서 승민","신 종철","권 형민","황 성훈","안 동식","송 기석","전 영석","홍 진수","김 영숙","이 미경","박 순자","최 은희","정 현주","강 미영","조 선희","윤 정숙","장 미란","임 영희","한 경숙","오 진주","서 미진","신 은정","권 현숙","황 정미","안 영미","송 경희","전 숙자","홍 은미","남 김석훈","남 박정태","남 이승수","남 최광호","남 정동길","남 강진수","남 조병국","남 윤성진","남 장철민","남 임기영","남 한상훈","남 오태식","남 서동식","남 신영철","남 권기태","남 황석주","남 안재현","남 송민철","남 전형구","남 홍동완","남 김성기","남 이철우","남 박상호","남 최민식","남 정기출","남 강동수","남 조형진","남 윤종수","남 장동철","남 임석호","남 한진석","남 오철수","남 서영길","남 신동국","남 권상진","남 황태영","남 안기동","남 송진호","남 전성태","남 홍기철","남 김태우","남 이종훈","남 박기남","남 최병국","남 정석진","남 강형석","남 조민석","남 윤석민","남 장태호","남 임동진","남 한기철","남 오상진","남 서태민","남 신형철","남 권동진","남 황성민","남 안진수","남 송석호","남 전형민","남 홍상수","남 김동욱","남 이민기","남 박석진","남 최상철","남 정진호","남 강석훈","남 조동현","남 윤기태","남 장민석","남 임종태","남 한태진","남 오진구","남 서민호","남 신성진","남 권태식","남 황진태","남 안동철","남 송기민","남 전석태","남 홍민수","여 김미숙","여 이영자","여 박순옥","여 최정희","여 정명숙","여 강현자","여 조숙희","여 윤미란","여 장현숙","여 임순자","여 한정옥","여 오영숙","여 서미자","여 신영순","여 권숙자","여 황정순","여 안미순","여 송현숙","여 전영희","여 홍정자","김덕수","이창호","박용진","최기봉","정달환","강창훈","조길수","윤재석","장동환","임현수","한대식","오재만","서영환","신태진","권오석","황명철","안기수","송영민","전재호","홍창기","김재훈","이석환","박정훈","최원석","정경호","강석호","조용식","윤철진","장기영","임성훈","한상진","오정환","서기태","신동민","권창수","황태호","안종국","송재민","전명수","홍기훈","김태환","이원재","박창식","최재영","정동철","강용구","조재훈","윤창민","장재혁","임창호","한석진","오성환","서용태","신정호","권태훈","황석기","안민철","송동환","전태호","홍원기","김석주","이종국","박경수","최진환","정호석","강민재","조태식","윤종민","장석훈","임대호","한태민","오종환","서동환","신상호","권영환","황동규","안진호","송명석","전상호","홍철호","김순희","이경자","박말순","최옥자","정미자","강춘자","조명희","윤경숙","장금순","임은숙","한명자","오정순","서말숙","신옥희","권미순","황영자","안순지","송미희","전경자","홍명자","claee","치미추리","KSH","LJH","PJS","CHW","JWY","YSJ","KYS","LSY","PJM","CJW","JHD","YGH","KDH","LHN","PSH","CDY","JYS","SYH","HCS","AJY","OJH","BSM","KTH","LCH","PMK","CSH","JTW","YMW","KJW","LBS","PDS","CKM","JSY","SJM","HWJ","AYS","OKY","BKH","KHR","LYJ","PYS","CYJ","JHW","YDS","KMS","LDK","PCH","CBH","JKH","SWJ","P.J.G","K.S.M","L.D.W","C.Y.S","J.M.K","Y.H.J","K.T.Y","L.S.M","P.H.R","C.J.H","J.S.W","S.D.H","H.K.M","A.J.S","O.S.Y","B.M.J","K.Y.W","L.J.T","P.S.K","C.H.D","PW","KM","LJ","PS","CY","JW","YS","HD","KW","SY","CH","JB","YJ","KH","SM","YH","DS","NY","MK","HR","BR","EJ","JS","JY","HS","WJ","DH","YW","TH","EG","MH","YM","HC","CS","JG","YB","KT","SW","ES","AR","MR","HG","TY","JR","YK","SR","NK","DJ","MY","JC","P.W","K.M","L.J","P.S","C.Y","J.W","Y.S","H.D","K.W","S.Y","C.H","J.B","Y.J","K.H","S.M","Y.H","D.S","N.Y","M.K","H.R","B.R","E.J","J.S","J.Y","H.S","W.J","D.H","Y.W","T.H","M.H","보수의 길","자유우파","잼님","지지","민주","태극기!!","조국수호대","나라사랑~","이재명사랑","자유시민","구국동지","촛불연대","보수재건!","수박척결!","국힘당원","적폐타파","자유","밭갈기..","친명","진짜보수","반공애국","정권심판!","자유통일","공정사회","민주투사","박통사랑","시민행동","법치국가","진보시민","투쟁 박창진","촛불시민","자유수호","참보수","사랑","우파결집","전교조","조혁","바른정치","잼파파","천명","병","석","seok","woo","jin","queen","우진","재원","승현","정민","태현","성재","동욱","종현","원준","준형","성욱","윤석","대영","주형","기현","승기","태윤","진석","민혁","지용","우성","남규","상우","재민","지영","은지","지은","선영","수연","보라","아람","나영","유리","은아","진아","주희","지현","보람","혜경","미연","아름","하나","세영","보영","가영","혜리","소영","희진","윤정","X","Kim James","Lee Richard","Cho Peter","Lim Paul","Han Thomas","Oh William","Kim George","Lee Charles","Park Daniel","Choi Joseph","Jung Brian","Kang Andrew","Cho Edward","Lim Henry","Han Simon","Oh Frank","톰","티아라","cow","럭키","김석","박중현입니다","중사","한구","페라","werr","ritt","god","금","궁금","전화X","이길영","w지","갱","김오유","김옥수","김옥주","김 원기","김 원태","김이레","김윤서","보스","보타니컬쌤~^^","별드림","세계를 내발로 장민성","세선","손군휘","수잇","이봉규","이호영 이사","장용동 Paul,Chang","재현","정운히","엔지","좋은세상리조트","달미 엄마","케이에스","KS","혼을 담은","Alex","An","Kim","CHOI.B.S","Chirs_효원","CJM","Dewy","Frs","Hdk","Hyeri","H","Jayhoon","김석주 James","홍철호 Steven,Hong","Jang Min Seok","Jesse","Katy(지윤)","K","KEE","Mr.right","MJ","s","SE클럽","SEONGKYUN PARK","toss_변성진","tue","투플러스 김성진","VIVA","wj","ZERO","사랑해줘서 고마워요","빽s","라이트","근세","ㅎㅎㄹㅇ","양양자","989897","장 스튜디오","ㄹㄹ","오늘도 스마일~~","가을우체통-이","용인종합설비","금강조경","정석빌딩","감사감사","등산가자","F2","정헤숙.","정원가구기","최길순 권사","열손","피터","저물다말","올리브","Ou","롯데","정승원","지워니","쭈","셔셔","도돌이표 인생","호","열심히살자","안식처..","보금자리ㅇ","광동 이재","배고파","경","김","장","이","최","정","박","김","최","이","박","롱","lazy","LD","MD 최준혁","Audi 김형선","제로PC","최연제","이태성","H","정","영업계정","박영호","b","a팀","김과장","U","개인","조","ff","최","영업폰","~","김석","F","apple","O","N","서브","ㅠ","J.W.","K","하","M","배","자전거가좋아","전화사절","Y","정대표","_","최동수","본인","L","P","강","기변","C","조주임","S","백","택시","휴가중","이성민","본계정","통화X","김재훈","임","서브폰","카톡수신","오","투폰임","문자요망","보조폰","한","패드용","전화안받음","신","안","가족방용","X","권","황","개인용","전","유","고","문","양","손","허","남","심","노","곽","성","차","우","서브계정","구","진","영","숙","미","선","광","호","길","명","동","jason","박","CHOI","Lee","dd"]

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

  const authors = []
  for (let i = 0; i < toCreate; i++) {
    const name = NAME_POOL[Math.floor(Math.random() * NAME_POOL.length)]
    const rand = Math.random()
    let avatarUrl: string | null = null
    if (rand < 0.09) avatarUrl = `https://loremflickr.com/150/150/person?random=${Math.ceil(Math.random() * 10000)}`
    else if (rand < 0.14) avatarUrl = `https://picsum.photos/150?random=${Math.ceil(Math.random() * 10000)}`
    else if (rand < 0.15) avatarUrl = `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random().toString(36).slice(2)}`
    authors.push({
      name,
      avatarUrl,
      nickname1: null,
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
  const all = req.nextUrl.searchParams.get('all')

  if (all === 'true') {
    const result = await prisma.commentAuthorPool.deleteMany()
    return NextResponse.json({ ok: true, deleted: result.count })
  }

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  await prisma.commentAuthorPool.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
