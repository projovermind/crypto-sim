# POSI (CryptoSim)

## 개요
암호화폐 선물 포지션 시뮬레이터. 바이낸스 실시간 가격 피드 기반 가상 롱/숏 포지션 연습. PnL/ROE/청산가 계산, 포지션 공유, 어드민 패널.

## 기술 스택
- **프레임워크**: Next.js 14 (App Router) + TypeScript
- **스타일**: TailwindCSS
- **DB**: Supabase PostgreSQL + Prisma ORM
- **인증**: NextAuth.js
- **상태 관리**: Zustand
- **차트**: Lightweight Charts v5 (TradingView)
- **배포**: Vercel (리전: icn1, 서울)

## 프로젝트 구조
```
CryptoSim/
├── src/
│   ├── app/
│   │   ├── page.tsx            # 메인 트레이딩 뷰
│   │   ├── layout.tsx          # 루트 레이아웃
│   │   ├── login/              # 로그인
│   │   ├── admin/              # 어드민 패널
│   │   ├── dashboard/          # 대시보드
│   │   ├── settings/           # 설정
│   │   └── api/                # API 라우트
│   ├── components/
│   │   ├── PositionForm.tsx    # 포지션 입력 폼
│   │   ├── PositionChart.tsx   # 차트 뷰
│   │   ├── ProfitCard.tsx      # 손익 카드
│   │   ├── OrderBook.tsx       # 호가창
│   │   ├── RecentTrades.tsx    # 최근 체결
│   │   ├── MarketHeader.tsx    # 마켓 헤더
│   │   ├── SharePopup.tsx      # 공유 팝업
│   │   ├── NavBar.tsx          # 네비게이션
│   │   ├── SettingsModal.tsx   # 설정 모달
│   │   ├── SessionProvider.tsx
│   │   ├── position/           # 포지션 관련
│   │   ├── settings/           # 설정 관련
│   │   └── trade/              # 거래 관련
│   ├── hooks/
│   │   └── hooks.ts            # 커스텀 훅
│   ├── lib/
│   │   ├── prisma.ts           # Prisma 클라이언트
│   │   ├── auth.ts             # 인증
│   │   ├── calculations.ts     # PnL/ROE/청산가 계산
│   │   ├── auto-comments.ts    # 자동 코멘트
│   │   └── teledit-defaults.ts # Teledit 연동 기본값
│   └── types/                  # TypeScript 타입
├── prisma/
│   ├── schema.prisma           # DB 스키마
│   └── seed-admin.ts           # 어드민 시드
├── vercel.json                 # Vercel 설정
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

## 빌드 & 실행
```bash
cd "/Volumes/Core/Vault/hivemind/💻 Projects/CryptoSim"

# 의존성 설치
npm install

# Prisma 클라이언트 생성
npx prisma generate

# 개발 서버
npm run dev

# 빌드
npm run build
```

## 배포
- **GitHub → Vercel 자동 배포** (push 시 자동 트리거)
- Vercel CLI 사용 금지 — 반드시 Git push로 배포
- 리전: icn1 (서울)

## DB 관련 주의사항
- **Supabase PostgreSQL을 Teledit과 공유!**
- 스키마 변경 시 반드시 Teledit 측과 영향도 확인 필요
- DDL 작업은 session mode (port 5432) 사용:
  ```bash
  DATABASE_URL="<5432 direct URL>" npx prisma db push --skip-generate && npx prisma generate
  ```
- pgbouncer(6543)로는 DDL 실행 불가

## 핵심 계산 로직 (`lib/calculations.ts`)
- PnL (Profit & Loss): 진입가 대비 현재가 손익
- ROE (Return on Equity): 레버리지 적용 수익률
- 청산가 (Liquidation Price): 마진 소진 가격
- 바이낸스 실시간 가격 피드 사용

## 에이전트 구성
| 에이전트 | 역할 |
|----------|------|
| posi_planner | 기획 및 태스크 관리 |
| posi_frontend | 프론트엔드 UI/UX |
| posi_api | API 및 백엔드 로직 |

## 주의사항
- Vercel CLI 배포 금지 (GitHub push만 사용)
- Teledit과 DB 공유 — 마이그레이션 시 양쪽 확인 필수
- Lightweight Charts v5 API 사용 (v4 API와 호환 안 됨)
- 어드민 시드: `npx ts-node prisma/seed-admin.ts`
