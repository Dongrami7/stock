# PER Observatory · Stock Analysis

DART 재무·공시와 키움 REST 시세를 함께 조회하는 주식 분석 웹앱입니다. 조회 전용이며 주문·잔고 조회는 구현하지 않았습니다.

## 주요 기능
- 기업 검색, 연도·보고서·연결/별도 기준의 재무 비교, 최근 공시 원문 링크
- 키움 시세·PER·PBR 조회, 선택형 60초 자동 갱신
- 업로드 컨센서스 분석, 관심종목·메모, 종목 비교와 시나리오 분석
- 호출 중복 제거, 캐시, 실패 시 마지막 성공 데이터와 오류 상태 표시
- 분석 설명은 계산 규칙 기반이며 LLM API는 연결하지 않았습니다.

## 공개 소스 범위
기존 비공개 Sites 프로젝트의 소스 내보내기입니다.
기준 커밋: `5d56f7a9fc6f528c722fcf70aacc8b319b53a277`.
원본 XLSX, 최초 659종목 스냅샷, 개인 메모, API 키, 실제 데이터 기반 테스트 자료는 포함하지 않습니다.
공개판은 최초 스냅샷을 자동 생성하지 않으며 사용자가 자신의 XLSX를 업로드합니다.
기존 비공개 사이트의 저장 데이터와 공개 범위는 바꾸지 않았습니다.
GitHub 커밋에서 Sites로 자동 배포하는 연결은 아직 설정하지 않았습니다.

## 개발
Node.js 22.13 이상과 package.json에 지정된 pnpm을 사용합니다.

```sh
pnpm install --frozen-lockfile
pnpm exec tsc --noEmit --incremental false
pnpm run build
node tests/butler-adapter.mjs
```

Cloudflare D1 `DB`, R2 `BUCKET`, 인증된 사용자 ID를 제공하는 신뢰할 수 있는 호스팅 경계가 필요합니다.
`drizzle/`에 데이터베이스 마이그레이션이 있습니다.
Sites가 인증과 비공개 접근을 관리합니다. 다른 호스팅에서는 사용자 ID 헤더를 위조할 수 없도록 인증 계층을 구현해야 합니다.

## 서버 환경 변수
- `DART_API_KEY`
- `KIWOOM_APP_KEY`
- `KIWOOM_SECRET_KEY`

실제 값은 호스팅의 비밀 환경 변수로만 등록합니다. 소스나 GitHub에 입력하지 않습니다.
키움은 실제 호출 서버 IP 등록이 필요합니다.
2026-10-18 배포 점검에서는 키움 `8050: IP 미등록`, DART 서버 연결 시간 초과가 확인됐습니다.

## 검증 및 제한
공개판은 TypeScript 검사와 모의 API 어댑터 테스트로 검증합니다.
원본 비공개 데이터에 의존하는 테스트는 내보내기에서 제외했습니다.
실제 브라우저 검증은 수행하지 못했습니다.
재무 기간과 출처, 누적/분기 구분, 캐시 정책은 [docs/butler.md](docs/butler.md)를 참고하세요.
출처: 금융감독원 OpenDART, 키움증권 REST API, https://aikstockdata.com . 원천별 데이터 이용 조건을 따릅니다.
