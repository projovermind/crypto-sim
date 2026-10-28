import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// teledit 윈도우 프로그램(텔레그램 클론 + 텔레딧) 업데이트 서버. 프로그램이 자동 업데이트에 쓰는 주소와 같다
// (레포: tg-ui-clone, 서버: messenger-updates)
const UPDATE_BASE = 'https://update.subinggrae.cc/8efa835ad252079375b5f0bd';

export const dynamic = 'force-dynamic';

// 최신 설치 파일로 보낸다 — latest.yml 의 path 가 지금 버전의 teledit-Setup-<버전>.exe
export async function GET(request: NextRequest) {
  const user = await getAuthUser(request);
  if (!user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  }
  try {
    const yml = await (await fetch(`${UPDATE_BASE}/latest.yml`, { cache: 'no-store' })).text();
    const file = yml.match(/^path:\s*(\S+)/m)?.[1];
    if (!file) throw new Error('no path');
    return NextResponse.redirect(`${UPDATE_BASE}/${file}`);
  } catch {
    return NextResponse.json({ error: '설치 파일을 찾지 못했습니다' }, { status: 502 });
  }
}
