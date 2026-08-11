'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function AdminTeleditPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const userRole = (session?.user as any)?.role

  useEffect(() => {
    if (status === 'authenticated' && userRole !== 'ADMIN') {
      router.replace('/dashboard')
    }
  }, [status, userRole, router])

  if (status === 'loading') return <div className="min-h-screen bg-binance-bg flex items-center justify-center text-binance-text-dim">로딩 중...</div>
  if (userRole !== 'ADMIN') return null

  return (
    <div className="min-h-screen bg-binance-bg p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold text-binance-text">Teledit 확장 관리 가이드</h1>
          <button onClick={() => router.push('/admin')} className="text-xs text-binance-text-dim hover:text-binance-text">
            &larr; Admin
          </button>
        </div>

        <div className="space-y-6">
          {/* 빌드 & 난독화 */}
          <Section title="1. 확장 빌드 & 난독화">
            <P>소스 파일은 <Code>/Volumes/Core/Vault/hivemind/💻 Projects/Teledit/chrome-extension/</Code>에 있습니다.</P>
            <H4>번들 빌드 (소스 → bundle.js)</H4>
            <Pre>{`cd /Volumes/Core/Vault/hivemind/💻\\ Projects/Teledit/chrome-extension

cat state.js constants.js utils.js storage.js api.js dom-builders.js \\
    reactions.js comments.js profit-card.js comment-ui.js \\
    bubble-data.js bubble-replies.js bubble-reactions.js bubble-groups.js \\
    bubble.js content.js > bundle.js

node --check bundle.js  # 문법 검증`}</Pre>

            <H4>난독화 + extension.zip 패키징</H4>
            <P>손으로 하지 않습니다. 난독화 옵션이 스크립트에 박혀 있어 언제 다시 빌드해도 같은 결과가 나옵니다.</P>
            <Pre>{`cd /Volumes/Core/Vault/hivemind/💻\\ Projects/Teledit

node scripts/build-extension.js            # chrome-extension/extension.zip
node scripts/build-extension.js --publish  # + CryptoSim/public/extension.zip 까지 갱신`}</Pre>
            <P>bundle.js · webz-inject.js · webz-adapter.js 만 난독화하고 나머지는 그대로 담습니다. manifest가 가리키는 파일이 하나라도 빠지면 빌드가 실패합니다.</P>
            <P className="text-binance-yellow">난독화 옵션 <Code>--rename-globals</Code>는 반드시 false여야 합니다. content_script 세 파일이 같은 isolated world의 전역을 통해 서로를 부르므로, 전역 이름이 바뀌면 A 버전이 통째로 죽습니다.</P>
            <P className="text-binance-yellow">개발자 PC의 확장은 원본 bundle.js를 사용합니다. 난독화는 배포용 zip에만 적용됩니다.</P>

            <H4>배포 전 검증 (배포될 zip 그대로)</H4>
            <Pre>{`rm -rf /tmp/ext-verify
unzip -q chrome-extension/extension.zip -d /tmp/ext-verify
TELEDIT_EXT_DIR=/tmp/ext-verify node scripts/webz-bundle-test.js`}</Pre>
            <P>Playwright로 file:// 픽스처를 띄워 <Code>난독화된 진짜 bundle.js</Code>를 그대로 실행합니다. 텔레그램 로그인도 DB도 필요 없습니다.</P>
          </Section>

          {/* 배포 */}
          <Section title="2. CryptoSim 배포 (Vercel)">
            <Pre>{`cd /Volumes/Core/Vault/hivemind/💻\\ Projects/CryptoSim

git add public/extension.zip
git commit -m "chore: update extension.zip"
git push origin main`}</Pre>
            <P>push 하면 Vercel이 자동 배포합니다. <Code>vercel --prod</Code> 같은 CLI 배포는 쓰지 않습니다 &mdash; 로컬 워킹트리에 다른 세션의 미완성 작업이 섞여 올라갈 수 있습니다.</P>
            <P>GitHub push 시 <Code>.github/workflows/extension-release.yml</Code>이 자동으로 GitHub Release를 생성합니다.</P>
            <H4>배포 확인</H4>
            <Pre>{`curl -sI https://crypto-sim-nu.vercel.app/extension.zip | grep -i content-length`}</Pre>
            <P>빌드가 찍어준 zip 크기와 같은지 봅니다.</P>
          </Section>

          {/* 확장 구조 */}
          <Section title="3. 확장 파일 구조">
            <Pre>{`state.js          공유 상태 (Map/Set/캐시)
constants.js      불변 상수 (SERVER_URL, 색상 등)
utils.js          순수 유틸 함수
storage.js        chrome.storage 래퍼
api.js            서버 API 호출 (fetchPositions 등)
dom-builders.js   DOM 요소 팩토리
reactions.js      리액션 클릭 처리
comments.js       템플릿 시스템 + _applyTemplate
profit-card.js    수익인증 이미지 fetch
comment-ui.js     토론 오버레이 UI
bubble-data.js    뷰카운트 + 댓글 캐시
bubble-replies.js 댓글 영역 렌더링 (아이콘, 아바타)
bubble-reactions.js 리액션 요소 구성
bubble-groups.js  그룹/위치/날짜그룹 삽입
bubble.js         오케스트레이터 (insertBubble)
content.js        엔트리포인트 (스크롤, Alt+E, 채널헤더)

webz-inject.js    A버전(.Message) 버블 생성 — 복제/시각복원/리액션
webz-adapter.js   bundle.js ↔ webz-inject 다리 (값 계산은 bundle.js 것을 그대로 씀)

background.js     서비스워커 (업데이트 체크, fetch 프록시)
popup.js          팝업 UI
popup.html        팝업 HTML
page-script.js    MAIN world 스크립트
manifest.json     확장 매니페스트`}</Pre>
            <P>K/A 판별은 주소가 아니라 DOM으로 합니다 &mdash; 주소창이 없는 텔레그램 데스크톱 앱에서도 동작해야 하기 때문입니다. bundle.js는 삽입·채널헤더·감시자·초기화 네 지점에서 A로 갈라집니다.</P>
          </Section>

          {/* 주요 설정 */}
          <Section title="4. 주요 설정 & 변수">
            <H4>템플릿 변수 (comments.js _applyTemplate)</H4>
            <Pre>{`{{symbol}}    코인명      {{memo1}}      메모 1
{{side}}      LONG/SHORT  {{memo2}}      메모 2
{{leverage}}  레버리지     {{memo3}}      메모 3
{{entryPrice}} 체결가      {{name}}       이름
{{inputPrice}} 입력가      {{nickname1}}  별명 1
{{amount}}    투자금       {{nickname2}}  별명 2
{{quantity}}  수량         {{closePrice}} 청산가
{{marginMode}} 마진모드    {{pnl}}        손익 USDT
{{takeProfit}} TP          {{roe}}        수익률 %
{{stopLoss}}  SL`}</Pre>

            <H4>가격 자동 소수점</H4>
            <Pre>{`≥5000  → -1자리 (10단위 반올림: 71320)
≥1000  → 정수 (2121)
≥10    → 소수 1자리 (142.3)
≥1     → 소수 2자리 (3.46)
≥0.1   → 소수 3자리 (0.152)
≥0.01  → 소수 4자리 (0.0254)
<0.01  → 소수 5자리 (0.00003)
ROE    → 항상 소수 1자리
PnL    → 항상 소수 2자리`}</Pre>
          </Section>

          {/* 트러블슈팅 */}
          <Section title="5. 트러블슈팅">
            <H4>수익인증 이미지 배경 안 나옴</H4>
            <P>API가 항상 satori로 생성 (shareImageUrl 무시). 브라우저 캐시가 원인이면 확장의 profit-card.js에서 <Code>cache: no-store</Code> + 타임스탬프 쿼리 파라미터가 적용됨.</P>

            <H4>스크롤 무한 로딩 (1월 포지션)</H4>
            <P><Code>forceInsert</Code> 파라미터 완전 제거됨. 모든 삽입은 DOM 범위 체크 (<Code>minRealTs ~ maxRealTs</Code>) 적용. 범위 밖 포지션은 pending → 3회 재시도 후 폐기.</P>

            <H4>말풍선 아이콘 사라짐</H4>
            <P>CSS로 제어: <Code>.teledit-no-comments</Code> 클래스 + <Code>.replies-footer-icon display:inline-flex!important</Code>. 아이콘 백업은 템플릿 클론 시점에 저장 → <Code>_cleanReplies</Code>에서 복원.</P>

            <H4>채널 헤더 이름/이미지 변경</H4>
            <P><Code>_applyChannelHeader()</Code>: <Code>_userSettings.channelName</Code>과 <Code>channelAvatarUrl</Code>을 DOM에 적용. 스크롤 재삽입 시에도 재적용됨.</P>

            <H4>확장이 업데이트 안 됨</H4>
            <P>확장은 <Code>/Volumes/Core/Vault/hivemind/💻 Projects/Teledit/chrome-extension/</Code>에서 직접 로드 (Chrome Profile 2). bundle.js 수정 후 <Code>chrome://extensions</Code>에서 리로드 + Telegram Web F5.</P>
          </Section>

          {/* DB */}
          <Section title="6. DB 관련">
            <H4>shareImageUrl 클리어 (필요 시)</H4>
            <Pre>{`cd /Volumes/Core/Vault/hivemind/💻\\ Projects/CryptoSim
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  const r = await p.position.updateMany({
    where: { shareImageUrl: { not: null } },
    data: { shareImageUrl: null }
  });
  console.log('Cleared:', r.count);
  await p.\\$disconnect();
})();
"`}</Pre>

            <H4>teleditVisible 일괄 변경</H4>
            <Pre>{`node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
(async () => {
  await p.position.updateMany({
    where: { userId: 'USER_ID_HERE' },
    data: { teleditVisible: true }
  });
  await p.\\$disconnect();
})();
"`}</Pre>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-binance-card border border-binance-border rounded-lg p-5">
      <h2 className="text-sm font-bold text-binance-yellow mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function H4({ children }: { children: React.ReactNode }) {
  return <h4 className="text-xs font-semibold text-binance-text mt-3 mb-1">{children}</h4>
}

function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-xs text-binance-text-dim leading-relaxed ${className}`}>{children}</p>
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-binance-bg px-1 py-0.5 rounded text-[11px] text-binance-yellow font-mono">{children}</code>
}

function Pre({ children }: { children: React.ReactNode }) {
  return <pre className="bg-binance-bg border border-binance-border rounded p-3 text-[11px] text-binance-text-dim font-mono overflow-x-auto whitespace-pre-wrap">{children}</pre>
}
