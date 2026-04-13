// Teledit 메시지 템플릿 기본값 — 신규 회원 생성 시 적용
export const TELEDIT_TEMPLATE_DEFAULTS = {
  teleditPreEntryTemplate: `#포지션진입대기

포지션 진입 타점 임박
준비 안되신 분들은

"준비"`,

  teleditPostEntryTemplate: `#포지션진입완료

종목 : {{symbol}}
포지션 : {{side}}
마진모드 : {{marginModeKR}}
최종 진입가 : {{entryPrice}}
레버리지 : {{leverage}}
비중 : 10%`,

  teleditPreCloseTemplate: `#포지션종료대기

포지션 종료 임박
준비 안되신 분들은

"준비"`,

  teleditCloseTemplate: `#포지션종료

종목 : {{symbol}}
포지션 : {{side}}
마진모드 : {{marginModeKR}}
청산가 : 현재 시장가

최종 청산가 : {{closePrice}}`,

  teleditProfitTemplate: `💰 수익 인증
{{symbol}} {{side}} {{leverage}}x
진입 ${{entryPrice}} → 청산 ${{closePrice}}
PnL {{pnl}}USDT ({{roe}}%)`,

  teleditProfitTemplate2: `수익률 {{roe}}
축하드립니다.`,
}
