'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

export default function TeleditGuidePage() {
  const { data: session } = useSession()
  const router = useRouter()

  return (
    <div className="min-h-screen bg-binance-bg p-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-binance-text">Teledit 사용 가이드</h1>
          {session && (
            <button onClick={() => router.push('/dashboard')} className="text-xs text-binance-text-dim hover:text-binance-text">
              &larr; 대시보드
            </button>
          )}
        </div>

        <div className="space-y-6">
          {/* 소개 */}
          <Section title="Teledit이란?">
            <P>Teledit은 CryptoSim의 가상 포지션을 Telegram 채널에 실제 채널 포스트처럼 삽입하는 Chrome 확장 프로그램입니다.</P>
            <P>삽입된 포지션은 리액션, 댓글 수, 수익인증 이미지까지 포함되어 실제 채널 포스트와 구분할 수 없습니다.</P>
          </Section>

          {/* 텔레그램 설정 */}
          <Section title="1. Telegram Web 설정 (필수)">
            <H4>K 버전 사용</H4>
            <P>반드시 <A href="https://web.telegram.org/k/">web.telegram.org/k/</A> (K 버전)을 사용해야 합니다.</P>
            <P>A 버전(web.telegram.org/a/)에서는 작동하지 않습니다.</P>

            <H4>언어 설정: English</H4>
            <Ol>
              <Li>Telegram Web K 좌측 상단 ☰ 메뉴 클릭</Li>
              <Li>Settings &rarr; Language &rarr; <B>English</B> 선택</Li>
            </Ol>
            <P className="text-binance-yellow">한국어 등 다른 언어에서는 날짜 헤더가 올바르게 처리되지 않습니다.</P>

            <H4>시간 형식: 12시간제</H4>
            <Ol>
              <Li>Settings &rarr; General Settings</Li>
              <Li>Time Format &rarr; <B>12-hour</B> 선택</Li>
            </Ol>
            <P>24시간제에서는 시간 표시가 맞지 않을 수 있습니다.</P>
          </Section>

          {/* 확장 설치 */}
          <Section title="2. 확장 프로그램 설치">
            <H4>다운로드</H4>
            <Ol>
              <Li>CryptoSim 대시보드 상단 바에서 Telegram 아이콘(비행기 모양) 클릭</Li>
              <Li>또는 관리자에게 extension.zip 파일을 받기</Li>
            </Ol>

            <H4>Chrome에 설치</H4>
            <Ol>
              <Li>다운로드한 <Code>extension.zip</Code> 압축 해제</Li>
              <Li>Chrome 주소창에 <Code>chrome://extensions</Code> 입력</Li>
              <Li>우측 상단 <B>개발자 모드</B> 토글 켜기</Li>
              <Li><B>압축해제된 확장 프로그램을 로드합니다</B> 클릭</Li>
              <Li>압축 해제한 폴더 선택</Li>
            </Ol>

            <H4>업데이트</H4>
            <Ol>
              <Li>새 extension.zip 다운로드 후 기존 폴더에 덮어쓰기</Li>
              <Li><Code>chrome://extensions</Code>에서 Teledit 확장의 🔄 새로고침 버튼 클릭</Li>
              <Li>Telegram Web 탭에서 F5 (새로고침)</Li>
            </Ol>
          </Section>

          {/* 로그인 */}
          <Section title="3. 로그인">
            <Ol>
              <Li>Telegram Web K에서 채널 열기</Li>
              <Li>Chrome 우측 상단 확장 아이콘 &rarr; Teledit 클릭</Li>
              <Li>CryptoSim 계정의 아이디/비밀번호 입력 후 로그인</Li>
            </Ol>
            <P>로그인 상태는 브라우저에 저장되며, 로그아웃하기 전까지 유지됩니다.</P>
          </Section>

          {/* 포지션 삽입 */}
          <Section title="4. 포지션 삽입">
            <H4>팝업에서 삽입</H4>
            <Ol>
              <Li>Teledit 팝업에서 삽입할 포지션 체크</Li>
              <Li><B>체크된 포지션 삽입</B> 버튼 클릭</Li>
            </Ol>

            <H4>단축키로 삽입</H4>
            <P><Kbd>Alt</Kbd> + <Kbd>E</Kbd> : 전체 포지션 한번에 삽입 (팝업 안 열어도 됨)</P>

            <H4>삽입 규칙</H4>
            <Ul>
              <Li>현재 Telegram에 로드된 채팅 시간 범위 안의 포지션만 삽입됩니다</Li>
              <Li>범위 밖 포지션은 대기(pending) 상태가 됩니다</Li>
              <Li>스크롤하면서 해당 시간대가 로드되면 자동 삽입됩니다</Li>
            </Ul>
          </Section>

          {/* 대시보드 연동 */}
          <Section title="5. 대시보드 연동">
            <H4>Teledit 표시 체크박스</H4>
            <P>CryptoSim 대시보드에서 각 포지션의 Teledit 체크박스를 통해 팝업에 표시할 포지션을 선택합니다.</P>
            <Ul>
              <Li>체크 해제된 포지션은 팝업 목록에 나타나지 않습니다</Li>
              <Li>현재 포지션/히스토리 모두에서 설정 가능합니다</Li>
            </Ul>

            <H4>메모 (M1, M2, M3)</H4>
            <P>각 포지션에 메모 1~3을 설정하면 템플릿에서 <Code>{`{{memo1}}`}</Code> <Code>{`{{memo2}}`}</Code> <Code>{`{{memo3}}`}</Code> 변수로 사용할 수 있습니다.</P>
            <Ul>
              <Li>줄바꿈 가능</Li>
              <Li>비어있으면 해당 변수는 빈 문자열로 치환됩니다</Li>
            </Ul>

            <H4>채널 설정</H4>
            <P>설정 페이지의 텔레딧 관리에서 채널명과 채널 아바타를 등록하면, 포지션 삽입 시 해당 채널의 헤더가 변경됩니다.</P>
          </Section>

          {/* 템플릿 */}
          <Section title="6. 메시지 템플릿">
            <P>설정 &rarr; 텔레딧 관리에서 각 상황별 메시지 템플릿을 편집할 수 있습니다.</P>
            <H4>사용 가능한 변수</H4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs mt-2">
              {[
                ['{{symbol}}', '코인명 (BTCUSDT)'],
                ['{{side}}', 'LONG / SHORT'],
                ['{{leverage}}', '레버리지'],
                ['{{entryPrice}}', '체결가'],
                ['{{inputPrice}}', '입력가'],
                ['{{closePrice}}', '청산가'],
                ['{{amount}}', '투자금'],
                ['{{quantity}}', '수량'],
                ['{{pnl}}', '손익 (USDT)'],
                ['{{roe}}', '수익률 (%)'],
                ['{{takeProfit}}', 'TP'],
                ['{{stopLoss}}', 'SL'],
                ['{{marginModeKR}}', '마진모드 (교차/격리)'],
                ['{{memo1}}', '메모 1'],
                ['{{memo2}}', '메모 2'],
                ['{{memo3}}', '메모 3'],
                ['{{name}}', '이름'],
                ['{{nickname1}}', '별명 1'],
                ['{{nickname2}}', '별명 2'],
              ].map(([k, v]) => (
                <div key={k} className="flex items-center gap-2 py-0.5">
                  <code className="text-binance-yellow font-mono bg-binance-bg px-1.5 py-0.5 rounded text-[11px]">{k}</code>
                  <span className="text-binance-text-dim">{v}</span>
                </div>
              ))}
            </div>
            <P className="mt-3">숫자는 가격 크기에 따라 자동으로 소수점이 결정됩니다.</P>
          </Section>

          {/* 수익인증 이미지 */}
          <Section title="7. 수익인증 이미지">
            <P>profit1 타입 메시지는 자동으로 수익인증 카드 이미지를 포함합니다.</P>
            <Ul>
              <Li>이미지는 서버에서 실시간 생성됩니다 (satori)</Li>
              <Li>Inter 폰트 + 포스터 배경 포함</Li>
              <Li>배경은 3종 랜덤 (로켓, 불꽃, 차트)</Li>
            </Ul>
          </Section>

          {/* 주의사항 */}
          <Section title="8. 주의사항">
            <Ul>
              <Li>Telegram Web <B>K 버전</B>만 지원됩니다 (A 버전 불가)</Li>
              <Li>언어는 반드시 <B>English</B>로 설정해야 합니다</Li>
              <Li>시간은 <B>12시간제</B>로 설정해야 합니다</Li>
              <Li>채널 뷰에서만 작동합니다 (1:1 채팅, 그룹은 불가)</Li>
              <Li>삽입된 포지션은 페이지 새로고침 시 사라집니다 (Telegram의 실제 메시지가 아닙니다)</Li>
              <Li>스크롤 시 Telegram의 가상 스크롤에 의해 일부 버블이 일시적으로 사라질 수 있으나, 스크롤하면 다시 나타납니다</Li>
            </Ul>
          </Section>
        </div>

        <div className="mt-8 text-center text-xs text-binance-text-dim">
          Teledit &copy; 2026
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-binance-card border border-binance-border rounded-lg p-6">
      <h2 className="text-base font-bold text-binance-yellow mb-4">{title}</h2>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

function H4({ children }: { children: React.ReactNode }) {
  return <h4 className="text-sm font-semibold text-binance-text mt-4 mb-1">{children}</h4>
}

function P({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <p className={`text-sm text-binance-text-dim leading-relaxed ${className}`}>{children}</p>
}

function Code({ children }: { children: React.ReactNode }) {
  return <code className="bg-binance-bg px-1.5 py-0.5 rounded text-[12px] text-binance-yellow font-mono">{children}</code>
}

function Kbd({ children }: { children: React.ReactNode }) {
  return <kbd className="bg-binance-bg border border-binance-border px-2 py-0.5 rounded text-[12px] text-binance-text font-mono">{children}</kbd>
}

function B({ children }: { children: React.ReactNode }) {
  return <span className="text-binance-text font-semibold">{children}</span>
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return <a href={href} target="_blank" rel="noopener noreferrer" className="text-binance-yellow hover:underline">{children}</a>
}

function Ol({ children }: { children: React.ReactNode }) {
  return <ol className="list-decimal list-inside space-y-1 text-sm text-binance-text-dim ml-1">{children}</ol>
}

function Ul({ children }: { children: React.ReactNode }) {
  return <ul className="list-disc list-inside space-y-1 text-sm text-binance-text-dim ml-1">{children}</ul>
}

function Li({ children }: { children: React.ReactNode }) {
  return <li>{children}</li>
}
