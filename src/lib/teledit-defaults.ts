// Teledit 메시지 템플릿 기본값 — 신규 회원 생성 시 적용
export const TELEDIT_TEMPLATE_DEFAULTS = {
  teledditLongTemplate: '#포지션진입안내\n\n종목 : {{symbol}}\n포지션 : {{side}}\n마진모드 : {{marginModeKR}}\n진입가 : {{inputPrice}} 부근 시장가\n레버리지 : {{leverage}}\n비중 : 10%',

  teledditShortTemplate: '#포지션진입안내\n\n종목 : {{symbol}}\n포지션 : {{side}}\n마진모드 : {{marginModeKR}}\n진입가 : {{inputPrice}} 부근 시장가\n레버리지 : {{leverage}}\n비중 : 10%',

  teleditPreEntryTemplate: '#포지션진입대기\n\n포지션 진입 타점 임박\n준비 안되신 분들은\n\n"준비"',

  teleditPostEntryTemplate: '#포지션진입완료\n\n종목 : {{symbol}}\n포지션 : {{side}}\n마진모드 : {{marginModeKR}}\n최종 진입가 : {{entryPrice}}\n레버리지 : {{leverage}}\n비중 : 10%',

  teleditPreCloseTemplate: '#포지션종료대기\n\n포지션 종료 임박\n준비 안되신 분들은\n\n"준비"',

  teleditCloseTemplate: '#포지션종료\n\n종목 : {{symbol}}\n포지션 : {{side}}\n마진모드 : {{marginModeKR}}\n청산가 : 현재 시장가\n\n최종 청산가 : {{closePrice}}',

  teleditProfitTemplate: '\uD83D\uDCB0 수익 인증\n{{symbol}} {{side}} {{leverage}}x\n진입 $' + '{{entryPrice}} \u2192 청산 $' + '{{closePrice}}\nPnL {{pnl}}USDT ({{roe}}%)',

  teleditProfitTemplate2: '수익률 {{roe}}\n축하드립니다.',
}
